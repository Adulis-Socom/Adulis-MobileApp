import { Redirect, useRouter } from 'expo-router';
import { useEffect, useRef, useState } from 'react';
import { AccessibilityInfo, View, type HostInstance } from 'react-native';

import { useBootstrap } from '../api/bootstrap';
import { ApiError, newIdempotencyKey, problemCode, wasAnswered } from '../api/client';
import { failureMessage, fillSlots } from '../api/messages';
import { useSession } from '../auth/session';
import { cleanPhone, isE164, isOtpCode } from '../auth/sign-in-flow';
import { StatusText } from '../components/AlertText';
import { AppText } from '../components/AppText';
import { Button } from '../components/Button';
import { useFocusRequest } from '../components/focus';
import { TextField } from '../components/TextField';
import { useT } from '../i18n/i18n';
import { useTheme } from '../theme/theme';
import { confirmedDeletion, blockersOf, parsePreview, parseTicket, type DeletionPreview, type DeletionTicket } from './account';

type Step = 'intro' | 'phone' | 'code' | 'preview' | 'done' | 'unconfirmed';

/**
 * Delete Account (WO-011; ADU-MOB-02 v4.3 R-11: verification, consequence preview, authoritative
 * blockers and typed confirmation) on the EXISTING deletion-ticket flow (ADU-API-01 v1.11
 * S12.18): phone, SMS code, ticket, preview, typed confirmation, server-confirmed deletion, then
 * this device forgets the session.
 *
 * - The ticket is a credential for exactly these endpoints (`Authorization: Ticket`), never a
 *   session: it lives in this screen's memory only (no storage, no route parameter, no log) and
 *   is dropped when the screen goes, the code expires, or deletion completes.
 * - Its deadline is checked before every use, and the server's 401 for a dead ticket sends the
 *   Buyer back to request a new code.
 * - The server's blockers and effects are shown as the server sends them; any line the app
 *   cannot render withholds confirmation rather than hide a consequence.
 * - Confirm carries one idempotency key per ticket, kept across a lost connection, so a retry
 *   replays rather than repeats. Local state is cleared only after the server says deleted.
 * - The flow belongs to the session it started in: if that session ends or changes, it leaves.
 * - Each step replaces the last, so the control the Buyer pressed is gone: the new step's first
 *   line takes screen-reader focus, which reads it (WO-018, A-006). "Deleting" is spoken; a
 *   Retry of the consequence check stays in place while it runs.
 */
export function DeleteAccount() {
  const t = useT();
  const theme = useTheme();
  const router = useRouter();
  const { session, api, boundApi, clearSession, signOut } = useSession();
  const boot = useBootstrap();
  const current = session.status === 'signedIn' ? session.token : null;
  const owner = useRef(current);
  const [step, setStep] = useState<Step>('intro');
  // After a deletion: whether the Account on this device was the one deleted (its session dies
  // with it). Null until the server has said, or when it could not be asked.
  const [thisAccount, setThisAccount] = useState<boolean | null>(null);
  const [phone, setPhone] = useState('');
  const [verifiedPhone, setVerifiedPhone] = useState('');
  const [code, setCode] = useState('');
  const [typed, setTyped] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [preview, setPreview] = useState<DeletionPreview | null>(null);
  // The consequence check failed and may be retried: its Try again stays in place while it runs.
  const [checkFailed, setCheckFailed] = useState(false);
  const stepRef = useRef<HostInstance>(null);
  const ticket = useRef<DeletionTicket | null>(null);
  const requestIntent = useRef<{ phone: string; key: string } | null>(null);
  const confirmKey = useRef<string | null>(null);
  // Set once the outcome is the server's (deleted, or a lost answer we cannot confirm), and while a
  // confirm is in flight: the session ending then is the deletion itself, not a reason to leave
  // (the server revokes every session of the deleted Account as it commits).
  const finished = useRef(false);
  const confirming = useRef(false);
  // A confirm that was sent and got no definitive answer (offline, a timeout, a 5xx): it may have
  // deleted the Account, whose ticket the server then refuses. After that, a refused or expired
  // ticket is "unconfirmed", never "start again".
  const uncertain = useRef(false);

  // A TextField speaks its own error; an error shown outside one (the preview's) is spoken here.
  const fieldless = step === 'preview' && (preview === null || preview.blockers.length > 0 || preview.incomplete);
  useEffect(() => {
    if (error && fieldless) AccessibilityInfo.announceForAccessibility(error);
  }, [error, fieldless]);

  // What is on screen, finer than the step: the preview step shows the check, then the consequences
  // or the blockers. Focus moves on every change after the first screen.
  const view =
    step === 'preview' ? (preview === null ? 'checking' : preview.blockers.length > 0 || preview.incomplete ? 'blocked' : 'preview') : step;
  useFocusRequest(stepRef, view === 'intro' ? null : view);

  if (!finished.current && !confirming.current && (current === null || current !== owner.current)) {
    return <Redirect href="/account" />;
  }

  const word = t('buyer.delete.confirm_word');

  const restart = (message: Parameters<typeof t>[0]) => {
    ticket.current = null;
    confirmKey.current = null;
    setPreview(null);
    setCheckFailed(false);
    setTyped('');
    setCode('');
    setStep('phone');
    setError(t(message));
  };
  const expire = () => restart('buyer.delete.ticket_expired');

  /**
   * After the server deleted an Account (or may have): ask, with THIS device's session, whether it
   * was this Account. The ticket names an Account by its phone, not by this session, so the
   * deleted Account may be another one. A revoked session means it was this one; a live session
   * means it was not (the device stays signed in). If the server cannot be asked, the device signs
   * out properly (the safe default: signing in again costs a code; a session of a deleted Account
   * left on the device is worse).
   */
  const settle = async (outcome: 'done' | 'unconfirmed') => {
    finished.current = true;
    confirming.current = false;
    ticket.current = null;
    let mine: boolean | null = null;
    try {
      await boundApi(owner.current ?? '').bootstrap();
      mine = false;
    } catch (failure) {
      const code = problemCode(failure);
      if (code === 'SESSION_REVOKED' || code === 'SESSION_EXPIRED' || !(failure instanceof ApiError)) mine = true;
    }
    if (mine === null && outcome === 'done') {
      await signOut().catch(() => undefined);
      mine = true;
    } else if (mine) {
      await clearSession().catch(() => undefined);
    }
    // A revoked session means the deletion happened, whatever the lost answer left unknown.
    const shown = mine ? 'done' : outcome;
    setThisAccount(mine);
    // Its heading takes focus and is read (no separate announcement: it would be heard twice).
    setStep(shown);
  };

  /** The ticket if it is still within its deadline; otherwise back to the phone step. */
  const liveTicket = (): string | null => {
    const held = ticket.current;
    if (held && Date.now() < held.deadline) return held.ticket;
    if (uncertain.current) void settle('unconfirmed');
    else expire();
    return null;
  };

  const sendCode = async () => {
    const cleaned = cleanPhone(phone);
    if (!isE164(cleaned)) {
      setError(t('auth.phone.invalid'));
      return;
    }
    if (requestIntent.current?.phone !== cleaned) requestIntent.current = { phone: cleaned, key: newIdempotencyKey() };
    setError(null);
    setBusy(true);
    try {
      // The server refuses a code for a device it has not placed; the bootstrap places it.
      if (boot.data === undefined) await boot.refetch({ throwOnError: true });
      await api.requestDeletionOtp(cleaned, requestIntent.current.key);
      requestIntent.current = null;
      setVerifiedPhone(cleaned);
      setCode('');
      setStep('code');
    } catch (failure) {
      if (wasAnswered(failure)) requestIntent.current = null;
      setError(failureMessage(t, failure));
    } finally {
      setBusy(false);
    }
  };

  const loadPreview = async () => {
    const held = liveTicket();
    if (!held) return;
    setError(null);
    setBusy(true);
    try {
      setPreview(parsePreview(t, await api.deletionPreview(held)));
      setCheckFailed(false);
    } catch (failure) {
      // Refused within its deadline: no ACTIVE Account has that phone, or the code was spent. The
      // Buyer has proven the phone, so saying the code cannot delete an Account reveals nothing.
      if (problemCode(failure) === 'SESSION_EXPIRED') restart('buyer.delete.code_unusable');
      else {
        setCheckFailed(true);
        setError(failureMessage(t, failure));
      }
    } finally {
      setBusy(false);
    }
  };

  const verifyCode = async () => {
    if (!isOtpCode(code)) {
      setError(t('auth.code.invalid'));
      return;
    }
    setError(null);
    setBusy(true);
    let verified = false;
    try {
      ticket.current = parseTicket(await api.verifyDeletionOtp(verifiedPhone, code), Date.now());
      confirmKey.current = null;
      setCode('');
      setStep('preview');
      verified = true;
    } catch (failure) {
      setError(failureMessage(t, failure));
    } finally {
      setBusy(false);
    }
    if (verified) await loadPreview();
  };

  const confirm = async () => {
    if (typed.trim().toLowerCase() !== word.toLowerCase()) {
      setError(fillSlots(t('buyer.delete.confirm_mismatch'), { word }) ?? t('buyer.delete.confirm_mismatch'));
      return;
    }
    // A ref, not the busy state: two presses in one frame both see busy=false.
    if (confirming.current) return;
    const held = liveTicket();
    if (!held) return;
    // One key per ticket, kept until a definitive answer. It covers a request that never reached
    // the server; one that did and deleted the Account is settled below, because the server
    // refuses a deleted Account's ticket before it would replay.
    confirmKey.current ??= newIdempotencyKey();
    confirming.current = true;
    setError(null);
    setBusy(true);
    try {
      const body = await api.confirmDeletion(held, confirmKey.current);
      if (!confirmedDeletion(body)) throw new ApiError({ kind: 'unexpected', status: 200 });
      await settle('done');
    } catch (failure) {
      confirming.current = false;
      const blocked = blockersOf(t, failure);
      if (blocked) {
        // Definitive: the Account exists and is blocked.
        uncertain.current = false;
        confirmKey.current = null;
        setPreview(blocked);
      } else if (problemCode(failure) === 'SESSION_EXPIRED') {
        // Definitive for this attempt. After an earlier attempt with no answer, the refusal may be
        // that attempt's deletion: never "start again" then.
        if (uncertain.current) await settle('unconfirmed');
        else expire();
      } else {
        // No definitive answer (offline, timeout, 5xx): the deletion may have happened.
        uncertain.current = true;
        setError(failureMessage(t, failure));
      }
    } finally {
      setBusy(false);
    }
  };

  const errorText = error ? <AppText accessibilityRole="alert" style={{ color: theme.color.danger }}>{error}</AppText> : null;
  const cancel = <Button label={t('buyer.delete.cancel')} variant="secondary" onPress={() => router.back()} disabled={busy} />;

  if (step === 'done' || step === 'unconfirmed') {
    return (
      <View style={{ gap: theme.space.md }}>
        <AppText ref={stepRef} accessibilityRole="header">
          {step === 'done' ? (fillSlots(t('buyer.delete.done'), { phone: verifiedPhone }) ?? '') : t('buyer.delete.unconfirmed')}
        </AppText>
        {thisAccount !== null ? (
          <AppText>{t(thisAccount ? 'buyer.delete.signed_out' : 'buyer.delete.still_signed_in')}</AppText>
        ) : null}
        <Button label={t('buyer.delete.done_home')} onPress={() => router.dismissTo('/home/for-you')} />
      </View>
    );
  }

  if (step === 'intro') {
    return (
      <View style={{ gap: theme.space.md }}>
        <AppText>{t('buyer.delete.intro')}</AppText>
        <AppText>{t('buyer.delete.steps')}</AppText>
        <Button label={t('buyer.delete.continue')} onPress={() => setStep('phone')} />
        {cancel}
      </View>
    );
  }

  if (step === 'phone') {
    return (
      <View style={{ gap: theme.space.md }}>
        <AppText ref={stepRef}>{t('buyer.delete.phone_intro')}</AppText>
        <TextField
          label={t('auth.phone.label')}
          hint={t('auth.phone.hint')}
          error={error}
          value={phone}
          onChangeText={(value) => {
            setPhone(value);
            if (error) setError(null);
          }}
          keyboardType="phone-pad"
          autoComplete="tel"
          textContentType="telephoneNumber"
          autoCorrect={false}
          editable={!busy}
        />
        <Button label={t('auth.send_code')} onPress={() => void sendCode()} disabled={busy} />
        {cancel}
      </View>
    );
  }

  if (step === 'code') {
    return (
      <View style={{ gap: theme.space.md }}>
        <AppText ref={stepRef}>{fillSlots(t('buyer.delete.code_sent'), { phone: verifiedPhone }) ?? ''}</AppText>
        <TextField
          label={t('auth.code.label')}
          error={error}
          value={code}
          onChangeText={(value) => {
            setCode(value);
            if (error) setError(null);
          }}
          keyboardType="number-pad"
          autoComplete="one-time-code"
          textContentType="oneTimeCode"
          maxLength={6}
          editable={!busy}
        />
        <Button label={t('auth.verify')} onPress={() => void verifyCode()} disabled={busy} />
        <Button label={t('auth.change_number')} variant="secondary" onPress={() => { setError(null); setStep('phone'); }} disabled={busy} />
        {cancel}
      </View>
    );
  }

  // step === 'preview'
  if (preview === null) {
    return (
      <View style={{ gap: theme.space.md }}>
        {/* Focused on arrival, which reads "Checking"; a Retry announces it itself. */}
        <AppText ref={stepRef}>{t(busy ? 'buyer.delete.checking' : 'buyer.delete.effects_title')}</AppText>
        {errorText}
        {checkFailed ? (
          <Button
            label={t('common.retry')}
            disabled={busy}
            busy={busy}
            onPress={() => {
              AccessibilityInfo.announceForAccessibility(t('buyer.delete.checking'));
              void loadPreview();
            }}
          />
        ) : null}
        {cancel}
      </View>
    );
  }

  return (
    <View style={{ gap: theme.space.md }}>
      <AppText ref={view === 'preview' ? stepRef : undefined} style={{ fontWeight: theme.fontWeight.semibold }}>
        {fillSlots(t('buyer.delete.for_phone'), { phone: verifiedPhone }) ?? ''}
      </AppText>
      {preview.effects.length > 0 ? (
        <View style={{ gap: theme.space.sm }}>
          <AppText accessibilityRole="header">{t('buyer.delete.effects_title')}</AppText>
          {preview.effects.map((effect, i) => (
            <AppText key={`${i}-${effect.key}`}>{effect.text}</AppText>
          ))}
        </View>
      ) : null}
      {preview.blockers.length > 0 ? (
        <View style={{ gap: theme.space.sm }}>
          <AppText ref={stepRef} accessibilityRole="header">{t('buyer.delete.blocked_title')}</AppText>
          <AppText>{t('error.deletion.deletion_blocked')}</AppText>
          {preview.blockers.map((blocker, i) => (
            <AppText key={`${i}-${blocker.key}`}>{blocker.text}</AppText>
          ))}
        </View>
      ) : null}
      {preview.incomplete ? (
        <AppText ref={preview.blockers.length === 0 ? stepRef : undefined} accessibilityRole="alert">
          {t('buyer.delete.preview_incomplete')}
        </AppText>
      ) : null}
      {preview.blockers.length === 0 && !preview.incomplete ? (
        <View style={{ gap: theme.space.md }}>
          <AppText>{fillSlots(t('buyer.delete.confirm_instruction'), { word }) ?? ''}</AppText>
          <TextField
            label={t('buyer.delete.confirm_label')}
            error={error}
            value={typed}
            onChangeText={(value) => {
              setTyped(value);
              if (error) setError(null);
            }}
            autoCapitalize="characters"
            autoCorrect={false}
            editable={!busy}
          />
          {busy ? <StatusText>{t('buyer.delete.deleting')}</StatusText> : null}
          <Button label={t('buyer.delete.confirm_button')} onPress={() => void confirm()} disabled={busy} />
        </View>
      ) : (
        errorText
      )}
      {cancel}
    </View>
  );
}

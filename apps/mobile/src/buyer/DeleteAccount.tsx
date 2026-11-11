import { Redirect, useRouter } from 'expo-router';
import { useEffect, useRef, useState } from 'react';
import { AccessibilityInfo, View } from 'react-native';

import { useBootstrap } from '../api/bootstrap';
import { ApiError, isTransient, newIdempotencyKey, problemCode, wasAnswered } from '../api/client';
import { failureMessage, fillSlots } from '../api/messages';
import { useSession } from '../auth/session';
import { cleanPhone, isE164, isOtpCode } from '../auth/sign-in-flow';
import { AppText } from '../components/AppText';
import { Button } from '../components/Button';
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
 */
export function DeleteAccount() {
  const t = useT();
  const theme = useTheme();
  const router = useRouter();
  const { session, api, clearSession } = useSession();
  const boot = useBootstrap();
  const current = session.status === 'signedIn' ? session.token : null;
  const owner = useRef(current);
  const [step, setStep] = useState<Step>('intro');
  const [phone, setPhone] = useState('');
  const [verifiedPhone, setVerifiedPhone] = useState('');
  const [code, setCode] = useState('');
  const [typed, setTyped] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [preview, setPreview] = useState<DeletionPreview | null>(null);
  const ticket = useRef<DeletionTicket | null>(null);
  const requestIntent = useRef<{ phone: string; key: string } | null>(null);
  const confirmKey = useRef<string | null>(null);
  // Set once the outcome is the server's (deleted, or a lost answer we cannot confirm): the
  // session ending after that is the deletion itself, not a reason to leave.
  const finished = useRef(false);

  // A TextField speaks its own error; an error shown outside one (the preview's) is spoken here.
  const fieldless = step === 'preview' && (preview === null || preview.blockers.length > 0 || preview.incomplete);
  useEffect(() => {
    if (error && fieldless) AccessibilityInfo.announceForAccessibility(error);
  }, [error, fieldless]);

  if (!finished.current && (current === null || current !== owner.current)) return <Redirect href="/account" />;

  const word = t('buyer.delete.confirm_word');

  const expire = () => {
    ticket.current = null;
    confirmKey.current = null;
    setPreview(null);
    setTyped('');
    setCode('');
    setStep('phone');
    setError(t('buyer.delete.ticket_expired'));
  };

  /** The ticket if it is still within its deadline; otherwise back to the phone step. */
  const liveTicket = (): string | null => {
    const held = ticket.current;
    if (held && Date.now() < held.deadline) return held.ticket;
    expire();
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
    } catch (failure) {
      if (problemCode(failure) === 'SESSION_EXPIRED') expire();
      else setError(failureMessage(t, failure));
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
    const held = liveTicket();
    if (!held) return;
    // One key per ticket: a retry after a lost connection replays the server's answer.
    const lostAnswerBefore = confirmKey.current !== null;
    confirmKey.current ??= newIdempotencyKey();
    setError(null);
    setBusy(true);
    try {
      const body = await api.confirmDeletion(held, confirmKey.current);
      if (!confirmedDeletion(body)) throw new ApiError({ kind: 'unexpected', status: 200 });
      finished.current = true;
      ticket.current = null;
      setStep('done');
      AccessibilityInfo.announceForAccessibility(t('buyer.delete.done'));
      // The server has revoked every session of the deleted Account; this device forgets its own.
      // A failed local delete leaves a dead credential the next bootstrap ends.
      await clearSession().catch(() => undefined);
    } catch (failure) {
      const blocked = blockersOf(t, failure);
      if (blocked) {
        confirmKey.current = null;
        setPreview(blocked);
      } else if (problemCode(failure) === 'SESSION_EXPIRED' && lostAnswerBefore) {
        // The previous attempt's answer was lost and the ticket no longer works: either it
        // expired, or that attempt deleted the Account (a deleted Account's ticket is refused).
        // Say so rather than claim either; a revoked session signs this device out on its own.
        finished.current = true;
        ticket.current = null;
        setStep('unconfirmed');
        void api.bootstrap().catch(() => undefined);
      } else if (problemCode(failure) === 'SESSION_EXPIRED') {
        expire();
      } else {
        // Offline or timed out: the outcome is unknown, so the key stays for the retry.
        if (!isTransient(failure)) confirmKey.current = null;
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
        <AppText accessibilityRole="header">{t(step === 'done' ? 'buyer.delete.done' : 'buyer.delete.unconfirmed')}</AppText>
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
        <AppText>{t('buyer.delete.phone_intro')}</AppText>
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
        <AppText>{fillSlots(t('buyer.delete.code_sent'), { phone: verifiedPhone }) ?? ''}</AppText>
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
        <AppText>{t(busy ? 'buyer.delete.checking' : 'buyer.delete.effects_title')}</AppText>
        {errorText}
        {!busy && error ? <Button label={t('common.retry')} onPress={() => void loadPreview()} /> : null}
        {cancel}
      </View>
    );
  }

  return (
    <View style={{ gap: theme.space.md }}>
      {preview.effects.length > 0 ? (
        <View style={{ gap: theme.space.sm }}>
          <AppText accessibilityRole="header">{t('buyer.delete.effects_title')}</AppText>
          {preview.effects.map((effect) => (
            <AppText key={effect.key}>{effect.text}</AppText>
          ))}
        </View>
      ) : null}
      {preview.blockers.length > 0 ? (
        <View style={{ gap: theme.space.sm }}>
          <AppText accessibilityRole="header">{t('buyer.delete.blocked_title')}</AppText>
          <AppText>{t('error.deletion.deletion_blocked')}</AppText>
          {preview.blockers.map((blocker) => (
            <AppText key={blocker.key}>{blocker.text}</AppText>
          ))}
        </View>
      ) : null}
      {preview.incomplete ? <AppText accessibilityRole="alert">{t('buyer.delete.preview_incomplete')}</AppText> : null}
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
          {busy ? <AppText>{t('buyer.delete.deleting')}</AppText> : null}
          <Button label={t('buyer.delete.confirm_button')} onPress={() => void confirm()} disabled={busy} />
        </View>
      ) : (
        errorText
      )}
      {cancel}
    </View>
  );
}

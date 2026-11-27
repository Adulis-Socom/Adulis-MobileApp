import { createContext, useContext, useMemo, useState, type ReactNode } from 'react';
import type { OtpChallenge } from '../../contracts/gap-sc';

/**
 * In-memory state of ONE sign-in attempt: the number, the live challenge, and where the person was heading. It lives in
 * React state only (never the URL, never web storage), so a reload starts again at the phone screen by design.
 */
export interface AuthFlow {
  readonly phone: string;
  readonly challenge: OtpChallenge | null;
  readonly policyVersion: string | null;
  readonly returnTo: string | null;
  readonly setPhone: (phone: string) => void;
  readonly setChallenge: (challenge: OtpChallenge | null) => void;
  readonly setPolicyVersion: (version: string | null) => void;
  readonly setReturnTo: (path: string | null) => void;
}

const FlowContext = createContext<AuthFlow | null>(null);

export function useAuthFlow(): AuthFlow {
  const value = useContext(FlowContext);
  if (!value) throw new Error('useAuthFlow outside AuthLayout');
  return value;
}

export function AuthFlowProvider({ children }: { children: ReactNode }) {
  const [phone, setPhone] = useState('');
  const [challenge, setChallenge] = useState<OtpChallenge | null>(null);
  const [policyVersion, setPolicyVersion] = useState<string | null>(null);
  const [returnTo, setReturnTo] = useState<string | null>(null);
  const value = useMemo<AuthFlow>(
    () => ({ phone, challenge, policyVersion, returnTo, setPhone, setChallenge, setPolicyVersion, setReturnTo }),
    [phone, challenge, policyVersion, returnTo],
  );
  return <FlowContext.Provider value={value}>{children}</FlowContext.Provider>;
}

/** A return target is accepted only if it is an in-app path: never an absolute or protocol-relative URL. */
export function safeReturnPath(candidate: unknown): string | null {
  return typeof candidate === 'string' && candidate.startsWith('/') && !candidate.startsWith('//') ? candidate : null;
}

/** Phone check before anything is sent: digits with an optional leading plus, spaces and dashes allowed. The server normalises. */
export function looksLikePhone(value: string): boolean {
  return /^\+?\d{9,15}$/.test(value.replace(/[\s-]/g, ''));
}

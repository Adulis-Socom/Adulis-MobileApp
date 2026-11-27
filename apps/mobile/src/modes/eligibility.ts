// Mode availability is SERVER-authoritative (MOB-FE-01 s10). The only way to obtain a ModeEligibility is adoptEligibility() on
// a server answer; there is no function that takes a Mode and an Account and returns a verdict, so the client cannot compute
// who is eligible. Parsing is fail-closed: anything the client does not recognise is NOT_ELIGIBLE, never AVAILABLE.
import {
  GATED_MODES,
  type AccountRef,
  type GatedMode,
  type Mode,
  type ModeAvailability,
  type ModeEligibility,
  type ModeEligibilityWire,
  type RequestStamp,
  type ServerMessage,
} from '../contracts/gap-mob-session';

const GENERIC_RESTRICTION: ServerMessage = { key: 'mobile.mode.restricted' };

function messageOf(raw: unknown): ServerMessage | null {
  if (raw === null || typeof raw !== 'object') return null;
  const { key, slots } = raw as { key?: unknown; slots?: unknown };
  if (typeof key !== 'string') return null;
  const clean: Record<string, string | number> = {};
  if (slots !== null && typeof slots === 'object') {
    for (const [name, value] of Object.entries(slots)) if (typeof value === 'string' || typeof value === 'number') clean[name] = value;
  }
  return Object.keys(clean).length > 0 ? { key, slots: clean } : { key };
}

function availabilityOf(raw: unknown): ModeAvailability {
  if (raw === null || typeof raw !== 'object') return { status: 'NOT_ELIGIBLE' };
  const { status, message } = raw as { status?: unknown; message?: unknown };
  switch (status) {
    case 'AVAILABLE':
      return { status: 'AVAILABLE' };
    case 'PENDING':
      return { status: 'PENDING', message: messageOf(message) };
    case 'REVOKED':
      return { status: 'REVOKED', message: messageOf(message) };
    case 'RESTRICTED':
      return { status: 'RESTRICTED', message: messageOf(message) ?? GENERIC_RESTRICTION };
    default:
      return { status: 'NOT_ELIGIBLE' };
  }
}

/** Returns null when `isCurrent(stamp)` is false: a stale answer is never adopted (another session's relationships). */
export function adoptEligibility(
  wire: ModeEligibilityWire,
  accountRef: AccountRef,
  stamp: RequestStamp,
  isCurrent: (stamp: RequestStamp) => boolean,
  now: number,
): ModeEligibility | null {
  if (!isCurrent(stamp)) return null;
  const modes = { BUYER: { status: 'AVAILABLE' } } as Record<Mode, ModeAvailability>;
  for (const mode of GATED_MODES) modes[mode] = availabilityOf(wire[mode]);
  return { source: 'SERVER', accountRef, epoch: stamp.epoch, resolvedAt: now, modes };
}

export function availability(eligibility: ModeEligibility | null, mode: Mode): ModeAvailability | null {
  return eligibility === null ? null : eligibility.modes[mode];
}

export type { GatedMode };

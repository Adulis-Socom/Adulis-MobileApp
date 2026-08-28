/**
 * The injectable clock (WORK ORDER T4 S2.3 trap 5).
 *
 * INVARIANT — a job that depends on time reads it from HERE, never from
 * `new Date()` in its own body and never from SQL `now()` where the instant
 * decides an outcome. The instant travels into the query as a parameter.
 *
 * The reason is testability of the only kind that matters for this job set:
 * the expiry sweep must be asserted at 23h59m AND at 24h01m, and a test that
 * sleeps for a day is a test nobody runs. It is also the only way to prove
 * the 08:00-EAT reminder fires at 08:00 EAT rather than 08:00 UTC without
 * waiting for a specific morning.
 *
 * SQL `now()` remains correct for row DEFAULTs and for the append-only logs —
 * those record when the write happened, which is not a decision.
 */

export interface Clock {
  now(): Date;
}

/** Production: the wall clock, read once per call. */
export const systemClock: Clock = {
  now: () => new Date(),
};

/** Tests: an instant the test moves deliberately. */
export class FixedClock implements Clock {
  constructor(private at: Date) {}

  now(): Date {
    return this.at;
  }

  set(at: Date): void {
    this.at = at;
  }

  /** Advance by whole seconds — the unit every cadence in S24 is expressed in. */
  advanceSeconds(seconds: number): void {
    this.at = new Date(this.at.getTime() + seconds * 1000);
  }
}

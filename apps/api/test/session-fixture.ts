import { createHash } from 'node:crypto';
import { SESSION_TOKEN_RE, hashSessionToken } from '../src/common/auth/session.service';

/**
 * FIXTURE SESSIONS AFTER WO-API-001A (SEC-1).
 *
 * Suites seed core.session rows by id and used to present that id as the
 * credential. The id is no longer a credential: a row authenticates only by
 * the SHA-256 of a separate token. So a suite ARMS its fixture rows with the
 * hash of a token derived from each id, and presents sessionToken(id).
 *
 * The derivation exists only here, in tests. Production tokens are 32 random
 * bytes (mintSessionToken); nothing in src/ can derive a token from an id.
 *
 * sessionToken passes a real credential through unchanged, so a helper that
 * sometimes carries a fixture id and sometimes a token returned by
 * /v1/auth/otp/verify can wrap both.
 */
export const sessionToken = (idOrToken: string): string =>
  SESSION_TOKEN_RE.test(idOrToken)
    ? idOrToken
    : createHash('sha256').update(`fixture-session:${idOrToken}`).digest('base64url');

interface Queryable {
  query(text: string, values?: unknown[]): Promise<unknown>;
}

/** Run after inserting fixture sessions; rows not named here stay unusable. */
export async function armFixtureSessions(db: Queryable, ids: readonly string[]): Promise<void> {
  await db.query(
    `UPDATE core.session AS s SET token_hash = v.h
       FROM unnest($1::uuid[], $2::bytea[]) AS v(id, h)
      WHERE s.id = v.id`,
    [ids, ids.map((id) => hashSessionToken(sessionToken(id)))],
  );
}

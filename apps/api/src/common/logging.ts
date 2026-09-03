import pino, { type Logger } from 'pino';

/**
 * ADU-CON-02 v3.0 section 3.12 — "Pino writes JSON logs under a redaction
 * allow-list (section 20.3)".
 *
 * ALLOW-LIST, not deny-list, and the direction is the whole point: a field is
 * logged BECAUSE IT IS NAMED HERE. Anything not named is dropped, including
 * fields nobody has thought of yet — a new column carrying a bank account cannot
 * start appearing in logs because someone forgot to add it to a blocklist.
 *
 * ------------------------------------------------------------------------
 * UNRESOLVED DOCUMENT REFERENCE — reported, not guessed.
 *
 * The Tier 0 work order asks for "the section 11 never-log list". No such list
 * exists in the supplied baseline. Section 11 is "The contract between the two
 * developers" in ADU-CON-02 v3.0, "What CSP does not fix" in ADU-SEC-01 v1.0,
 * "Events and notification delivery" in ADU-API-01 v1.3, "The deletion ticket"
 * in ADU-AUTH-01 v2.0 and "Cart and device lifecycle" in ADU-DB-01 v1.6. The
 * only pointers to redaction are section 3.12 (above) and section 14.4's review
 * checklist item "nothing from the redaction list logged"; section 20.3 defines
 * the weekly counters, not a field list.
 *
 * Per .claude/reference/DOCUMENT_AUTHORITY.md the list is not invented here.
 * NEVER_LOG below is DERIVED, and every entry is traced to the document and
 * table that makes the value sensitive. It is defence in depth behind the
 * allow-list, which already excludes all of it by construction. Treat it as
 * PENDING CONFIRMATION, not as the canonical list.
 * ------------------------------------------------------------------------
 */

/**
 * Fields that may appear in a log line, because they are named here.
 *
 * `level`, `time`, `pid` and `hostname` are pino's own base bindings and are
 * emitted before `formatters.log` runs, so listing them is what keeps this array
 * an accurate description of a log line rather than a partial one. `pid` and
 * `hostname` are kept deliberately: ADU-CON-02 v3.0 section 17 runs the API on
 * two instances from day one, and without them two interleaved log streams
 * cannot be told apart.
 */
export const LOG_FIELD_ALLOWLIST: readonly string[] = [
  'level',
  'time',
  'pid',
  'hostname',
  'msg',
  'requestId',
  'method',
  'route',
  'statusCode',
  'durationMs',
  'errorCode',
  'messageKey',
  'idempotentReplay',
  'actorRole',
  'sellerId',
  'accountId',
  // The worker's own result fields (T18 Phase 1). Without these, runtime.ts's
  // `log.info({ msg: 'job ok', job, ms, ...result })` emitted the literal line
  // {"msg":"job ok"} and nothing else — every count stripped — so a delivery
  // channel failing 100% of its rows reported success. That is precisely the
  // sentence the fake guard was written around ("the logs would look
  // healthy"), reappearing one layer down in the process that is supposed to
  // make it visible.
  //
  // All of these are operational scalars: a job NAME (a compile-time
  // constant), a duration, and counts of rows. None is derived from user
  // data, none can carry a phone number, an account id or evidence bytes, and
  // NEVER_LOG below still excludes every sensitive value by construction.
  'job',
  'ms',
  'claimed',
  'sent',
  'suppressed',
  'failed',
  'dead_tokens',
];

/**
 * Values that must never reach a log line. Behind the allow-list, so this is a
 * second line of defence and a reviewer's reference.
 *
 * DERIVED, PENDING CONFIRMATION — see the note above. Sources:
 *   otpCode                  ADU-AUTH-01 v2.0 section 4, core.otp_challenge
 *   phone / phoneNumber      ADU-AUTH-01 v2.0 section 4, core.person
 *   sessionToken, cookie     ADU-CON-02 v3.0 section 4.1, __Host-adulis_session
 *   deviceToken              ADU-CON-02 v3.0 section 4.3 (R17), __Host-adulis_device
 *   authorization            ADU-CON-02 v3.0 section 4.1, mobile bearer
 *   accountCiphertext,
 *     accountNameCiphertext  ADU-DB-01 v1.6 section 13.6, financial.payout_credential
 *   accountNumber            ADU-DB-01 v1.6 section 13.4, the payout credential
 *   objectKey                ADU-DB-01 v1.6 section 13.3, financial.payment_evidence
 *   idHash                   ADU-DB-01 v1.6 section 7.3, verification.identity_attestation
 *   legalName, idType,
 *     vendorReference        ADU-DB-01 v1.6 section 7.3, the identity boundary
 *   encryptionKey            ADU-CON-02 v3.0 section 18, versioned env secrets (R15:
 *                            key material never enters Postgres, and must not
 *                            enter a log either)
 */
export const NEVER_LOG: readonly string[] = [
  'otpCode',
  'phone',
  'phoneNumber',
  'sessionToken',
  'cookie',
  'deviceToken',
  'authorization',
  'accountCiphertext',
  'accountNameCiphertext',
  'accountNumber',
  'objectKey',
  'idHash',
  'legalName',
  'idType',
  'vendorReference',
  'encryptionKey',
];

/**
 * Keeps only allow-listed keys. Unknown keys are dropped rather than redacted:
 * a `[Redacted]` marker still tells a log reader the field was present, and the
 * allow-list posture is that unnamed fields do not appear at all.
 */
export function applyAllowList(record: Record<string, unknown>): Record<string, unknown> {
  const out: Record<string, unknown> = {};
  for (const key of LOG_FIELD_ALLOWLIST) {
    if (Object.hasOwn(record, key)) {
      out[key] = record[key];
    }
  }
  return out;
}

export function createLogger(level: string = process.env['LOG_LEVEL'] ?? 'info'): Logger {
  return pino({
    level,
    // Belt and braces: even if a caller bypasses applyAllowList, these paths are
    // removed outright.
    redact: { paths: [...NEVER_LOG], remove: true },
    formatters: {
      log: applyAllowList,
    },
  });
}

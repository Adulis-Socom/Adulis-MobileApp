import { Pool, PoolClient } from 'pg';

/** A savepoint-guarded client. See the tx helper below. */
type Tx = { query: PoolClient['query'] };

/**
 * Migrations 02 and 03 — configuration, accounts, sessions, step-up, recovery.
 *
 * Every test that writes runs inside a transaction that is rolled back, so the
 * suite is order-independent and leaves the database as it found it. The
 * constraints under test raise, and a raise inside a transaction is exactly
 * what the application will see.
 */

// The privileged credential, deliberately: these suites write fixtures into
// configuration tables and assert grants from the outside, neither of which
// adulis_app (the runtime DATABASE_URL from Tier 3) may do.
const CONNECTION_STRING = process.env['DATABASE_URL_MIGRATE'] ?? process.env['DATABASE_URL'];

const MARKET = '11111111-0000-4000-8000-000000000001';
const ACCOUNT = '11111111-0000-4000-8000-000000000002';

describe('migrations 02-03 — configuration, accounts, sessions', () => {
  let pool: Pool;

  /**
   * Every query runs inside its own SAVEPOINT.
   *
   * WHY. These suites assert that constraints RAISE, and in PostgreSQL a raised
   * statement poisons the rest of its transaction - every following statement
   * returns "current transaction is aborted" instead of the error under test.
   * A savepoint per statement makes an expected failure local to that
   * statement, so a test can assert a rejection and then keep asserting.
   */
  const tx = async <T>(fn: (c: Tx) => Promise<T>): Promise<T> => {
    const c = await pool.connect();
    const guarded: Tx = {
      query: async (...args: Parameters<PoolClient['query']>) => {
        await c.query('SAVEPOINT stmt');
        try {
          const r = await (c.query as (...a: unknown[]) => Promise<unknown>)(...args);
          await c.query('RELEASE SAVEPOINT stmt');
          return r;
        } catch (e) {
          await c.query('ROLLBACK TO SAVEPOINT stmt');
          throw e;
        }
      },
    } as Tx;
    try {
      await c.query('BEGIN');
      return await fn(guarded);
    } finally {
      await c.query('ROLLBACK');
      c.release();
    }
  };

  /** A market row, inside the caller's transaction. */
  let marketCode = 0;
  const seedMarket = async (c: Tx, id = MARKET) => {
    marketCode += 1;
    await c.query(
      `INSERT INTO core.market (id, code, display_name, phase, display_currency,
                                display_timezone, default_locale, is_live, activation_state, otp_enabled, sms_primary_provider)
       VALUES ($1::uuid, $2::text, 'Ethiopia', 'PHASE_1', 'ETB',
               'Africa/Addis_Ababa', 'en',false, 'ACTIVE', true, 'AFROMESSAGE')`,
      [id, `E${marketCode}`],
    );
    return id;
  };

  beforeAll(() => {
    if (!CONNECTION_STRING) throw new Error('DATABASE_URL is not set.');
    pool = new Pool({ connectionString: CONNECTION_STRING, max: 4 });
  });
  afterAll(async () => {
    await pool.end();
  });

  // -------------------------------------------------------------------------
  describe('the effective-range mechanism (section 4)', () => {
    /**
     * "Two versions of the same configuration can never be in force at the same
     * moment, and history is retained rather than overwritten."
     *
     * This is the mechanism doctrine 6 rests on, and it is an EXCLUDE
     * constraint rather than a unique index because a unique index cannot
     * express an overlapping range.
     */
    it('refuses two configuration versions in force at once for one market', async () => {
      await tx(async (c) => {
        await seedMarket(c);
        const insert = (from: string, to: string | null) =>
          c.query(
            `INSERT INTO core.locale_pack
               (id, market_id, default_locale, available_locales,
                machine_translation_enabled, effective)
             VALUES (gen_random_uuid(), $1, 'en', ARRAY['en','am']::core.locale_code[],
                     true, tstzrange($2::timestamptz, $3::timestamptz, '[)'))`,
            [MARKET, from, to],
          );

        await insert('2026-01-01', '2026-06-01');
        // Adjacent is fine — '[)' means the first range excludes its upper bound.
        await expect(insert('2026-06-01', null)).resolves.toBeDefined();
        // Overlapping is not.
        await expect(insert('2026-03-01', '2026-09-01')).rejects.toThrow(/exclusion constraint/i);
      });
    });

    it('allows two markets to hold configuration over the same period', async () => {
      await tx(async (c) => {
        const a = await seedMarket(c, '11111111-0000-4000-8000-0000000000aa');
        const b = await seedMarket(c, '11111111-0000-4000-8000-0000000000bb');
        for (const m of [a, b]) {
          await c.query(
            `INSERT INTO core.locale_pack
               (id, market_id, default_locale, available_locales, machine_translation_enabled)
             VALUES (gen_random_uuid(), $1, 'en', ARRAY['en']::core.locale_code[], false)`,
            [m],
          );
        }
        const { rows } = await c.query(`SELECT count(*)::int AS n FROM core.locale_pack`);
        expect(rows[0].n).toBe(2);
      });
    });
  });

  // -------------------------------------------------------------------------
  describe('core.locale_pack (section 5.4, D8)', () => {
    it('refuses a default locale that is not among the available ones', async () => {
      await tx(async (c) => {
        await seedMarket(c);
        await expect(
          c.query(
            `INSERT INTO core.locale_pack
               (id, market_id, default_locale, available_locales, machine_translation_enabled)
             VALUES (gen_random_uuid(), $1, 'am', ARRAY['en']::core.locale_code[], false)`,
            [MARKET],
          ),
        ).rejects.toThrow(/default_locale_is_available/);
      });
    });

    it('refuses an empty available_locales', async () => {
      await tx(async (c) => {
        await seedMarket(c);
        await expect(
          c.query(
            `INSERT INTO core.locale_pack
               (id, market_id, default_locale, available_locales, machine_translation_enabled)
             VALUES (gen_random_uuid(), $1, 'en', ARRAY[]::core.locale_code[], false)`,
            [MARKET],
          ),
        ).rejects.toThrow();
      });
    });
  });

  describe('core.identity_config (section 5.4, D8)', () => {
    /** "a market that requires identity must say what it accepts" */
    it('refuses identity_required with no accepted document types', async () => {
      await tx(async (c) => {
        await seedMarket(c);
        await expect(
          c.query(
            `INSERT INTO core.identity_config
               (id, market_id, identity_required, verifier_kind, accepted_id_types)
             VALUES (gen_random_uuid(), $1, true, 'KYC_VENDOR', ARRAY[]::text[])`,
            [MARKET],
          ),
        ).rejects.toThrow(/accepted_types_when_required/);
      });
    });

    it('allows an empty list when identity is not required', async () => {
      await tx(async (c) => {
        await seedMarket(c);
        await expect(
          c.query(
            `INSERT INTO core.identity_config
               (id, market_id, identity_required, verifier_kind, accepted_id_types)
             VALUES (gen_random_uuid(), $1, false, 'KYC_VENDOR', ARRAY[]::text[])`,
            [MARKET],
          ),
        ).resolves.toBeDefined();
      });
    });
  });

  describe('core.legal_config (section 5.4, D8)', () => {
    /**
     * INVARIANT — the legal TEXT is not stored in the database, only a version
     * label and a URL. Enforced by the absence of a column, which is the
     * strongest form available and the one Appendix C exists to police.
     */
    it('has no column that could hold the text of an agreement', async () => {
      const { rows } = await pool.query(
        `SELECT column_name FROM information_schema.columns
          WHERE table_schema='core' AND table_name='legal_config'
            AND (column_name LIKE '%body%' OR column_name LIKE '%text%'
                 OR column_name LIKE '%content%' OR column_name LIKE '%html%')`,
      );
      expect(rows).toEqual([]);
    });

    it('stores retention as configuration rather than as a constant', async () => {
      const { rows } = await pool.query(
        `SELECT column_name, data_type FROM information_schema.columns
          WHERE table_schema='core' AND table_name='legal_config'
            AND column_name IN ('evidence_retention','chat_retention','analytics_retention')
          ORDER BY 1`,
      );
      expect(rows.map((r) => r.column_name)).toEqual([
        'analytics_retention',
        'chat_retention',
        'evidence_retention',
      ]);
      expect(new Set(rows.map((r) => r.data_type))).toEqual(new Set(['interval']));
    });
  });

  // -------------------------------------------------------------------------
  describe('core.timing_config (sections 5.3, 6.6a)', () => {
    const base = {
      reservation_window: '48 hours',
      fulfilment_window: '72 hours',
      offline_sync_horizon: '7 days',
      payout_activation_delay: '24 hours',
      recovery_cooling_period: '7 days',
      deleted_number_cooling_period: '30 days',
      refund_ack_window: '48 hours',
      media_retention: '90 days',
      level_credit_grace: '24 hours',
      payment_confirmation_window: '24 hours',
      mobile_session_lifetime: '30 days',
      console_session_lifetime: '12 hours',
      console_idle_timeout: '30 minutes',
      console_remembered_lifetime: '7 days',
      console_remembered_idle: '8 hours',
      otp_ttl: '5 minutes',
      step_up_freshness: '5 minutes',
      new_device_payout_lock: '24 hours',
      same_seller_cooldown: '1 hour',
      cancellation_counter_decay: '30 days',
    };

    const insertTiming = (c: Tx, over: Partial<typeof base> = {}) => {
      const v = { ...base, ...over };
      const cols = Object.keys(v);
      return c.query(
        `INSERT INTO core.timing_config
           (id, market_id, otp_max_attempts, same_seller_cancellation_threshold,
            cross_seller_cooldown_ladder, ${cols.join(', ')})
         VALUES (gen_random_uuid(), $1, 5, 3,
                 ARRAY['1 day','2 days','4 days']::interval[],
                 ${cols.map((_, i) => `$${i + 2}::interval`).join(', ')})`,
        [MARKET, ...cols.map((k) => (v as Record<string, string>)[k])],
      );
    };

    it('accepts the specified defaults', async () => {
      await tx(async (c) => {
        await seedMarket(c);
        await expect(insertTiming(c)).resolves.toBeDefined();
      });
    });

    /**
     * INVARIANT (sections 6.6, 6.6a) — the CHECK orders BOTH console pairs
     * against the mobile lifetime, "so a configuration edit cannot make a
     * console session outlive a mobile one in either mode".
     *
     * R17 lengthened the remembered console session to 7 days, which is what
     * makes this worth a constraint rather than a convention: 7 days is close
     * enough to a mobile lifetime that a well-meaning edit could pass it.
     */
    it('refuses a console session that outlives the mobile one', async () => {
      await tx(async (c) => {
        await seedMarket(c);
        await expect(
          insertTiming(c, { console_session_lifetime: '60 days' }),
        ).rejects.toThrow(/console_shorter_than_mobile/);
      });
    });

    it('refuses a REMEMBERED console session that outlives the mobile one', async () => {
      await tx(async (c) => {
        await seedMarket(c);
        await expect(
          insertTiming(c, { console_remembered_lifetime: '45 days' }),
        ).rejects.toThrow(/console_shorter_than_mobile/);
      });
    });

    it('refuses an idle timeout longer than its own absolute lifetime', async () => {
      await tx(async (c) => {
        await seedMarket(c);
        await expect(
          insertTiming(c, { console_idle_timeout: '20 hours' }),
        ).rejects.toThrow(/console_idle_within_absolute/);
      });
    });
  });

  // -------------------------------------------------------------------------
  describe('the PHASE_2 gate (section 5.1)', () => {
    /**
     * "ADU-PROJ-01 section 11 phase 5 makes those conditions build
     * dependencies, not policy preferences; a trigger is the difference between
     * a dependency and a hope."
     */
    it('refuses PHASE_2 while any gate condition is unsatisfied', async () => {
      await tx(async (c) => {
        await seedMarket(c);
        await c.query(
          `INSERT INTO core.market_phase_gate
             (market_id,
              v3_discovery_live, v3_discovery_live_attested_by, v3_discovery_live_attested_at,
              kyc_vendor_integrated, kyc_vendor_integrated_attested_by, kyc_vendor_integrated_attested_at,
              ladder_operating)
           VALUES ($1, true, gen_random_uuid(), now(), true, gen_random_uuid(), now(), false)`,
          [MARKET],
        );
        await expect(
          c.query(`UPDATE core.market SET phase='PHASE_2' WHERE id=$1`, [MARKET]),
        ).rejects.toThrow(/gate conditions unsatisfied/);
      });
    });

    it('refuses PHASE_2 when no gate row exists at all', async () => {
      await tx(async (c) => {
        await seedMarket(c);
        await expect(
          c.query(`UPDATE core.market SET phase='PHASE_2' WHERE id=$1`, [MARKET]),
        ).rejects.toThrow(/gate conditions unsatisfied/);
      });
    });

    it('permits PHASE_2 once all three are satisfied', async () => {
      await tx(async (c) => {
        await seedMarket(c);
        await c.query(
          `INSERT INTO core.market_phase_gate
             (market_id,
              v3_discovery_live, v3_discovery_live_attested_by, v3_discovery_live_attested_at,
              kyc_vendor_integrated, kyc_vendor_integrated_attested_by, kyc_vendor_integrated_attested_at,
              ladder_operating, ladder_operating_attested_by, ladder_operating_attested_at)
           VALUES ($1, true, gen_random_uuid(), now(), true, gen_random_uuid(), now(),
                   true, gen_random_uuid(), now())`,
          [MARKET],
        );
        await expect(
          c.query(`UPDATE core.market SET phase='PHASE_2' WHERE id=$1`, [MARKET]),
        ).resolves.toBeDefined();
      });
    });
  });

  // -------------------------------------------------------------------------
  describe('the deletion OTP cannot mint a session (section 6.5)', () => {
    const seedAccount = async (c: Tx) => {
      await seedMarket(c);
      await c.query(
        `INSERT INTO core.account (id, phone_e164, market_id, status)
         VALUES ($1, '+251911000777', $2, 'ACTIVE')`,
        [ACCOUNT, MARKET],
      );
    };

    const seedOtp = async (c: Tx, purpose: string) => {
      const { rows } = await c.query(
        `INSERT INTO core.otp_challenge (id, purpose, phone_e164, code_hash, expires_at)
         VALUES (gen_random_uuid(), $1, '+251911000777', decode('00','hex'), now() + interval '5 min')
         RETURNING id`,
        [purpose],
      );
      return rows[0].id as string;
    };

    const mintSession = (c: Tx, otpId: string) =>
      c.query(
        `INSERT INTO core.session (id, account_id, audience, expires_at, created_from_otp_id)
         VALUES (gen_random_uuid(), $1, 'CONSOLE', now() + interval '12 hours', $2)`,
        [ACCOUNT, otpId],
      );

    /**
     * ADU-AUTH-01 section 11: the deletion OTP "issues no session, grants
     * access to no other surface". Required by both app stores, and enforced
     * "by a trigger in the database, not by remembering not to".
     */
    it('refuses a session created from an ACCOUNT_DELETION challenge', async () => {
      await tx(async (c) => {
        await seedAccount(c);
        const otp = await seedOtp(c, 'ACCOUNT_DELETION');
        await expect(mintSession(c, otp)).rejects.toThrow(
          /OTP purpose ACCOUNT_DELETION cannot issue a session/,
        );
      });
    });

    it.each(['STEP_UP', 'RECOVERY'])(
      'refuses a session created from a %s challenge too',
      async (purpose) => {
        await tx(async (c) => {
          await seedAccount(c);
          const otp = await seedOtp(c, purpose);
          await expect(mintSession(c, otp)).rejects.toThrow(/cannot issue a session/);
        });
      },
    );

    it('permits a session created from SIGN_IN', async () => {
      await tx(async (c) => {
        await seedAccount(c);
        const otp = await seedOtp(c, 'SIGN_IN');
        await expect(mintSession(c, otp)).resolves.toBeDefined();
      });
    });

    it('permits a session with no originating challenge', async () => {
      await tx(async (c) => {
        await seedAccount(c);
        await expect(
          c.query(
            `INSERT INTO core.session (id, account_id, audience, expires_at)
             VALUES (gen_random_uuid(), $1, 'MOBILE', now() + interval '30 days')`,
            [ACCOUNT],
          ),
        ).resolves.toBeDefined();
      });
    });
  });

  // -------------------------------------------------------------------------
  describe('remembered devices are a console concept (R17)', () => {
    it('refuses a MOBILE session bound to a remembered device', async () => {
      await tx(async (c) => {
        await seedMarket(c);
        await c.query(
          `INSERT INTO core.account (id, phone_e164, market_id, status)
           VALUES ($1, '+251911000778', $2, 'ACTIVE')`,
          [ACCOUNT, MARKET],
        );
        const dev = '11111111-0000-4000-8000-0000000000d1';
        await c.query(
          `INSERT INTO core.device (id, platform) VALUES ($1, 'ANDROID')`,
          [dev],
        );
        const { rows } = await c.query(
          `INSERT INTO core.account_device (id, account_id, device_id, token_hash, expires_at)
           VALUES (gen_random_uuid(), $1, $2, decode('aa','hex'), now() + interval '7 days')
           RETURNING id`,
          [ACCOUNT, dev],
        );
        await expect(
          c.query(
            `INSERT INTO core.session (id, account_id, audience, expires_at, account_device_id)
             VALUES (gen_random_uuid(), $1, 'MOBILE', now() + interval '30 days', $2)`,
            [ACCOUNT, rows[0].id],
          ),
        ).rejects.toThrow(/remembered_device_is_console/);
      });
    });

    /** "The stored value is a hash; the raw token appears in no table." */
    it('stores the device token as bytea, never as text', async () => {
      const { rows } = await pool.query(
        `SELECT data_type FROM information_schema.columns
          WHERE table_schema='core' AND table_name='account_device' AND column_name='token_hash'`,
      );
      expect(rows[0]?.data_type).toBe('bytea');
    });
  });

  // -------------------------------------------------------------------------
  describe('append-only and never-deleted (sections 4, 6.2, 6.8)', () => {
    it('core.person carries no DELETE grant for the application role', async () => {
      const { rows } = await pool.query(
        `SELECT has_table_privilege('adulis_app','core.person','DELETE') AS can_delete,
                has_table_privilege('adulis_app','core.person','SELECT') AS can_read`,
      );
      expect(rows[0]).toEqual({ can_delete: false, can_read: true });
    });

    it('core.account_recovery_case raises on UPDATE and on DELETE', async () => {
      await tx(async (c) => {
        await seedMarket(c);
        await c.query(
          `INSERT INTO core.account (id, phone_e164, market_id, status)
           VALUES ($1, '+251911000779', $2, 'ACTIVE')`,
          [ACCOUNT, MARKET],
        );
        await c.query(
          `INSERT INTO core.account_recovery_case (id, account_id, reason)
           VALUES ('11111111-0000-4000-8000-0000000000c1', $1, 'lost SIM')`,
          [ACCOUNT],
        );
        await expect(
          c.query(`UPDATE core.account_recovery_case SET reason='x'`),
        ).rejects.toThrow(/append-only; UPDATE is not permitted/);
        await expect(c.query(`DELETE FROM core.account_recovery_case`)).rejects.toThrow(
          /append-only; DELETE is not permitted/,
        );
      });
    });
  });
});

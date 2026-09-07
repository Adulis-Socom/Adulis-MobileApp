import { Inject, Injectable } from '@nestjs/common';
import { randomUUID, createHash } from 'node:crypto';
import { sql, type Transaction } from 'kysely';
import type { Database } from '../../common/db/database.types';
import type { AuthedRequest } from '../../common/auth/auth.guard';
import { assertPermission } from '../../common/auth/permission';
import { phoneHash } from '../deletion/deletion.service';
import { AdulisException } from '../../common/errors/adulis-exception';
import {
  SOCIAL_PLATFORM_ADAPTER,
  type SocialPlatformAdapter,
} from './social-platform.adapter';
import type {
  AvailabilityBody,
  CompanyDetailsBody,
  CreateSellerBody,
  FulfilmentMethodsBody,
  IdentityVerificationBody,
  PatchProfileBody,
  SocialAccountBody,
} from './onboarding.schemas';

/**
 * C1 — onboarding and verification (ADU-API-01 v1.6 section 12.9).
 *
 * Every method is thin on purpose: `fn_has_permission` first, then one
 * named database function where section 13 names one, and a plain scoped
 * write where it names none. No method computes eligibility, readiness or
 * a follower count — those are the database's and the adapter's.
 */
@Injectable()
export class OnboardingService {
  constructor(
    @Inject(SOCIAL_PLATFORM_ADAPTER) private readonly social: SocialPlatformAdapter,
  ) {}

  /**
   * POST /v1/seller — the act that brings the seller into existence. No
   * permission gate: a relationship cannot be checked before it exists.
   * The first eligibility evaluation runs in the same transaction, so the
   * response already says where the seller stands.
   */
  async createSeller(
    trx: Transaction<Database>,
    req: AuthedRequest,
    body: CreateSellerBody,
  ): Promise<unknown> {
    const accountId = req.ctx?.accountId as string;

    // S16.9 — a deleted seller's phone does not become immediately
    // reusable for a NEW seller account. The block outlives the scrubbed
    // account, so it is keyed by phone hash, and this is the read that
    // makes the write mean something (migration 0023 writes it).
    // FOR UPDATE serializes concurrent declarations by the same account:
    // without it, two simultaneous INDIVIDUAL creations both find no
    // personed sibling below and mint two persons for one human -- the
    // split S4.4 forbids, unraisable by any constraint afterwards
    // (adversarial pass on T7 Phase 1).
    const caller = await sql<{ phone_e164: string; market_id: string }>`
      SELECT phone_e164, market_id FROM core.account
       WHERE id = ${accountId} FOR UPDATE`.execute(trx);
    const phone = caller.rows[0];
    if (!phone) throw new AdulisException('INTERNAL');
    const blocked = await sql<{ n: number }>`
      SELECT count(*)::int AS n FROM core.phone_reuse_block b
       WHERE b.phone_hash = ${phoneHash(phone.phone_e164)}
         AND b.market_id = ${phone.market_id}
         AND b.blocked_until > now()`.execute(trx);
    if ((blocked.rows[0]?.n ?? 0) > 0) {
      throw new AdulisException('ELIGIBILITY_NOT_SATISFIED', {
        slots: { reason: 'PHONE_REUSE_BLOCKED' },
      });
    }

    // D-57 via T7 S3.2 -- THE PERSON ROW IS CREATED HERE, at the
    // declaration, in the same transaction. Declaring yourself an
    // individual seller already asserts you are a natural person; an
    // operator attests ABOUT a person and cannot bring one into being, so
    // the person must exist before anyone can attest
    // (fn_seller_attestation_person reads seller.person_id).
    //
    // ONE PERSON PER OWNER, not per store: S4.4 stores the ID hash "once
    // per person and referenced by each seller account", and S6.1's
    // one-phone-one-account means this account's INDIVIDUAL declarations
    // are all the same natural person -- a second store REUSES the person
    // its sibling anchored. COMPANY sellers are untouched; their person is
    // the representative, arriving via company-details.
    //
    // Inside this trx deliberately: on HANDLE_TAKEN below, a person minted
    // for a store that was never created rolls back with it.
    let personId: string | null = null;
    if (body.entity_type === 'INDIVIDUAL') {
      // The reuse source EXCLUDES stores that arrived by ownership
      // transfer: their person_id was anchored by the PREVIOUS owner's
      // declaration (0034 flips owner_account_id and never touches
      // person_id), and reusing it would attach this human's stores to
      // someone else's person row -- the merge-direction form of the split
      // S4.4 forbids. Register D-88 records the wider interaction.
      const existing = await sql<{ person_id: string }>`
        SELECT s.person_id FROM core.seller s
         WHERE s.owner_account_id = ${accountId}
           AND s.entity_type = 'INDIVIDUAL' AND s.person_id IS NOT NULL
           AND NOT EXISTS (SELECT 1 FROM core.seller_ownership_transfer t
                            WHERE t.seller_id = s.id
                              AND t.to_account_id = ${accountId}
                              AND t.activated_at IS NOT NULL)
         ORDER BY s.created_at LIMIT 1`.execute(trx);
      personId = existing.rows[0]?.person_id ?? null;
      if (!personId) {
        personId = randomUUID();
        // core.person.id has NO default -- minted explicitly. adulis_app
        // holds INSERT on core.person (0003); DELETE exists for nobody.
        await sql`INSERT INTO core.person (id) VALUES (${personId})`.execute(trx);
      }
    }

    try {
      const seller = await sql<{ id: string }>`
        INSERT INTO core.seller
          (id, market_id, owner_account_id, entity_type, store_name, handle,
           description, category_id, status, person_id)
        SELECT ${randomUUID()}, a.market_id, a.id, ${body.entity_type},
               ${body.store_name}, ${body.handle},
               ${body.description ?? null}, ${body.category_id ?? null}, 'DRAFT',
               ${personId}
          FROM core.account a WHERE a.id = ${accountId}
        RETURNING id`.execute(trx);
      const sellerId = seller.rows[0]?.id;
      if (!sellerId) throw new AdulisException('INTERNAL');

      const ev = await sql<{ outcome: string; reasons: string[] }>`
        SELECT (e).outcome::text AS outcome, (e).reasons AS reasons
          FROM core.fn_evaluate_eligibility(${sellerId}) e`.execute(trx);

      return {
        seller_id: sellerId,
        status: 'DRAFT',
        eligibility: {
          outcome: ev.rows[0]?.outcome,
          reasons: ev.rows[0]?.reasons ?? [],
        },
      };
    } catch (e) {
      if (
        (e as { code?: string }).code === '23505' &&
        (e as { constraint?: string }).constraint === 'seller_handle_unique_per_market'
      ) {
        throw new AdulisException('HANDLE_TAKEN');
      }
      throw e;
    }
  }

  /** GET /v1/seller/readiness — 200 with items[]; a state, not a failure. */
  /**
   * GET /v1/seller/list -- the stores this account holds (T18 Phase 3, D-97).
   *
   * TWO RELATIONSHIPS, NOT ONE. S2.1 allows an account to be Owner of A and
   * staff of B, so the query is a UNION of the two arms fn_has_permission
   * itself uses: core.seller.owner_account_id, and a live row in
   * core.seller_team_member. They are kept separate rather than collapsed
   * because the ROLE differs -- the Owner is core.seller.owner_account_id and
   * only that (a CHECK forbids role = 'OWNER' on a team row), so the owner arm
   * supplies the string 'OWNER' and the member arm supplies its own column.
   *
   * SUSPENDED AND REVOKED MEMBERSHIPS ARE EXCLUDED. R28: a suspended member
   * loses every permission on the next request, so listing their store would
   * offer a door that every subsequent call refuses. The owner arm has no such
   * filter because ownership has no suspended state.
   *
   * THE OWNER IS EXCLUDED FROM THE MEMBER ARM, and the reason is not symmetry.
   * `team_member_is_never_owner` constrains the ROLE VALUE (role <> 'OWNER'),
   * not the ACCOUNT -- so nothing stops an owner also holding, say, an ADMIN
   * team row on their own store. Under UNION ALL that store would be listed
   * TWICE, which is not merely untidy: the console redirects when the list has
   * exactly one entry, so a duplicate would strand that seller on a chooser
   * showing their one store two ways.
   *
   * DELETED IS EXCLUDED FROM BOTH ARMS. core.seller_status carries DELETED, and
   * a deleted store is not somewhere a seller can be sent. With the redirect,
   * listing it would be worse than untidy -- a seller whose only store was
   * deleted would be forwarded into it on every visit and could never reach the
   * screen that offers to create a new one.
   *
   * ORDER BY created_at, id -- the id is a tie-breaker, not decoration. Two
   * stores created in the same transaction share a timestamp, and an unstable
   * order would reshuffle the list between requests.
   *
   * NO PERMISSION CHECK, deliberately, and it is not an omission. Every other
   * seller-scoped read begins with fn_has_permission(account, seller, ...) --
   * but that asks "may this account act on THIS seller", and the answer here
   * IS the set of sellers. There is no id to check against, and no oracle
   * either: the rows are selected BY account_id, so a caller sees their own
   * relationships and nothing else.
   *
   * The store may be in any status, including one the public cannot see. A
   * seller whose store is SUSPENDED still needs to reach it -- that is where
   * the reason and the remedy are -- so status travels in the row rather than
   * filtering it out.
   */
  async listSellers(trx: Transaction<Database>, req: AuthedRequest): Promise<unknown> {
    const r = await sql<Record<string, unknown>>`
      SELECT s.id, s.handle, s.store_name, s.status::text AS status,
             'OWNER' AS role, s.created_at
        FROM core.seller s
       WHERE s.owner_account_id = ${req.ctx?.accountId}
         AND s.status <> 'DELETED'
      UNION ALL
      SELECT s.id, s.handle, s.store_name, s.status::text AS status,
             tm.role::text AS role, s.created_at
        FROM core.seller_team_member tm
        JOIN core.seller s ON s.id = tm.seller_id
       WHERE tm.account_id = ${req.ctx?.accountId}
         AND tm.suspended_at IS NULL
         AND tm.revoked_at IS NULL
         AND s.status <> 'DELETED'
         AND s.owner_account_id <> tm.account_id
       ORDER BY created_at, id`.execute(trx);
    return { data: r.rows };
  }

  async readiness(trx: Transaction<Database>, req: AuthedRequest): Promise<unknown> {
    await assertPermission(trx, req, 'seller.store:read');
    const r = await sql<{ item: string; satisfied: boolean; resolving_action: string | null }>`
      SELECT * FROM core.fn_publication_readiness(${req.ctx?.sellerId})`.execute(trx);
    return {
      items: r.rows.map((row) => ({
        code: row.item,
        kind: 'READINESS_ITEM',
        satisfied: row.satisfied,
        ...(row.resolving_action ? { resolving_action: { kind: row.resolving_action } } : {}),
      })),
    };
  }

  /** PATCH /v1/seller/profile — scoped write; no function is named for it. */
  async patchProfile(
    trx: Transaction<Database>,
    req: AuthedRequest,
    body: PatchProfileBody,
  ): Promise<unknown> {
    await assertPermission(trx, req, 'seller.store:write');
    await sql`
      UPDATE core.seller
         SET store_name  = coalesce(${body.store_name ?? null}, store_name),
             description = coalesce(${body.description ?? null}, description),
             category_id = coalesce(${body.category_id ?? null}, category_id)
       WHERE id = ${req.ctx?.sellerId}`.execute(trx);
    return { updated: true };
  }

  /**
   * GET /v1/seller/profile (ADU-API-01 v1.9 S1 item 4 + item 7, S15.0b).
   * SC-17 was a write-only form: it PATCHed fields it could never read back,
   * so it could not show what it had saved, and no screen could read the
   * seller's own `status` or `handle`. This returns the editable fields the
   * PATCH writes, PLUS `status` and `handle` -- the two the console needs to
   * know whether the store is DRAFT/ACTIVE/CLOSING and what its public
   * address is. Read-only; `seller.store:read`, the same gate every other
   * seller read here uses.
   */
  async getProfile(trx: Transaction<Database>, req: AuthedRequest): Promise<unknown> {
    await assertPermission(trx, req, 'seller.store:read');
    const r = await sql<{
      handle: string;
      store_name: string;
      description: string | null;
      category_id: string | null;
      entity_type: string;
      status: string;
    }>`
      SELECT handle, store_name, description, category_id, entity_type, status
        FROM core.seller
       WHERE id = ${req.ctx?.sellerId}`.execute(trx);
    const row = r.rows[0];
    if (!row) throw new AdulisException('NOT_FOUND');
    return {
      handle: row.handle,
      store_name: row.store_name,
      description: row.description,
      category_id: row.category_id,
      entity_type: row.entity_type,
      status: row.status,
    };
  }

  /**
   * POST /v1/seller/social-accounts — issues the account-control code
   * (S7.2). The code goes into the account's public bio; nothing else
   * proves control. 24h to place it (the TTL is unruled; generous and
   * commented rather than invisible).
   */
  async createSocialAccount(
    trx: Transaction<Database>,
    req: AuthedRequest,
    body: SocialAccountBody,
  ): Promise<unknown> {
    await assertPermission(trx, req, 'seller.store:write');
    const code = `ADU-${createHash('sha256')
      .update(randomUUID())
      .digest('hex')
      .slice(0, 8)
      .toUpperCase()}`;
    const r = await sql<{ id: string; challenge_id: string; expires_at: Date }>`
      WITH sa AS (
        INSERT INTO core.seller_social_account (id, seller_id, platform, handle, status)
        VALUES (${randomUUID()}, ${req.ctx?.sellerId}, ${body.platform},
                ${body.handle}, 'PENDING')
        RETURNING id
      ), ch AS (
        INSERT INTO core.account_control_challenge
          (id, seller_social_account_id, code, expires_at)
        SELECT ${randomUUID()}, sa.id, ${code}, now() + interval '24 hours' FROM sa
        RETURNING id, expires_at
      )
      SELECT sa.id, ch.id AS challenge_id, ch.expires_at FROM sa, ch`.execute(trx);
    const row = r.rows[0];
    return {
      social_account_id: row?.id,
      code,
      expires_at: row?.expires_at?.toISOString(),
    };
  }

  /**
   * POST /v1/seller/social-accounts/{id}/verify — fetch and match (S7.2).
   * The follower count comes from the ADAPTER at this instant and is
   * write-once with its timestamp (S4.2: never re-evaluated retroactively;
   * the trigger enforces it). Eligibility re-evaluates in the same
   * transaction.
   */
  async verifySocialAccount(
    trx: Transaction<Database>,
    req: AuthedRequest,
    socialAccountId: string,
  ): Promise<unknown> {
    await assertPermission(trx, req, 'seller.store:write');

    const acc = await sql<{
      id: string;
      platform: 'TIKTOK' | 'INSTAGRAM';
      handle: string;
      status: string;
      code: string | null;
      challenge_id: string | null;
      expires_at: Date | null;
    }>`
      SELECT sa.id, sa.platform, sa.handle, sa.status,
             ch.code, ch.id AS challenge_id, ch.expires_at
        FROM core.seller_social_account sa
        LEFT JOIN core.account_control_challenge ch
          ON ch.seller_social_account_id = sa.id AND ch.matched_at IS NULL
       WHERE sa.id = ${socialAccountId} AND sa.seller_id = ${req.ctx?.sellerId}
       ORDER BY ch.issued_at DESC LIMIT 1`.execute(trx);

    const row = acc.rows[0];
    if (!row) throw new AdulisException('NOT_FOUND');
    if (row.status === 'VERIFIED') {
      return { status: 'VERIFIED', already: true };
    }
    if (!row.code || !row.challenge_id || (row.expires_at && row.expires_at < new Date())) {
      throw new AdulisException('VALIDATION_FAILED', {
        status: 409,
        slots: { reason: 'CHALLENGE_EXPIRED' },
      });
    }

    await sql`
      UPDATE core.account_control_challenge SET attempts = attempts + 1
       WHERE id = ${row.challenge_id}`.execute(trx);

    let profile;
    try {
      profile = await this.social.fetchProfile(row.platform, row.handle);
    } catch {
      // S13.1: a platform failure degrades to manual verification without
      // affecting the others. The manual path is operator tooling; to the
      // seller this is temporary unavailability, retryable.
      throw new AdulisException('INTERNAL', {
        status: 503,
        retryable: true,
        slots: { retry_after_seconds: 300 },
      });
    }

    if (!profile.bioContains(row.code)) {
      throw new AdulisException('VALIDATION_FAILED', {
        status: 409,
        slots: { reason: 'CODE_NOT_FOUND_IN_BIO' },
      });
    }

    await sql`
      UPDATE core.account_control_challenge SET matched_at = now()
       WHERE id = ${row.challenge_id}`.execute(trx);
    await sql`
      UPDATE core.seller_social_account
         SET status = 'VERIFIED', verified_at = now(),
             platform_account_id = ${profile.platformAccountId},
             follower_count_at_verification = ${profile.followerCount},
             follower_count_source = 'PLATFORM_FETCH'
       WHERE id = ${socialAccountId}`.execute(trx);

    const ev = await sql<{ outcome: string; reasons: string[] }>`
      SELECT (e).outcome::text AS outcome, (e).reasons AS reasons
        FROM core.fn_evaluate_eligibility(${req.ctx?.sellerId}) e`.execute(trx);

    return {
      status: 'VERIFIED',
      follower_count_at_verification: profile.followerCount,
      eligibility: { outcome: ev.rows[0]?.outcome, reasons: ev.rows[0]?.reasons ?? [] },
    };
  }

  /**
   * POST /v1/seller/identity-verification — the KYC vendor handoff
   * (section 13: verification.write_attestation; S6.5: step-up as a BODY
   * PARAMETER, action IDENTITY_CHANGE). No image ever reaches Adulis —
   * there is no field for one.
   */
  /**
   * G1.1 -- OPERATOR-ONLY. `seller.identity:manage` no longer authorises
   * writing an attestation; an operator grant does.
   *
   * Three things this method deliberately does NOT do, and each is the
   * reason the endpoint is shaped the way it is:
   *
   *  - **It does not call `fn_has_permission`.** An operator holds no
   *    seller relationship, so a seller-scoped check raises U0002 -- a
   *    404 -- before the boundary function is reached, and the caller is
   *    told the seller does not exist rather than that they may not act.
   *  - **It does not read `req.ctx.sellerId`.** The path is exempt from
   *    seller context in the guard; the subject arrives as `person_id`,
   *    because an operator attests about someone else.
   *  - **It does not create a `core.person` row.** The old body did, for
   *    an individual seller verifying themselves. An operator attesting
   *    about a person who does not exist is a mistake, not a signup.
   *
   * The gate is `write_attestation`'s own derivation from
   * `core.operator_grant`, which raises U0001 -> 403 where there is none.
   * We call it and let it raise: duplicating the check here would create a
   * second place to get it wrong and a first place to skip the log.
   */
  async identityVerification(
    trx: Transaction<Database>,
    req: AuthedRequest,
    body: IdentityVerificationBody,
  ): Promise<unknown> {
    // Step-up is RETAINED, and it is not what closes the hole. It proves
    // the person holding the phone is the account holder -- which was
    // never the question here, and is still worth having on an operator
    // session that can write identity evidence. Removing a working control
    // while closing a different one is the wrong direction.
    await sql`SELECT core.fn_assert_step_up(
      ${body.step_up_challenge_id}, ${req.ctx?.accountId},
      'IDENTITY_CHANGE')`.execute(trx);

    const attestation = await sql<{ id: string }>`
      SELECT verification.write_attestation(
        ${req.ctx?.accountId}, ${body.person_id}, ${body.verifier_kind},
        ${body.vendor_reference}, ${body.id_type}, ${body.legal_name},
        decode(${body.id_hash}, 'hex'), 1, ${body.verified_on}::date) AS id`.execute(trx);

    // No eligibility block. It named the CALLER's seller, and the caller
    // is no longer a seller -- ADU-DB-01 v1.12 S7.3 is explicit that
    // whether a new attestation re-opens eligibility "is S7.4's business,
    // evaluated by fn_evaluate_eligibility at the moment it is asked."
    // Returning a resolved eligibility here would mean finding a seller
    // from a person, which is a lookup nothing rules.
    return { attestation_id: attestation.rows[0]?.id };
  }

  /**
   * PUT /v1/seller/availability — the whole weekly pattern, informational,
   * zero windows valid (S13.1). Whole-set replace is CORRECT here, unlike
   * overrides: the pattern has no history to preserve.
   */
  async putAvailability(
    trx: Transaction<Database>,
    req: AuthedRequest,
    body: AvailabilityBody,
  ): Promise<unknown> {
    await assertPermission(trx, req, 'seller.availability:write');
    await sql`DELETE FROM core.seller_availability
               WHERE seller_id = ${req.ctx?.sellerId}`.execute(trx);
    for (const w of body.windows) {
      await sql`
        INSERT INTO core.seller_availability (id, seller_id, weekday, opens_at, closes_at)
        VALUES (${randomUUID()}, ${req.ctx?.sellerId}, ${w.weekday},
                ${w.opens_at}::time, ${w.closes_at}::time)`.execute(trx);
    }
    return { windows: body.windows.length };
  }

  /**
   * GET /v1/seller/availability (ADU-API-01 v1.9 S1 item 5, S15.0b). The PUT
   * replaced the whole set and returned only a count; the weekly editor had
   * nothing to load, so it edited a local draft that could not be reopened.
   * This returns the same shape the PUT accepts -- one row per (weekday,
   * window), several per weekday permitted, ZERO windows a valid state
   * meaning closed (S13.1). Ordered so the editor renders Monday-first
   * without sorting client-side. Read-only; `seller.store:read`, the gate the
   * overrides read beside it already uses.
   */
  async getAvailability(trx: Transaction<Database>, req: AuthedRequest): Promise<unknown> {
    await assertPermission(trx, req, 'seller.store:read');
    const r = await sql<{ weekday: number; opens_at: string; closes_at: string }>`
      SELECT weekday, opens_at::text AS opens_at, closes_at::text AS closes_at
        FROM core.seller_availability
       WHERE seller_id = ${req.ctx?.sellerId}
       ORDER BY weekday, opens_at`.execute(trx);
    return {
      windows: r.rows.map((row) => ({
        weekday: row.weekday,
        // time renders as HH:MM:SS; the PUT accepts and the editor shows HH:MM.
        opens_at: row.opens_at.slice(0, 5),
        closes_at: row.closes_at.slice(0, 5),
      })),
    };
  }

  /**
   * GET /v1/seller/social-accounts (ADU-API-01 v1.9 S1 item 6, S15.0b). SC-22
   * could show a follower count only for the session that witnessed the
   * verify response. The count and the moment it was taken ALREADY persist:
   * `follower_count_at_verification` and `verified_at` on
   * core.seller_social_account, write-once (0005 S7.2 trigger), superseded by
   * a fresh row on re-verification. So R24's "as of <date>" renders from
   * `captured_at` here, and the v1.9 note that these columns are owed to
   * ADU-DB-01 v1.17 is stale against the installed v1.16 -- reported, no
   * migration. Wire names follow S15.0b (`follower_count`, `captured_at`);
   * the columns keep their at-verification names. Read-only; `seller.store:read`.
   */
  async getSocialAccounts(trx: Transaction<Database>, req: AuthedRequest): Promise<unknown> {
    await assertPermission(trx, req, 'seller.store:read');
    const r = await sql<{
      id: string;
      platform: string;
      handle: string;
      status: string;
      follower_count: number | null;
      captured_at: Date | null;
      follower_count_source: string | null;
    }>`
      SELECT id, platform, handle, status,
             follower_count_at_verification AS follower_count,
             verified_at                    AS captured_at,
             follower_count_source
        FROM core.seller_social_account
       WHERE seller_id = ${req.ctx?.sellerId}
       ORDER BY created_at`.execute(trx);
    return {
      accounts: r.rows.map((row) => ({
        id: row.id,
        platform: row.platform,
        handle: row.handle,
        status: row.status,
        follower_count: row.follower_count,
        captured_at: row.captured_at?.toISOString() ?? null,
        follower_count_source: row.follower_count_source,
      })),
    };
  }

  /** GET /v1/seller/availability-overrides — ascending, from today. */
  async getOverrides(
    trx: Transaction<Database>,
    req: AuthedRequest,
    from: string | undefined,
    limit: number,
  ): Promise<unknown> {
    await assertPermission(trx, req, 'seller.store:read');
    const r = await sql<{ override_date: string; note: string | null }>`
      SELECT override_date::text, note
        FROM core.seller_availability_override
       WHERE seller_id = ${req.ctx?.sellerId}
         AND override_date >= coalesce(${from ?? null}::date, CURRENT_DATE)
       ORDER BY override_date ASC
       LIMIT ${limit + 1}`.execute(trx);
    const page = r.rows.slice(0, limit);
    return {
      data: page.map((row) => ({ date: row.override_date, note: row.note })),
      has_more: r.rows.length > limit,
      next_cursor: r.rows.length > limit ? page[page.length - 1]?.override_date : null,
    };
  }

  /** PUT /v1/seller/availability-overrides/{date} — idempotent by path. */
  async putOverride(
    trx: Transaction<Database>,
    req: AuthedRequest,
    date: string,
    note: string | undefined,
  ): Promise<unknown> {
    await assertPermission(trx, req, 'seller.availability:write');
    await sql`
      INSERT INTO core.seller_availability_override (seller_id, override_date, note)
      VALUES (${req.ctx?.sellerId}, ${date}::date, ${note ?? null})
      ON CONFLICT (seller_id, override_date)
      DO UPDATE SET note = EXCLUDED.note`.execute(trx);
    return { date, note: note ?? null };
  }

  /** DELETE — 204 whether or not it existed. */
  async deleteOverride(
    trx: Transaction<Database>,
    req: AuthedRequest,
    date: string,
  ): Promise<void> {
    await assertPermission(trx, req, 'seller.availability:write');
    await sql`
      DELETE FROM core.seller_availability_override
       WHERE seller_id = ${req.ctx?.sellerId} AND override_date = ${date}::date`.execute(trx);
  }

  /** PATCH /v1/seller/company-details — upsert; satisfies COMPANY_DETAILS. */
  async patchCompanyDetails(
    trx: Transaction<Database>,
    req: AuthedRequest,
    body: CompanyDetailsBody,
  ): Promise<unknown> {
    await assertPermission(trx, req, 'seller.store:write');
    /*
     * THE REPRESENTATIVE IS RESOLVED BEFORE ANYTHING IS WRITTEN
     * (T26 Phase 1 ruling; register D-361).
     *
     * `representative_person_id` arrives in the BODY and was written straight
     * through. Two consequences, and the second is not an oracle at all.
     *
     * (1) Every 23503 was mapped to SELLER_NOT_COMPANY, so an existing person
     *     id answered 200 and a nonexistent one answered 409 -- an existence
     *     probe over core.person, keyed on a value the caller supplies.
     *
     * (2) The one that matters: `core.fn_seller_attestation_person` (0018)
     *     returns THIS COLUMN for a COMPANY seller, and
     *     `fn_evaluate_eligibility` then asks
     *     `verification.has_attestation(v_person)`. A company seller could
     *     therefore name a natural person belonging to ANOTHER store and
     *     satisfy IDENTITY_ATTESTATION_REQUIRED on that person's verification.
     *     Not a probe -- a committed read-through of somebody else's identity
     *     evidence, on the gate identity verification exists to hold.
     *
     * WHAT THE CHECK CAN HONESTLY BE. Nothing in the product creates a
     * `core.person` row for a company's representative: `createSeller` mints
     * one only for an INDIVIDUAL seller, and the operator attestation path
     * explicitly does not ("an operator attesting about a person who does not
     * exist is a mistake, not a signup"). So the only person ids that exist
     * belong to individual sellers, and the narrowest resolution that invents
     * no new rule is: the representative must be a natural person THIS ACCOUNT
     * already holds. Where a company's representative person is supposed to
     * come from is a gap, and D-361 reports it rather than filling it in.
     */
    const person = await sql<{ person_id: string }>`
      SELECT s.person_id FROM core.seller s
       WHERE s.owner_account_id = ${req.ctx?.accountId}
         AND s.person_id = ${body.representative_person_id}
       LIMIT 1`.execute(trx);
    if (!person.rows[0]) {
      // The same answer for a person that does not exist and one this account
      // may not name: S19's rule, applied to a body parameter.
      throw new AdulisException('NOT_FOUND');
    }
    try {
      await sql`
        INSERT INTO core.seller_company_detail
          (seller_id, entity_type, registration_identifier, trade_licence_number,
           tin, representative_person_id, representative_relationship)
        VALUES (${req.ctx?.sellerId}, 'COMPANY', ${body.registration_identifier},
                ${body.trade_licence_number}, ${body.tin},
                ${body.representative_person_id}, ${body.representative_relationship})
        ON CONFLICT (seller_id) DO UPDATE SET
          registration_identifier = EXCLUDED.registration_identifier,
          trade_licence_number = EXCLUDED.trade_licence_number,
          tin = EXCLUDED.tin,
          representative_person_id = EXCLUDED.representative_person_id,
          representative_relationship = EXCLUDED.representative_relationship`.execute(trx);
    } catch (e) {
      // The composite FK (seller_id, entity_type): a company row cannot
      // attach to an individual seller — structurally (S7.1).
      if ((e as { code?: string }).code === '23503') {
        throw new AdulisException('VALIDATION_FAILED', {
          status: 409,
          slots: { reason: 'SELLER_NOT_COMPANY' },
        });
      }
      throw e;
    }
    return { updated: true };
  }

  /** GET /v1/seller/fulfilment-methods */
  async getFulfilmentMethods(trx: Transaction<Database>, req: AuthedRequest): Promise<unknown> {
    await assertPermission(trx, req, 'seller.store:read');
    const r = await sql<{ method: string; handoff_note: string | null; is_active: boolean }>`
      SELECT method::text, handoff_note, is_active
        FROM core.seller_fulfilment_method
       WHERE seller_id = ${req.ctx?.sellerId}
       ORDER BY method`.execute(trx);
    return { methods: r.rows };
  }

  /**
   * PUT /v1/seller/fulfilment-methods — the whole set; at least one active
   * or 422 FULFILMENT_METHOD_REQUIRED (section 12.9). Refused BEFORE the
   * write: a seller must never pass through a zero-method state.
   */
  async putFulfilmentMethods(
    trx: Transaction<Database>,
    req: AuthedRequest,
    body: FulfilmentMethodsBody,
  ): Promise<unknown> {
    await assertPermission(trx, req, 'seller.fulfilment:write');
    if (!body.methods.some((m) => m.is_active)) {
      throw new AdulisException('FULFILMENT_METHOD_REQUIRED');
    }
    await sql`DELETE FROM core.seller_fulfilment_method
               WHERE seller_id = ${req.ctx?.sellerId}`.execute(trx);
    for (const m of body.methods) {
      await sql`
        INSERT INTO core.seller_fulfilment_method (seller_id, method, handoff_note, is_active)
        VALUES (${req.ctx?.sellerId}, ${m.method}, ${m.handoff_note ?? null},
                ${m.is_active})`.execute(trx);
    }
    return { methods: body.methods.length };
  }
}

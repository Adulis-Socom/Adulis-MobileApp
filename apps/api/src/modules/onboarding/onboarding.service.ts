import { Inject, Injectable } from '@nestjs/common';
import { randomUUID, createHash } from 'node:crypto';
import { sql, type Transaction } from 'kysely';
import type { Database } from '../../common/db/database.types';
import type { AuthedRequest } from '../../common/auth/auth.guard';
import { assertPermission } from '../../common/auth/permission';
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
    try {
      const seller = await sql<{ id: string }>`
        INSERT INTO core.seller
          (id, market_id, owner_account_id, entity_type, store_name, handle,
           description, category_id, status)
        SELECT ${randomUUID()}, a.market_id, a.id, ${body.entity_type},
               ${body.store_name}, ${body.handle},
               ${body.description ?? null}, ${body.category_id ?? null}, 'DRAFT'
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
  async identityVerification(
    trx: Transaction<Database>,
    req: AuthedRequest,
    body: IdentityVerificationBody,
  ): Promise<unknown> {
    await assertPermission(trx, req, 'seller.identity:manage');
    await sql`SELECT core.fn_assert_step_up(
      ${body.step_up_challenge_id}, ${req.ctx?.accountId},
      'IDENTITY_CHANGE')`.execute(trx);

    // The attested person: the individual seller's own person row (created
    // here on first verification), or the company's REPRESENTATIVE, who
    // must already be named in company details (S7.1 - the attestation is
    // about the person, and declaring "company" changes whom it is about).
    let person = (
      await sql<{ id: string | null }>`
        SELECT core.fn_seller_attestation_person(${req.ctx?.sellerId}) AS id`.execute(trx)
    ).rows[0]?.id;

    if (!person) {
      const entity = (
        await sql<{ entity_type: string }>`
          SELECT entity_type FROM core.seller WHERE id = ${req.ctx?.sellerId}`.execute(trx)
      ).rows[0]?.entity_type;
      if (entity === 'COMPANY') {
        throw new AdulisException('VALIDATION_FAILED', {
          status: 409,
          slots: { reason: 'COMPANY_DETAILS_FIRST' },
        });
      }
      person = (
        await sql<{ id: string }>`
          INSERT INTO core.person (id) VALUES (${randomUUID()}) RETURNING id`.execute(trx)
      ).rows[0]?.id as string;
      await sql`
        UPDATE core.seller SET person_id = ${person}
         WHERE id = ${req.ctx?.sellerId}`.execute(trx);
    }

    const attestation = await sql<{ id: string }>`
      SELECT verification.write_attestation(
        ${person}, ${body.verifier_kind}, ${body.vendor_reference},
        ${body.id_type}, ${body.legal_name},
        decode(${body.id_hash}, 'hex'), 1, ${body.verified_on}::date) AS id`.execute(trx);

    const ev = await sql<{ outcome: string; reasons: string[] }>`
      SELECT (e).outcome::text AS outcome, (e).reasons AS reasons
        FROM core.fn_evaluate_eligibility(${req.ctx?.sellerId}) e`.execute(trx);

    return {
      attestation_id: attestation.rows[0]?.id,
      eligibility: { outcome: ev.rows[0]?.outcome, reasons: ev.rows[0]?.reasons ?? [] },
    };
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

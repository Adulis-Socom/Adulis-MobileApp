import {
  Controller,
  Delete,
  Get,
  HttpCode,
  Param,
  Patch,
  Post,
  Put,
  Query,
  Req,
  Res,
} from '@nestjs/common';
import { ApiOperation } from '@nestjs/swagger';
import type { Response } from 'express';
import type { Transaction } from 'kysely';
import { HandlerTransaction } from '../../common/db/handler-transaction';
import type { Database } from '../../common/db/database.types';
import type { LocalizedRequest } from '../../common/http/locale.middleware';
import { AdulisException } from '../../common/errors/adulis-exception';
import { OnboardingService } from './onboarding.service';
import {
  availabilityBody,
  companyDetailsBody,
  createSellerBody,
  fulfilmentMethodsBody,
  identityVerificationBody,
  overridePutBody,
  patchProfileBody,
  socialAccountBody,
} from './onboarding.schemas';

/**
 * C1 — onboarding and verification (ADU-API-01 v1.6 section 12.9).
 *
 * Controllers parse (Zod, at the door) and route through
 * HandlerTransaction; the service holds the one-function-call bodies; the
 * pipeline holds everything else. Idempotency keys are demanded by
 * runIdempotent on every state-changing POST; PUT and DELETE on overrides
 * carry none, deliberately — idempotent by path is not an exemption from
 * S8, it is S8's own reasoning applied (the section says so verbatim).
 */

const ISO_DATE = /^\d{4}-\d{2}-\d{2}$/;

@Controller()
export class OnboardingController {
  constructor(
    private readonly tx: HandlerTransaction,
    private readonly svc: OnboardingService,
  ) {}

  @Post('seller')
  @ApiOperation({ summary: 'Create the seller. The first eligibility evaluation runs inline.' })
  async createSeller(
    @Req() req: LocalizedRequest,
    @Res({ passthrough: true }) res: Response,
  ): Promise<unknown> {
    const body = createSellerBody.parse(req.body);
    return this.tx.runIdempotent(req, res, 201, (trx: Transaction<Database>) =>
      this.svc.createSeller(trx, req, body),
    );
  }

  @Get('seller/readiness')
  @ApiOperation({ summary: 'The nine readiness items — a state, not a failure.' })
  async readiness(@Req() req: LocalizedRequest): Promise<unknown> {
    return this.tx.run(req, (trx) => this.svc.readiness(trx, req));
  }

  @Patch('seller/profile')
  async patchProfile(@Req() req: LocalizedRequest): Promise<unknown> {
    const body = patchProfileBody.parse(req.body);
    return this.tx.run(req, (trx) => this.svc.patchProfile(trx, req, body));
  }

  @Post('seller/social-accounts')
  @ApiOperation({ summary: 'Link a social account; issues the account-control code.' })
  async createSocialAccount(
    @Req() req: LocalizedRequest,
    @Res({ passthrough: true }) res: Response,
  ): Promise<unknown> {
    const body = socialAccountBody.parse(req.body);
    return this.tx.runIdempotent(req, res, 201, (trx) =>
      this.svc.createSocialAccount(trx, req, body),
    );
  }

  @Post('seller/social-accounts/:id/verify')
  @ApiOperation({ summary: 'Fetch and match; captures the follower count at verification.' })
  async verifySocialAccount(
    @Req() req: LocalizedRequest,
    @Res({ passthrough: true }) res: Response,
    @Param('id') id: string,
  ): Promise<unknown> {
    return this.tx.runIdempotent(req, res, 200, (trx) =>
      this.svc.verifySocialAccount(trx, req, id),
    );
  }

  @Post('seller/identity-verification')
  @ApiOperation({ summary: 'KYC vendor handoff. No image ever reaches Adulis.' })
  async identityVerification(
    @Req() req: LocalizedRequest,
    @Res({ passthrough: true }) res: Response,
  ): Promise<unknown> {
    const body = identityVerificationBody.parse(req.body);
    return this.tx.runIdempotent(req, res, 201, (trx) =>
      this.svc.identityVerification(trx, req, body),
    );
  }

  @Put('seller/availability')
  @ApiOperation({ summary: 'The whole weekly pattern. Zero windows is valid and means closed.' })
  async putAvailability(@Req() req: LocalizedRequest): Promise<unknown> {
    const body = availabilityBody.parse(req.body);
    return this.tx.run(req, (trx) => this.svc.putAvailability(trx, req, body));
  }

  @Get('seller/availability-overrides')
  async getOverrides(
    @Req() req: LocalizedRequest,
    @Query('from') from?: string,
    @Query('limit') limitRaw?: string,
  ): Promise<unknown> {
    if (from !== undefined && !ISO_DATE.test(from)) {
      throw new AdulisException('VALIDATION_FAILED', { slots: { path: 'from' } });
    }
    const limit = Math.min(Math.max(Number(limitRaw ?? 20) || 20, 1), 50);
    return this.tx.run(req, (trx) => this.svc.getOverrides(trx, req, from, limit));
  }

  @Put('seller/availability-overrides/:date')
  @ApiOperation({ summary: 'Marks the store closed on that date. Idempotent by path; no key.' })
  async putOverride(
    @Req() req: LocalizedRequest,
    @Param('date') date: string,
  ): Promise<unknown> {
    this.assertOverrideDate(date);
    const body = overridePutBody.parse(req.body ?? {});
    return this.tx.run(req, (trx) => this.svc.putOverride(trx, req, date, body.note));
  }

  @Delete('seller/availability-overrides/:date')
  @HttpCode(204)
  @ApiOperation({ summary: 'Removes the closure. 204 whether or not it existed.' })
  async deleteOverride(
    @Req() req: LocalizedRequest,
    @Param('date') date: string,
  ): Promise<void> {
    this.assertOverrideDate(date);
    await this.tx.run(req, (trx) => this.svc.deleteOverride(trx, req, date));
  }

  @Patch('seller/company-details')
  async patchCompanyDetails(@Req() req: LocalizedRequest): Promise<unknown> {
    const body = companyDetailsBody.parse(req.body);
    return this.tx.run(req, (trx) => this.svc.patchCompanyDetails(trx, req, body));
  }

  @Get('seller/fulfilment-methods')
  async getFulfilmentMethods(@Req() req: LocalizedRequest): Promise<unknown> {
    return this.tx.run(req, (trx) => this.svc.getFulfilmentMethods(trx, req));
  }

  @Put('seller/fulfilment-methods')
  @ApiOperation({ summary: 'The whole set. At least one active, or 422.' })
  async putFulfilmentMethods(@Req() req: LocalizedRequest): Promise<unknown> {
    const body = fulfilmentMethodsBody.parse(req.body);
    return this.tx.run(req, (trx) => this.svc.putFulfilmentMethods(trx, req, body));
  }

  /**
   * {date} is an ISO calendar date in the MARKET's timezone; a PUT more
   * than 24 months ahead is VALIDATION_FAILED at the edge — not a new
   * code, a date sanity check (section 12.9: a client bug must not write
   * year 9999 into a table nobody purges).
   */
  private assertOverrideDate(date: string): void {
    if (!ISO_DATE.test(date)) {
      throw new AdulisException('VALIDATION_FAILED', { slots: { path: 'date' } });
    }
    const parsed = new Date(`${date}T00:00:00Z`);
    if (Number.isNaN(parsed.getTime())) {
      throw new AdulisException('VALIDATION_FAILED', { slots: { path: 'date' } });
    }
    const limit = new Date();
    limit.setUTCMonth(limit.getUTCMonth() + 24);
    if (parsed > limit) {
      throw new AdulisException('VALIDATION_FAILED', {
        slots: { path: 'date', reason: 'TOO_FAR_AHEAD' },
      });
    }
  }
}

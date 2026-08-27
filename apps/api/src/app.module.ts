import { Module } from '@nestjs/common';
import { APP_FILTER, APP_GUARD } from '@nestjs/core';
import type { Logger } from 'pino';
import { DatabaseModule } from './common/db/database.module';
import { HandlerTransaction } from './common/db/handler-transaction';
import { HealthController } from './health.controller';
import { AuthGuard } from './common/auth/auth.guard';
import { SessionService } from './common/auth/session.service';
import { ProblemDetailsFilter } from './common/errors/problem-details.filter';
import { IdempotencyService } from './common/idempotency/idempotency';
import { RateLimitService } from './common/rate-limit/rate-limit.service';
import { BootstrapController } from './modules/bootstrap/bootstrap.controller';
import { OnboardingController } from './modules/onboarding/onboarding.controller';
import { OnboardingService } from './modules/onboarding/onboarding.service';
import {
  FakeSocialPlatformAdapter,
  SOCIAL_PLATFORM_ADAPTER,
} from './modules/onboarding/social-platform.adapter';
import { CatalogueController } from './modules/catalogue/catalogue.controller';
import { OrdersController } from './modules/orders/orders.controller';
import { FinancialController } from './modules/financial/financial.controller';
import { HandoffController } from './modules/handoff/handoff.controller';
import { HandoffService } from './modules/handoff/handoff.service';
import { FinancialService } from './modules/financial/financial.service';
import {
  FakeFinancialStorageAdapter,
  FINANCIAL_STORAGE_ADAPTER,
} from './modules/financial/financial-storage.adapter';
import { OrdersService } from './modules/orders/orders.service';
import { CatalogueService } from './modules/catalogue/catalogue.service';
import {
  FakeMediaStorageAdapter,
  MEDIA_STORAGE_ADAPTER,
} from './modules/catalogue/media-storage.adapter';
import {
  FakePostLinkAdapter,
  POST_LINK_ADAPTER,
} from './modules/catalogue/post-link.adapter';
import { AuthController } from './modules/auth/auth.controller';
import { AuthService } from './modules/auth/auth.service';
import { OtpService } from './modules/auth/otp.service';
import { FakeSmsAdapter, SMS_ADAPTER } from './modules/auth/sms.adapter';
import { DeletionController } from './modules/deletion/deletion.controller';
import { DeletionService } from './modules/deletion/deletion.service';
import { TeamController } from './modules/team/team.controller';
import { TeamService } from './modules/team/team.service';
import { CouriersController } from './modules/couriers/couriers.controller';
import { BillingController } from './modules/billing/billing.controller';
import { createLogger } from './common/logging';

/** Injection token for the process-wide pino logger. */
export const LOGGER = Symbol('LOGGER');

/**
 * TIER 3 — the request pipeline (ADU-CON-02 v3.0 section 5):
 *
 *   request id → body limit → CORS + Origin → locale → AUTHENTICATE (one
 *   session read, global guard — an unmarked route fails closed) → seller
 *   context → rate limit → idempotency → handler (transaction, settings,
 *   one function call) → error mapper → response headers.
 *
 * The express-level stages (request id, body limit, Origin, locale, CORS)
 * are wired in main.ts, where express middleware lives; the Nest-level
 * stages are wired here. Endpoint modules register from Tier 4 onward and
 * consume HandlerTransaction — the one place set_config and the
 * idempotency record happen.
 */
@Module({
  imports: [DatabaseModule],
  controllers: [HealthController, BootstrapController, OnboardingController, CatalogueController, OrdersController, FinancialController, HandoffController, AuthController, DeletionController, TeamController, CouriersController, BillingController],
  providers: [
    { provide: LOGGER, useFactory: (): Logger => createLogger() },
    SessionService,
    IdempotencyService,
    OnboardingService,
    // The platform adapters are deployment integrations (like SMS); locally
    // and under test the fake binds, and the specs configure it per case.
    // Production binds real adapters here by environment when they exist.
    { provide: SOCIAL_PLATFORM_ADAPTER, useValue: new FakeSocialPlatformAdapter() },
    CatalogueService,
    OrdersService,
    FinancialService,
    HandoffService,
    OtpService,
    AuthService,
    DeletionService,
    TeamService,
    { provide: SMS_ADAPTER, useValue: new FakeSmsAdapter() },
    { provide: FINANCIAL_STORAGE_ADAPTER, useValue: new FakeFinancialStorageAdapter() },
    { provide: MEDIA_STORAGE_ADAPTER, useValue: new FakeMediaStorageAdapter() },
    { provide: POST_LINK_ADAPTER, useValue: new FakePostLinkAdapter() },
    RateLimitService,
    HandlerTransaction,
    { provide: APP_GUARD, useClass: AuthGuard },
    {
      provide: APP_FILTER,
      inject: [LOGGER],
      useFactory: (log: Logger): ProblemDetailsFilter => new ProblemDetailsFilter(log),
    },
  ],
  // The pipeline services every endpoint module consumes from Tier 4 on.
  exports: [LOGGER, HandlerTransaction, RateLimitService, IdempotencyService, SessionService],
})
export class AppModule {}

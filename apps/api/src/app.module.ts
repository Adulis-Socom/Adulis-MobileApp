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
import { CatalogueService } from './modules/catalogue/catalogue.service';
import {
  FakeMediaStorageAdapter,
  MEDIA_STORAGE_ADAPTER,
} from './modules/catalogue/media-storage.adapter';
import {
  FakePostLinkAdapter,
  POST_LINK_ADAPTER,
} from './modules/catalogue/post-link.adapter';
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
  controllers: [HealthController, BootstrapController, OnboardingController, CatalogueController],
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

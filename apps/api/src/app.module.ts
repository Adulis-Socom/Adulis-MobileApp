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
  NullSocialPlatformAdapter,
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
  NullPostLinkAdapter,
  POST_LINK_ADAPTER,
} from './modules/catalogue/post-link.adapter';
import { AuthController } from './modules/auth/auth.controller';
import { AuthService } from './modules/auth/auth.service';
import { OtpService } from './modules/auth/otp.service';
import { FakeSmsAdapter, SMS_ADAPTER, type SmsAdapter } from './modules/auth/sms.adapter';
import { FakeSmsProviderSet, SMS_PROVIDERS } from './modules/auth/sms-provider';
import { SmsProviderRouter } from './modules/auth/sms-provider.router';
import { OtpDeliveryService } from './modules/auth/otp-delivery.service';
import { OtpIssuancePolicy } from './modules/auth/otp-issuance.policy';
import { DeletionController } from './modules/deletion/deletion.controller';
import { DeletionService } from './modules/deletion/deletion.service';
import { TeamController } from './modules/team/team.controller';
import { TeamService } from './modules/team/team.service';
import { CouriersController } from './modules/couriers/couriers.controller';
import { BillingController } from './modules/billing/billing.controller';
import { OwnershipController } from './modules/ownership/ownership.controller';
import { ChatController } from './modules/chat/chat.controller';
import { ChatService } from './modules/chat/chat.service';
import { INFERENCE_ADAPTER, NullInferenceAdapter } from './modules/chat/inference.adapter';
import { ClaimsController } from './modules/claims/claims.controller';
import { ClaimsService } from './modules/claims/claims.service';
import { ReviewsController } from './modules/reviews/reviews.controller';
import { AnalyticsController } from './modules/analytics/analytics.controller';
import { NotificationsController } from './modules/notifications/notifications.controller';
import { ReportsController } from './modules/reports/reports.controller';
import { StorefrontController } from './modules/storefront/storefront.controller';
import { ObligationsController } from './modules/obligations/obligations.controller';
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
  controllers: [HealthController, BootstrapController, OnboardingController, CatalogueController, OrdersController, FinancialController, HandoffController, AuthController, DeletionController, TeamController, OwnershipController, CouriersController, BillingController, ChatController, ClaimsController, ReviewsController, AnalyticsController, NotificationsController, ReportsController, StorefrontController, ObligationsController],
  providers: [
    { provide: LOGGER, useFactory: (): Logger => createLogger() },
    SessionService,
    IdempotencyService,
    OnboardingService,
    // The platform adapters are deployment integrations (like SMS); locally
    // and under test the fake binds, and the specs configure it per case.
    // Production binds real adapters here by environment when they exist.
    { provide: SOCIAL_PLATFORM_ADAPTER, useValue: new NullSocialPlatformAdapter() },
    CatalogueService,
    OrdersService,
    FinancialService,
    HandoffService,
    OtpService,
    AuthService,
    DeletionService,
    TeamService,
    // Notifications (E2, E6) still transport through the plain adapter: they
    // carry no challenge, so there is no delivery attempt to record and no
    // failover rule that applies to them. OTP is what has a ledger.
    { provide: SMS_ADAPTER, useValue: new FakeSmsAdapter() },
    /**
     * The four fakes v2.6 S6 names as initial implementations. EVERY ONE IS
     * A FAKE and each refuses to construct under NODE_ENV=production --
     * AfroMessage, SMSEthiopia, Infobip and Twilio all require a registered
     * business, which is blocked, so the interface is what is buildable now.
     * Binding a real vendor is a change to this line, not to the layer.
     */
    {
      provide: SMS_PROVIDERS,
      // THROUGH DI, not `new FakeSmsProviderSet()`: a suite that overrides
      // SMS_ADAPTER must have its own adapter receive what the fake vendors
      // transport, or every existing OTP test reads an adapter nothing wrote
      // to. Same reason development reads its code out of the dev SMS log.
      inject: [SMS_ADAPTER],
      useFactory: (sms: SmsAdapter): FakeSmsProviderSet =>
        new FakeSmsProviderSet(sms),
    },
    SmsProviderRouter,
    OtpDeliveryService,
    OtpIssuancePolicy,
    ChatService,
    ClaimsService,
    // Layers 3-4 of the cascade are a deployment integration; Null answers
    // nothing and everything above layer 2 escalates (S15.1's degradation).
    { provide: INFERENCE_ADAPTER, useValue: new NullInferenceAdapter() },
    { provide: FINANCIAL_STORAGE_ADAPTER, useValue: new FakeFinancialStorageAdapter() },
    { provide: MEDIA_STORAGE_ADAPTER, useValue: new FakeMediaStorageAdapter() },
    { provide: POST_LINK_ADAPTER, useValue: new NullPostLinkAdapter() },
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

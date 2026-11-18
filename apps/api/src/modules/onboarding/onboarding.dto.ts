import { ApiProperty } from '@nestjs/swagger';

/** One store the caller owns or is a live team member of (GET /v1/seller/list). */
export class SellerListItemDto {
  @ApiProperty({ format: 'uuid' }) id!: string;
  @ApiProperty() handle!: string;
  @ApiProperty() store_name!: string;
  @ApiProperty({ description: 'The store status, e.g. DRAFT, ACTIVE, CLOSING, SUSPENDED. A store in any state except DELETED is listed.' }) status!: string;
  @ApiProperty({ description: 'The caller\'s role in the store: OWNER, or the team role of the membership.' }) role!: string;
  @ApiProperty({ format: 'date-time' }) created_at!: string;
}

export class SellerListDto {
  @ApiProperty({ type: [SellerListItemDto], description: 'Ordered by creation time, oldest first.' }) data!: SellerListItemDto[];
}

export class SellerEligibilityDto {
  @ApiProperty({ description: 'The outcome of the first eligibility evaluation.' }) outcome!: string;
  @ApiProperty({ type: [String] }) reasons!: string[];
}

/** POST /v1/seller. */
export class SellerCreatedDto {
  @ApiProperty({ format: 'uuid' }) seller_id!: string;
  @ApiProperty({ enum: ['DRAFT'] }) status!: 'DRAFT';
  @ApiProperty({ type: SellerEligibilityDto }) eligibility!: SellerEligibilityDto;
}

export class ReadinessResolvingActionDto {
  @ApiProperty({ description: 'A stable key the client localises.' }) kind!: string;
}

export class ReadinessItemDto {
  @ApiProperty({ description: 'The readiness item.' }) code!: string;
  @ApiProperty({ enum: ['READINESS_ITEM'] }) kind!: 'READINESS_ITEM';
  @ApiProperty() satisfied!: boolean;
  @ApiProperty({ type: ReadinessResolvingActionDto, required: false, description: 'What the seller can do to satisfy the item; absent when nothing is open.' })
  resolving_action?: ReadinessResolvingActionDto;
}

/** GET /v1/seller/readiness: a state, not a failure. */
export class ReadinessDto {
  @ApiProperty({ type: [ReadinessItemDto] }) items!: ReadinessItemDto[];
}

/** GET /v1/seller/profile. */
export class SellerProfileDto {
  @ApiProperty() handle!: string;
  @ApiProperty() store_name!: string;
  @ApiProperty({ type: String, nullable: true }) description!: string | null;
  @ApiProperty({ type: String, format: 'uuid', nullable: true }) category_id!: string | null;
  @ApiProperty({ description: 'The entity type the store was created with.' }) entity_type!: string;
  @ApiProperty({ description: 'The store status, e.g. DRAFT, ACTIVE, CLOSING.' }) status!: string;
}

export class SocialAccountDto {
  @ApiProperty({ format: 'uuid' }) id!: string;
  @ApiProperty() platform!: string;
  @ApiProperty() handle!: string;
  @ApiProperty({ description: 'The verification status.' }) status!: string;
  @ApiProperty({ type: 'integer', nullable: true, description: 'Captured once, at verification.' }) follower_count!: number | null;
  @ApiProperty({ type: String, format: 'date-time', nullable: true, description: 'When the follower count was captured.' }) captured_at!: string | null;
  @ApiProperty({ type: String, nullable: true }) follower_count_source!: string | null;
}

/** GET /v1/seller/social-accounts. */
export class SocialAccountListDto {
  @ApiProperty({ type: [SocialAccountDto] }) accounts!: SocialAccountDto[];
}

/** POST /v1/seller/social-accounts: the account-control code goes into the account's public bio. */
export class SocialAccountLinkedDto {
  @ApiProperty({ format: 'uuid' }) social_account_id!: string;
  @ApiProperty() code!: string;
  @ApiProperty({ format: 'date-time' }) expires_at!: string;
}

/** POST /v1/seller/identity-verification. */
export class AttestationRecordedDto {
  @ApiProperty({ format: 'uuid' }) attestation_id!: string;
}

export class AvailabilityWindowDto {
  @ApiProperty({ type: 'integer', description: 'Day of the week as the database numbers it.' }) weekday!: number;
  @ApiProperty({ description: 'HH:MM' }) opens_at!: string;
  @ApiProperty({ description: 'HH:MM' }) closes_at!: string;
}

/** GET /v1/seller/availability: the weekly pattern. */
export class AvailabilityDto {
  @ApiProperty({ type: [AvailabilityWindowDto] }) windows!: AvailabilityWindowDto[];
}

/** PUT /v1/seller/availability. */
export class AvailabilitySavedDto {
  @ApiProperty({ type: 'integer', description: 'How many windows were saved.' }) windows!: number;
}

export class AvailabilityOverrideDto {
  @ApiProperty({ format: 'date', description: 'YYYY-MM-DD' }) date!: string;
  @ApiProperty({ type: String, nullable: true }) note!: string | null;
}

/** GET /v1/seller/availability-overrides. */
export class AvailabilityOverridePageDto {
  @ApiProperty({ type: [AvailabilityOverrideDto] }) data!: AvailabilityOverrideDto[];
  @ApiProperty() has_more!: boolean;
  @ApiProperty({ type: String, nullable: true, description: 'The date to pass as `from` for the next page; null on the last page.' }) next_cursor!: string | null;
}

export class FulfilmentMethodDto {
  @ApiProperty() method!: string;
  @ApiProperty({ type: String, nullable: true }) handoff_note!: string | null;
  @ApiProperty() is_active!: boolean;
}

/** GET /v1/seller/fulfilment-methods. */
export class FulfilmentMethodListDto {
  @ApiProperty({ type: [FulfilmentMethodDto] }) methods!: FulfilmentMethodDto[];
}

/** PUT /v1/seller/fulfilment-methods. */
export class FulfilmentMethodsSavedDto {
  @ApiProperty({ type: 'integer', description: 'How many methods were saved.' }) methods!: number;
}

import { ApiProperty } from '@nestjs/swagger';
import { NODE_ENVS, type NodeEnv } from '../../common/env';

/**
 * GET /v1/bootstrap's response, decorated for the generated contract
 * (ADU-CON-02 section 11: NestJS decorators -> openapi.json -> typed client
 * -> Prism mock; the front end is never blocked on the back end).
 *
 * The wire rules of ADU-API-01 section 14 hold everywhere: timestamps are
 * RFC 3339 UTC strings, money would be { amount_minor, currency }, and
 * nothing here is pre-formatted text.
 */
export class BootstrapMarketDto {
  @ApiProperty({ example: 'ET' })
  code!: string;

  @ApiProperty({ example: 'ETB' })
  display_currency!: string;

  @ApiProperty({ example: 'Africa/Addis_Ababa' })
  timezone!: string;
}

export class ModeAvailabilityDto {
  @ApiProperty() available!: boolean;
}

/**
 * Which Mobile modes the signed-in Account may enter (WO-API-001A; R-18,
 * R-21; founder ruling F). DERIVED BY THE SERVER from canonical relationships
 * on every bootstrap; nothing a client sends can set it. Availability is not
 * authorisation: every request is still checked on its own.
 */
export class AccountContextDto {
  @ApiProperty({
    type: ModeAvailabilityDto,
    description: 'Inherent to an active ordinary Account (R-23). No Buyer role or profile is consulted.',
  })
  buyer!: ModeAvailabilityDto;

  @ApiProperty({
    type: ModeAvailabilityDto,
    description:
      'True when the Account owns a non-deleted Seller or holds an unsuspended, unrevoked team ' +
      'membership of one (the D-97 relationship GET /v1/seller/list returns), AND that role holds ' +
      'at least one permission whose surfaces include MOBILE. GET /v1/seller/list names the Sellers.',
  })
  seller_companion!: ModeAvailabilityDto;

  @ApiProperty({
    type: ModeAvailabilityDto,
    description:
      'Always false until WO-API-001B defines Courier MOBILE authorisation (fail closed). A ' +
      'seller_courier relationship alone does not make Courier mode available.',
  })
  courier!: ModeAvailabilityDto;
}

export class BootstrapResponseDto {
  @ApiProperty({ format: 'date-time', description: 'The A5 clock-offset reference.' })
  server_time!: string;

  @ApiProperty({ example: '1.4.0' })
  min_supported_client!: string;

  @ApiProperty({ enum: ['OK', 'UPGRADE_RECOMMENDED', 'UPGRADE_REQUIRED'] })
  client_status!: 'OK' | 'UPGRADE_RECOMMENDED' | 'UPGRADE_REQUIRED';

  @ApiProperty({ type: BootstrapMarketDto })
  market!: BootstrapMarketDto;

  @ApiProperty({ type: [String], example: ['en', 'am'] })
  locales!: string[];

  @ApiProperty({ type: 'object', additionalProperties: { type: 'boolean' } })
  feature_flags!: Record<string, boolean>;

  // T20 S4 -- the public origin every client joins an image key against.
  // The API returns bare object keys (payload budget, S9); the storage origin
  // is server config, so one place owns it and every surface builds the same
  // URL as `${media_public_origin}/${key}`. Empty string when object storage
  // is not configured (the fake is bound) -- a client then renders no image
  // rather than a broken one.
  @ApiProperty({ example: 'https://media.adulis.example', description: 'Public origin for product image keys (T20 S4).' })
  media_public_origin!: string;

  /**
   * WHICH SERVER THIS IS (T23 Phase 4). Additive, so no client changes
   * (ADU-API-01's additive-compatibility rule).
   *
   * Served rather than baked into a client's build, for one reason: a
   * build-time constant says which environment the BUNDLE was built for, and
   * what matters is which API the seller is actually talking to. Those differ
   * exactly when it is most dangerous -- a staging bundle pointed at
   * production, or the reverse -- and a banner that can be wrong about that is
   * worse than no banner.
   */
  @ApiProperty({
    enum: NODE_ENVS,
    description: 'Which server answered. The console draws its environment banner from this.',
  })
  environment!: NodeEnv;

  @ApiProperty({
    type: AccountContextDto,
    nullable: true,
    description:
      'Present when the request carries a valid MOBILE session (Authorization: Bearer); null for ' +
      'an anonymous request or a CONSOLE session.',
  })
  account_context!: AccountContextDto | null;
}

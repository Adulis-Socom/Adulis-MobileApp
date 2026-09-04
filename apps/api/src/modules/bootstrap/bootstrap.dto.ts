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
}

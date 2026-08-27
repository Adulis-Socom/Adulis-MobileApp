import { ApiProperty } from '@nestjs/swagger';

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
}

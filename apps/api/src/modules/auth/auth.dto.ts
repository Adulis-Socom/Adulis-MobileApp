import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

/**
 * The auth, session and device contract (WO-API-001A; register API-1),
 * decorated for the generated contract the way bootstrap.dto.ts is.
 *
 * VALIDATION STAYS IN auth.schemas.ts (zod). These classes describe the wire
 * shape the handlers already accept and return; they validate nothing. A
 * field added to one must be added to the other.
 */

const E164 = '^\\+[1-9][0-9]{7,14}$';

export class OtpRequestBodyDto {
  @ApiProperty({ pattern: E164, example: '+251911000000' }) phone!: string;
  @ApiProperty({ enum: ['SIGN_IN'] }) purpose!: 'SIGN_IN';
  @ApiProperty({
    enum: ['MOBILE', 'CONSOLE'],
    description: 'Stamped on the challenge at request; verify refuses an audience field (S5.2).',
  })
  audience!: 'MOBILE' | 'CONSOLE';
}

/** 202 with an empty body: the code travels by SMS, never in a response. */
export class EmptyResponseDto {}

export class OtpVerifyBodyDto {
  @ApiProperty({ pattern: E164 }) phone!: string;
  @ApiProperty({ pattern: '^[0-9]{6}$' }) code!: string;
  @ApiPropertyOptional({
    format: 'uuid',
    description: 'MOBILE only: the app-generated id registered by POST /v1/devices. A browser sends none.',
  })
  device_id?: string;
  @ApiPropertyOptional({ description: 'Required the first time a phone signs in (identity creation).' })
  age_declared_over_18?: boolean;
  @ApiPropertyOptional({ description: 'CONSOLE only (R17).' })
  remember_device?: boolean;
}

export class OtpVerifyResponseDto {
  @ApiProperty({ format: 'uuid' }) account_id!: string;
  @ApiProperty({ enum: ['MOBILE', 'CONSOLE'] }) audience!: 'MOBILE' | 'CONSOLE';
  @ApiProperty({
    type: [String],
    enum: ['BUYER', 'COURIER', 'SELLER', 'TEAM'],
    description: 'A rendering hint only (S5). Mode availability is GET /v1/bootstrap account_context.',
  })
  roles!: string[];
  @ApiProperty({ format: 'date-time' }) expires_at!: string;
  @ApiPropertyOptional({
    description:
      'MOBILE only: the session credential, sent as Authorization: Bearer. Returned once and never ' +
      'stored by the server; keep it in platform secure storage. Absent for CONSOLE, whose credential ' +
      'is the __Host-adulis_session cookie.',
  })
  token?: string;
}

export class SessionDto {
  @ApiProperty({ format: 'uuid', description: 'Public session id. Not a credential.' }) id!: string;
  @ApiProperty({ enum: ['MOBILE', 'CONSOLE'] }) audience!: 'MOBILE' | 'CONSOLE';
  @ApiProperty({ format: 'date-time' }) first_seen_at!: string;
  @ApiProperty({ format: 'date-time' }) last_activity_at!: string;
  @ApiProperty({ type: String, nullable: true }) approx_location!: string | null;
  @ApiProperty({ format: 'date-time' }) expires_at!: string;
  @ApiProperty({ enum: ['ANDROID', 'IOS', 'WEB'], nullable: true })
  device_platform!: 'ANDROID' | 'IOS' | 'WEB' | null;
  @ApiProperty({ type: String, nullable: true }) remembered_label!: string | null;
  @ApiProperty({
    type: String,
    format: 'uuid',
    nullable: true,
    description: 'The remembered device DELETE /v1/auth/remembered-devices/{id} forgets.',
  })
  remembered_device_id!: string | null;
  @ApiProperty() remembered!: boolean;
  @ApiProperty({ description: 'True for the session making this request.' }) current!: boolean;
}

export class SessionListResponseDto {
  @ApiProperty({ type: [SessionDto] }) data!: SessionDto[];
}

export class RevokeSessionBodyDto {
  @ApiPropertyOptional({
    format: 'uuid',
    description:
      'Required to revoke ANOTHER session (CONSOLE only): a satisfied REVOKE_ALL_SESSIONS step-up, ' +
      'consumed. Not needed to revoke the calling session.',
  })
  step_up_challenge_id?: string;
}

export class RevokeOthersBodyDto {
  @ApiProperty({ format: 'uuid', description: 'A satisfied REVOKE_ALL_SESSIONS step-up.' })
  step_up_challenge_id!: string;
}

export class RevokeOthersResponseDto {
  @ApiProperty({ type: 'integer', minimum: 0 }) revoked!: number;
}

export class DeviceRegisterBodyDto {
  @ApiProperty({ format: 'uuid', description: 'App-generated, keystore-persisted.' }) id!: string;
  @ApiProperty({ enum: ['ANDROID', 'IOS'] }) platform!: 'ANDROID' | 'IOS';
}

export class DevicePatchBodyDto {
  @ApiPropertyOptional({ type: String, maxLength: 4096, nullable: true }) push_token?: string | null;
  @ApiPropertyOptional({ enum: ['GRANTED', 'DENIED', 'NOT_ASKED'] })
  notification_permission?: 'GRANTED' | 'DENIED' | 'NOT_ASKED';
}

export class DeviceRefDto {
  @ApiProperty({ format: 'uuid' }) id!: string;
}

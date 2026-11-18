import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

/** POST /v1/deletion/otp/verify: a ticket for the deletion page, never a session. */
export class DeletionTicketDto {
  @ApiProperty({ format: 'uuid', description: 'Sent as Authorization: Ticket <ticket> to preview and confirm.' }) ticket!: string;
  @ApiProperty({ format: 'date-time', description: 'Fifteen minutes after it was issued.' }) expires_at!: string;
  @ApiProperty({ enum: ['ACCOUNT_DELETION'] }) scope!: 'ACCOUNT_DELETION';
}

export class DeletionBlockerSubjectDto {
  @ApiProperty({ enum: ['SELLER'] }) kind!: 'SELLER';
  @ApiProperty({ format: 'uuid' }) id!: string;
}

export class DeletionBlockerSlotsDto {
  @ApiProperty({ type: 'integer', minimum: 0, description: 'How many rows block the deletion.' }) count!: number;
}

export class DeletionResolvingActionDto {
  @ApiProperty({ description: 'A stable key the client localises.' }) kind!: string;
}

/** One reason the deletion cannot proceed yet. */
export class DeletionBlockerDto {
  @ApiProperty({ description: 'The blocker, e.g. NON_TERMINAL_RESERVATIONS.' }) code!: string;
  @ApiProperty() message_key!: string;
  @ApiPropertyOptional({ type: DeletionBlockerSubjectDto, description: 'The store it concerns; absent for an Account-level blocker.' })
  subject?: DeletionBlockerSubjectDto;
  @ApiProperty({ type: DeletionBlockerSlotsDto }) slots!: DeletionBlockerSlotsDto;
  @ApiProperty({ type: DeletionResolvingActionDto }) resolving_action!: DeletionResolvingActionDto;
}

/** One thing that deletion does. */
export class DeletionEffectDto {
  @ApiProperty() code!: string;
  @ApiProperty() message_key!: string;
}

/** GET /v1/deletion/preview. */
export class DeletionPreviewDto {
  @ApiProperty({ type: [DeletionBlockerDto], description: 'Empty when nothing blocks the deletion.' }) items!: DeletionBlockerDto[];
  @ApiProperty({ type: [DeletionEffectDto] }) effects!: DeletionEffectDto[];
}

/** POST /v1/deletion/confirm. */
export class DeletionConfirmedDto {
  @ApiProperty({ enum: [true] }) deleted!: true;
}

/** GET /v1/seller/deletion/blockers: a state, not a failure. */
export class SellerDeletionBlockersDto {
  @ApiProperty({ type: [DeletionBlockerDto], description: 'Empty when nothing blocks the deletion of the store.' }) items!: DeletionBlockerDto[];
}

/** POST /v1/seller/closure. */
export class SellerClosureDto {
  @ApiProperty({ enum: ['CLOSING'] }) status!: 'CLOSING';
}

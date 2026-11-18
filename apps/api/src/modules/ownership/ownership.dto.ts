import { ApiProperty } from '@nestjs/swagger';

export class PendingOwnershipTransferDto {
  @ApiProperty({ format: 'uuid' }) id!: string;
  @ApiProperty({ description: 'True for the owner who requested the transfer, false for the recipient.' }) i_am_the_owner!: boolean;
  @ApiProperty({ type: String, nullable: true, description: 'The role the current owner keeps after the transfer, if any.' }) residual_role!: string | null;
  @ApiProperty({ format: 'date-time' }) requested_at!: string;
  @ApiProperty({ format: 'date-time' }) activates_at!: string;
}

/** GET /v1/seller/ownership-transfer: visible to its two parties only. */
export class PendingOwnershipTransferResponseDto {
  @ApiProperty({ type: PendingOwnershipTransferDto, nullable: true, description: 'Null when no transfer is pending.' }) transfer!: PendingOwnershipTransferDto | null;
}

/** POST /v1/seller/ownership-transfer. */
export class OwnershipTransferRequestedDto {
  @ApiProperty({ format: 'uuid' }) transfer_id!: string;
  @ApiProperty({ format: 'date-time' }) activates_at!: string;
  @ApiProperty({ type: String, nullable: true }) residual_role!: string | null;
}

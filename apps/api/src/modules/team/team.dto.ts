import { ApiProperty } from '@nestjs/swagger';

export class TeamMemberDto {
  @ApiProperty({ format: 'uuid', description: 'The membership id (not the account id).' }) id!: string;
  @ApiProperty({ description: 'The team role.' }) role!: string;
  @ApiProperty({ type: String, format: 'date-time', nullable: true, description: 'Set while the membership is suspended.' }) suspended_at!: string | null;
  @ApiProperty({ format: 'date-time' }) created_at!: string;
  @ApiProperty({ description: 'The member\'s phone number, E.164.' }) phone!: string;
}

/** The team-seat entitlement of the store's tier. */
export class TeamSeatsDto {
  @ApiProperty({ description: 'False when the tier has no team seats.' }) allowed!: boolean;
  @ApiProperty({ type: 'integer', nullable: true, required: false, description: 'The seat cap; null means no cap. Absent when the entitlement could not be resolved.' }) cap?: number | null;
  @ApiProperty({ required: false, description: 'Why the entitlement could not be resolved, when it could not.' }) reason?: string;
}

/** GET /v1/seller/team. */
export class TeamListDto {
  @ApiProperty({ type: [TeamMemberDto], description: 'Live memberships, oldest first.' }) data!: TeamMemberDto[];
  @ApiProperty({ type: TeamSeatsDto, nullable: true }) seats!: TeamSeatsDto | null;
  @ApiProperty({ type: [String], description: 'Which of the team actions the caller may take now, as permission codes, sorted.' }) allowed_actions!: string[];
}

/** POST /v1/seller/team. */
export class TeamMemberInvitedDto {
  @ApiProperty({ format: 'uuid', description: 'The membership id.' }) id!: string;
  @ApiProperty({ description: 'The role the member was invited with.' }) role!: string;
}

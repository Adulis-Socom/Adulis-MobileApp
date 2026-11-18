import { ApiProperty } from '@nestjs/swagger';

/** POST /v1/reports. */
export class ReportCreatedDto {
  @ApiProperty({ format: 'uuid' }) report_id!: string;
}

export class ReportDto {
  @ApiProperty({ format: 'uuid' }) id!: string;
  @ApiProperty({ description: 'What was reported: PRODUCT, REVIEW, MESSAGE, SELLER or STOREFRONT.' }) target_kind!: string;
  @ApiProperty({ format: 'uuid' }) target_id!: string;
  @ApiProperty() reason_code!: string;
  @ApiProperty({ format: 'date-time' }) reported_at!: string;
  @ApiProperty({ type: String, format: 'date-time', nullable: true, description: 'Null while the report is open.' }) resolved_at!: string | null;
}

/** GET /v1/reports/mine: the reporter's own reports, newest first, at most 100. */
export class MyReportsDto {
  @ApiProperty({ type: [ReportDto] }) data!: ReportDto[];
}

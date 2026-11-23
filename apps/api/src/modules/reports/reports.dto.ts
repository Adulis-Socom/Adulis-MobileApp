import { ApiProperty } from '@nestjs/swagger';
import { z } from 'zod';

/**
 * What can be reported: exactly core.report_target_kind (D-44: the wire adopts the shipped enum's spelling). There is
 * no Scene target and no other kind; the list is the one place the controller's validation and the declared contract
 * both read, so neither can drift from the other.
 */
export const REPORT_SUBJECT_KINDS = ['PRODUCT', 'REVIEW', 'MESSAGE', 'SELLER', 'STOREFRONT'] as const;
/** `reason` is free text stored as `reason_code`; the server owns no reason taxonomy. */
export const REPORT_REASON_MAX = 80;
export const REPORT_DETAIL_MAX = 2000;

/** The runtime validation of POST /v1/reports (parsed by the controller). */
export const reportRequestBody = z.object({
  subject_kind: z.enum(REPORT_SUBJECT_KINDS),
  subject_id: z.uuid(),
  reason: z.string().min(1).max(REPORT_REASON_MAX),
  detail: z.string().max(REPORT_DETAIL_MAX).optional(),
});

/** POST /v1/reports request body: what the contract declares for what `reportRequestBody` parses. */
export class ReportRequestBodyDto {
  @ApiProperty({
    enum: REPORT_SUBJECT_KINDS,
    description: 'What is reported: PRODUCT, REVIEW, MESSAGE, SELLER or STOREFRONT (core.report_target_kind). There is no Scene target.',
  })
  subject_kind!: (typeof REPORT_SUBJECT_KINDS)[number];

  @ApiProperty({ format: 'uuid', description: 'The id of the reported item. The server does not check that it exists.' })
  subject_id!: string;

  @ApiProperty({
    minLength: 1,
    maxLength: REPORT_REASON_MAX,
    description:
      'Free text, stored as the report reason code. The server defines no reason list. The limit counts JavaScript string length (UTF-16 code units): an emoji counts as 2.',
  })
  reason!: string;

  @ApiProperty({
    required: false,
    maxLength: REPORT_DETAIL_MAX,
    description: 'Optional additional information. The limit counts JavaScript string length (UTF-16 code units): an emoji counts as 2.',
  })
  detail?: string;
}

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

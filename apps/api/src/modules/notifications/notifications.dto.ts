import { ApiProperty } from '@nestjs/swagger';

/** One notification of the Account, as GET /v1/notifications lists it. */
export class NotificationDto {
  @ApiProperty({ format: 'uuid' }) id!: string;
  @ApiProperty({ description: 'The message template; the client renders it from its own catalogue.' }) template_key!: string;
  @ApiProperty({ description: 'The locale the notification was enqueued in.' }) locale!: string;
  @ApiProperty({ type: 'object', additionalProperties: true, description: 'Typed values for the template; never pre-formatted text.' })
  slots!: Record<string, unknown>;
  @ApiProperty({ type: String, format: 'uuid', nullable: true, description: 'The Order it is about, when it is about one.' })
  order_id!: string | null;
  @ApiProperty({ description: 'false: it cannot be switched off by a notification preference.' }) suppressible!: boolean;
  @ApiProperty({ format: 'date-time', description: 'When it was due to be sent; the list is ordered by it, newest first.' }) scheduled_for!: string;
  @ApiProperty({ type: String, format: 'date-time', nullable: true, description: 'null until it is read.' }) read_at!: string | null;
}

export class NotificationPageDto {
  @ApiProperty({ type: [NotificationDto] }) data!: NotificationDto[];
  @ApiProperty({ type: String, format: 'date-time', nullable: true, description: 'Pass as cursor for the next page; null at the end.' })
  next_cursor!: string | null;
}

export class NotificationReadDto {
  @ApiProperty({ format: 'date-time', description: 'When it was first read; a repeat call keeps the original time.' }) read_at!: string;
}

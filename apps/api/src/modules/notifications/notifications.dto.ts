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

/** POST /v1/notifications/read-all. */
export class NotificationsMarkedReadDto {
  @ApiProperty({ type: 'integer', description: 'How many unread notifications were marked read.' }) marked!: number;
}

export class NotificationPreferenceDto {
  @ApiProperty({ description: 'The message template the preference is about.' }) template_key!: string;
  @ApiProperty() enabled!: boolean;
  @ApiProperty({ format: 'date-time' }) updated_at!: string;
}

/** GET /v1/seller/notification-preferences: the caller's own, for the Seller named by X-Adulis-Seller. */
export class NotificationPreferencesDto {
  @ApiProperty({ type: [NotificationPreferenceDto], description: 'Ordered by template_key.' }) preferences!: NotificationPreferenceDto[];
}

/** PATCH /v1/seller/notification-preferences. */
export class NotificationPreferencesSavedDto {
  @ApiProperty({ type: 'integer', description: 'How many preferences were saved.' }) updated!: number;
}

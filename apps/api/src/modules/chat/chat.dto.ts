import { ApiProperty, ApiPropertyOptional, getSchemaPath } from '@nestjs/swagger';

/** POST /v1/conversations. */
export class ConversationOpenedDto {
  @ApiProperty({ format: 'uuid', description: 'The one conversation of this Buyer and Seller, created now or returned.' })
  conversation_id!: string;
}

/** A conversation of the signed-in Buyer (GET /v1/conversations?as=buyer). */
export class BuyerConversationDto {
  @ApiProperty({ format: 'uuid' }) id!: string;
  @ApiProperty({ format: 'uuid' }) seller_id!: string;
  @ApiProperty() store_name!: string;
  @ApiProperty() handle!: string;
  @ApiProperty({ format: 'date-time' }) started_at!: string;
  @ApiProperty({ format: 'date-time' }) last_message_at!: string;
}

/** A conversation of the active Seller (GET /v1/conversations?as=seller&seller_id=). */
export class SellerConversationDto {
  @ApiProperty({ format: 'uuid' }) id!: string;
  @ApiProperty({ format: 'uuid' }) buyer_account_id!: string;
  @ApiProperty({ format: 'date-time' }) started_at!: string;
  @ApiProperty({ format: 'date-time' }) last_message_at!: string;
}

export class ConversationPageDto {
  @ApiProperty({
    type: 'array',
    items: { oneOf: [{ $ref: getSchemaPath(BuyerConversationDto) }, { $ref: getSchemaPath(SellerConversationDto) }] },
    description: 'as=buyer lists BuyerConversationDto, as=seller lists SellerConversationDto. Most recent message first.',
  })
  data!: (BuyerConversationDto | SellerConversationDto)[];
  @ApiProperty({ type: String, nullable: true, description: 'Pass as cursor for the next page; null at the end.' }) next_cursor!: string | null;
}

/** A message sent by the bot: a template key and slots, never prose. */
export class BotMessageDto {
  @ApiProperty({ format: 'uuid' }) id!: string;
  @ApiProperty({ enum: ['BOT'] }) sender_kind!: 'BOT';
  @ApiProperty({ description: 'The answer template, or the catalogue key chat.bot.escalated.' }) template_key!: string;
  @ApiProperty({ type: 'object', additionalProperties: true, description: 'Always empty today: a template with slots is escalated, not sent.' })
  slots!: Record<string, unknown>;
  @ApiProperty({
    type: String,
    enum: ['STRUCTURE', 'CHIP', 'KEYWORD', 'EMBEDDING', 'CLASSIFIER', 'ESCALATED'],
    nullable: true,
    description: 'How the bot arrived at it.',
  })
  resolution_path!: string | null;
  @ApiProperty({ format: 'date-time' }) sent_at!: string;
}

/** A message written by a person: the Buyer, the Seller owner or a team member. */
export class HumanMessageDto {
  @ApiProperty({ format: 'uuid' }) id!: string;
  @ApiProperty({ enum: ['BUYER', 'SELLER', 'TEAM_MEMBER'] }) sender_kind!: 'BUYER' | 'SELLER' | 'TEAM_MEMBER';
  @ApiProperty() body!: string;
  @ApiProperty({ description: 'The locale it was written in.' }) locale!: string;
  @ApiProperty({ format: 'date-time' }) sent_at!: string;
  @ApiProperty({ type: String, format: 'date-time', nullable: true }) read_at!: string | null;
  @ApiProperty({ type: String, format: 'uuid', nullable: true, description: 'The Product the message is about.' }) product_id!: string | null;
  @ApiProperty({ type: String, format: 'uuid', nullable: true, description: 'The Order the message is about.' }) order_id!: string | null;
}

export class MessagePageDto {
  @ApiProperty({
    type: 'array',
    items: { oneOf: [{ $ref: getSchemaPath(BotMessageDto) }, { $ref: getSchemaPath(HumanMessageDto) }] },
    description: 'Newest first.',
  })
  data!: (BotMessageDto | HumanMessageDto)[];
  @ApiProperty({ type: String, nullable: true, description: 'Pass as cursor for the next page; null at the end.' }) next_cursor!: string | null;
}

/** The bot's turn on a Buyer message. */
export class BotTurnDto {
  @ApiProperty({ enum: ['CHIP', 'KEYWORD', 'EMBEDDING', 'CLASSIFIER', 'ESCALATED'] }) resolution_path!: string;
  @ApiProperty({ format: 'uuid', description: 'The bot message the turn wrote.' }) bot_message_id!: string;
  @ApiPropertyOptional({ description: 'The answer template; absent when the turn escalated.' }) template_key?: string;
  @ApiPropertyOptional({ type: 'object', additionalProperties: true, description: 'Always empty today; absent when the turn escalated.' })
  slots?: Record<string, unknown>;
}

/** POST /v1/conversations/{id}/messages. */
export class MessageSentDto {
  @ApiProperty({ format: 'uuid' }) message_id!: string;
  @ApiProperty({
    type: BotTurnDto,
    nullable: true,
    description: 'null when the bot did not run: a Seller-side message, or a Seller whose plan has no chatbot.',
  })
  bot!: BotTurnDto | null;
}

/** POST /v1/conversations/{id}/escalate. */
export class ConversationEscalatedDto {
  @ApiProperty({ enum: [true] }) escalated!: true;
  @ApiProperty({ format: 'uuid', description: 'The escalation message the bot wrote.' }) bot_message_id!: string;
}

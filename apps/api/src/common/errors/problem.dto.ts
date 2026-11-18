import { ApiProperty, ApiPropertyOptional, getSchemaPath } from '@nestjs/swagger';
import { ERROR_CATALOGUE } from './error-catalogue';

/**
 * The problem envelope every error answers with (ProblemDetailsFilter;
 * ADU-API-01 section 7), decorated for the generated contract. Mirrors
 * ProblemEnvelope in adulis-exception.ts; `code` is the catalogue's closed
 * set, so a client switches on a typed union rather than on strings.
 */
/** The object a problem item is about (ErrorItem.subject). */
export class ProblemSubjectDto {
  @ApiProperty() kind!: string;
  @ApiProperty() id!: string;
}

/**
 * What the caller can do to clear a problem item (ErrorItem.resolving_action). `kind` is always present; other members
 * accompany some kinds (REDUCE_QUANTITY carries `to`), so the property that holds it is declared open.
 */
export class ProblemResolvingActionDto {
  @ApiProperty() kind!: string;
}

export class ProblemItemDto {
  @ApiProperty() code!: string;
  @ApiProperty() message_key!: string;
  @ApiPropertyOptional({ type: 'object', additionalProperties: true }) slots?: Record<string, unknown>;
  // Nested classes, not inline schemas: ApiPropertyOptional replaces a nested `required` array with `false`, so an
  // inline object would declare its own members optional.
  @ApiPropertyOptional({ type: ProblemSubjectDto, description: 'The object this item is about.' })
  subject?: ProblemSubjectDto;
  @ApiPropertyOptional({
    type: ProblemResolvingActionDto,
    additionalProperties: true,
    description: 'What the caller can do to clear this item; further members depend on the kind.',
  })
  resolving_action?: ProblemResolvingActionDto & Record<string, unknown>;
}

export class ProblemDto {
  @ApiProperty() type!: string;
  @ApiProperty() title_key!: string;
  @ApiProperty() status!: number;
  @ApiProperty({ enum: Object.keys(ERROR_CATALOGUE) }) code!: string;
  @ApiProperty() request_id!: string;
  @ApiProperty() retryable!: boolean;
  @ApiPropertyOptional({ type: 'object', additionalProperties: true }) slots?: Record<string, unknown>;
  @ApiPropertyOptional({ type: [ProblemItemDto] }) items?: ProblemItemDto[];
}

/**
 * `@ApiDefaultResponse(PROBLEM_RESPONSE)`: the media type the filter really
 * sends. The controller also needs `@ApiExtraModels(ProblemDto)` so the $ref
 * resolves.
 */
export const PROBLEM_RESPONSE = {
  description: 'Problem details (ProblemDetailsFilter).',
  content: { 'application/problem+json': { schema: { $ref: getSchemaPath(ProblemDto) } } },
};

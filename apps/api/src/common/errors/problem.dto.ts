import { ApiProperty, ApiPropertyOptional, getSchemaPath } from '@nestjs/swagger';
import { ERROR_CATALOGUE } from './error-catalogue';

/**
 * The problem envelope every error answers with (ProblemDetailsFilter;
 * ADU-API-01 section 7), decorated for the generated contract. Mirrors
 * ProblemEnvelope in adulis-exception.ts; `code` is the catalogue's closed
 * set, so a client switches on a typed union rather than on strings.
 */
export class ProblemItemDto {
  @ApiProperty() code!: string;
  @ApiProperty() message_key!: string;
  @ApiPropertyOptional({ type: 'object', additionalProperties: true }) slots?: Record<string, unknown>;
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

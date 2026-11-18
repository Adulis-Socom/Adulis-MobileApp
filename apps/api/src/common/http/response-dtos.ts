import { ApiProperty } from '@nestjs/swagger';

/** The answer of a PATCH that saves what it was sent and returns nothing else. */
export class UpdatedDto {
  @ApiProperty({ enum: [true] }) updated!: true;
}

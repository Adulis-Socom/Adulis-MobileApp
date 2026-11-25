import { ApiProperty } from '@nestjs/swagger';

/** The window the counts were taken over, as inclusive calendar dates. */
export class AnalyticsWindowDto {
  @ApiProperty({ format: 'date', description: 'YYYY-MM-DD. The first day.' }) from!: string;
  @ApiProperty({ format: 'date', description: 'YYYY-MM-DD. The last day.' }) to!: string;
}

/** GET /v1/seller/analytics/overview: resolved counts over the window, never raw events. */
export class AnalyticsOverviewDto {
  @ApiProperty({ type: 'integer', description: 'Products published now: point-in-time, independent of the window.' }) products_published!: number;
  @ApiProperty({ type: 'integer', description: 'Buyers following the store now.' }) followers!: number;
  @ApiProperty({ type: AnalyticsWindowDto }) window!: AnalyticsWindowDto;
}

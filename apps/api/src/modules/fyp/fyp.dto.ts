import { ApiProperty } from '@nestjs/swagger';
import { PublicSceneSellerDto } from '../scenes/scenes.dto';

/**
 * GET /v1/fyp (ADU-REC-01 v3.2 S12-S13; WO-DISC-002). Scene units only: no
 * Product Post, Story or advertisement type exists in this response.
 *
 * Public identity only: public_ref and revision_version, never the internal
 * Scene, revision or Seller ids (the server resolves those from impression_id).
 * No price or stock: those stay with the Product (ADU-MOB-02 S11, "current
 * product price/stock must not be duplicated"). No hotspot geometry (R-06), no
 * engagement counts, no allowed-actions list (no engagement action has a
 * backend yet; register OVN for WO-DISC-002).
 */

export const FYP_CANDIDATE_SOURCES = [
  'ONBOARDING_INTEREST',
  'CATEGORY_AFFINITY',
  'SELLER_AFFINITY',
  'FOLLOWING',
  'RECENT',
  'TRENDING',
  'NEW_SELLER',
  'NEW_CONTENT',
  'EXPLORATION',
] as const;

export class FypImageDto {
  @ApiProperty({ description: 'Object key; resolve against bootstrap media_public_origin.' })
  thumb_key!: string;
  @ApiProperty({ description: 'The feed-card derivative. No full-resolution key in a feed unit.' })
  card_key!: string;
}

export class FypUnitProductDto {
  @ApiProperty({ type: 'integer', minimum: 1 }) position!: number;
  @ApiProperty({ description: 'Product route: /v1/storefronts/{handle}/products/{slug}.' })
  slug!: string;
  @ApiProperty() name!: string;
  @ApiProperty({ description: 'False: the tag stays, marked currently unavailable.' })
  available!: boolean;
}

export class ScenePostFeedUnitDto {
  @ApiProperty({
    enum: ['SCENE_POST'],
    description: 'The only unit type. Clients skip any unit type they do not know.',
  })
  type!: 'SCENE_POST';
  @ApiProperty({
    format: 'uuid',
    description: 'The served-impression identity (S55): send it with the telemetry of this unit.',
  })
  impression_id!: string;
  @ApiProperty({ type: 'integer', minimum: 1, description: 'Position in the feed session.' })
  position!: number;
  @ApiProperty({ enum: FYP_CANDIDATE_SOURCES }) candidate_source!: string;
  @ApiProperty({ description: 'Stable public reference: /v1/scene-posts/{public_ref}.' })
  public_ref!: string;
  @ApiProperty({ type: 'integer', minimum: 1, description: 'The exact served revision.' })
  revision_version!: number;
  @ApiProperty({ format: 'date-time' }) published_at!: string;
  @ApiProperty({ description: 'The caption, or a bounded excerpt of it (caption_truncated).' })
  caption!: string;
  @ApiProperty() caption_truncated!: boolean;
  @ApiProperty({ type: FypImageDto }) image!: FypImageDto;
  @ApiProperty({ type: PublicSceneSellerDto }) seller!: PublicSceneSellerDto;
  @ApiProperty({
    type: [FypUnitProductDto],
    description: 'Current public tag summaries in presentation order, read at response time.',
  })
  products!: FypUnitProductDto[];
}

export class FypPageDto {
  @ApiProperty({
    type: String,
    format: 'uuid',
    nullable: true,
    description: 'The feed session (S52). Null when nothing was served (no session was created).',
  })
  feed_session_id!: string | null;
  @ApiProperty({
    type: String,
    nullable: true,
    description: 'The immutable algorithm version that ranked this page. Null when none may serve.',
  })
  algorithm_version!: string | null;
  @ApiProperty({ type: [ScenePostFeedUnitDto] }) items!: ScenePostFeedUnitDto[];
  @ApiProperty({
    type: String,
    nullable: true,
    description: 'Opaque continuation; send back unchanged as ?cursor=. Null: the session has no more.',
  })
  next_cursor!: string | null;
}

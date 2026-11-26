import type {
  ModerationView,
  ScenePublication,
  SceneDetail,
  SceneSummary,
  SceneTab,
  SceneTag,
  SceneVisibility,
  StoryState,
  StoryView,
} from '../contracts/gap-sc-content';
import type { CallContext } from '../transport/port';
import type { Catalogue } from './catalogue';
import { conflict, DAY_MS, HOUR_MS, invalid, need, needCap, notFound, replayable, type Authz, type Handlers, type Kit } from './kit';

/**
 * Fixture Content (GAP-SC-11): Scene Posts. DEVELOPMENT ONLY. A Scene's visibility is RESOLVED on every read from the
 * current Product facts (CATINV S21, SCN S29): it is never stored, so a stock change or a withdrawn Product changes it with no
 * Console involvement, and restock restores it automatically when every other gate passes.
 *
 * Reason codes (report 17, C-1 and C-2): this fixture emits PRODUCT_TAG_REQUIRED (SCN) for zero tags; for a Private Scene it
 * emits ALL_TAGGED_PRODUCTS_OUT_OF_STOCK when some tagged Product is still eligible but out of stock, and
 * ALL_TAGGED_PRODUCTS_UNAVAILABLE when none is eligible. The Console branches on neither spelling.
 */
const PAGE_SIZE = 5; // demonstration value: the real page size is the server's
const IMAGE_PROCESSING_MS = 1500; // demonstration value only
const IMAGE_ASPECT = 0.8; // demonstration presentation, 4:5

interface HotspotRec {
  id: string;
  x_norm: number;
  y_norm: number;
}
interface TagRec {
  product_id: string;
  hotspots: HotspotRec[];
}
interface ImageRec {
  file_name: string;
  content_type: string;
  addedAt: number;
}
interface SceneRec {
  id: string;
  version: number;
  caption: string;
  image: ImageRec | null;
  tags: TagRec[];
  state: ScenePublication;
  moderation: ModerationView | null;
}

type ContentOps =
  | 'scenes.list'
  | 'scenes.create'
  | 'scenes.get'
  | 'scenes.update'
  | 'scenes.media.set'
  | 'scenes.publish'
  | 'scenes.archive'
  | 'scenes.tag_candidates.get'
  | 'stories.list'
  | 'stories.targets.get'
  | 'stories.create'
  | 'stories.withdraw';

/** The fixed public lifetime of a Story, founder-approved (STORY contract). Authored by the SERVER; the Console never computes or extends it. */
export const STORY_LIFETIME_MS = 24 * HOUR_MS;

interface StoryRec {
  id: string;
  version: number;
  state: Exclude<StoryState, 'EXPIRED'>;
  photo_name: string;
  text: string | null;
  target: { kind: 'PRODUCT' | 'SCENE'; id: string } | null;
  publishedAt: number;
  moderation: ModerationView | null;
}

export interface Content {
  readonly handlers: Handlers<ContentOps>;
}

const BLOCKING_MODERATION = new Set(['RESTRICTED', 'REMOVED']);

export function createContent(kit: Kit, catalogue: Catalogue): Content {
  const data = new Map<string, SceneRec[]>();
  const created = new Map<string, SceneDetail>();

  function seedFor(sellerId: string): SceneRec[] {
    if (sellerId !== 'fx_seller_alem') return [];
    const p = (n: number) => `fx_prod_alem_${n}`;
    const img = (name: string): ImageRec => ({ file_name: name, content_type: 'image/jpeg', addedAt: kit.now() - 12 * DAY_MS });
    const scene = (n: number, caption: string, state: ScenePublication, tags: TagRec[], extra: Partial<Pick<SceneRec, 'moderation' | 'image'>> = {}): SceneRec => ({
      id: `fx_scene_alem_${n}`,
      version: 1,
      caption,
      image: extra.image === undefined ? img(`scene-${n}.jpg`) : extra.image,
      tags,
      state,
      moderation: extra.moderation ?? null,
    });
    // Newest first.
    return [
      scene(6, 'The old kaftan, styled two ways', 'PUBLISHED', [{ product_id: p(7), hotspots: [] }]),
      scene(5, 'Shirt dress for a long lunch', 'PUBLISHED', [{ product_id: p(2), hotspots: [] }], {
        moderation: { state: 'RESTRICTED', reason_code: 'POLICY_REVIEW', updated_at: kit.iso(kit.now() - 2 * DAY_MS) },
      }),
      scene(4, 'Last season lookbook', 'ARCHIVED', [{ product_id: p(2), hotspots: [] }]),
      scene(3, '', 'DRAFT', [], { image: null }),
      scene(2, 'The silk slip dress, evening edit', 'PUBLISHED', [{ product_id: p(3), hotspots: [{ id: 'fx_hs_alem_2', x_norm: 0.5, y_norm: 0.4 }] }]),
      scene(1, 'Linen wrap dress styled for the rainy season', 'PUBLISHED', [
        { product_id: p(1), hotspots: [{ id: 'fx_hs_alem_1', x_norm: 0.42, y_norm: 0.55 }] },
        { product_id: p(2), hotspots: [] },
      ]),
    ];
  }
  const scenesOf = (sellerId: string): SceneRec[] => {
    let list = data.get(sellerId);
    if (!list) {
      list = seedFor(sellerId);
      data.set(sellerId, list);
    }
    return list;
  };
  const find = (sellerId: string, sceneId: string): SceneRec => {
    const s = scenesOf(sellerId).find((x) => x.id === sceneId);
    if (!s) throw notFound();
    return s;
  };

  // ---- resolvers -----------------------------------------------------------------------------------------------------
  const imageState = (i: ImageRec): 'PROCESSING' | 'READY' | 'REJECTED' => (!i.content_type.startsWith('image/') ? 'REJECTED' : kit.now() - i.addedAt < IMAGE_PROCESSING_MS ? 'PROCESSING' : 'READY');
  function tagView(sellerId: string, t: TagRec): SceneTag {
    const fact = catalogue.fact(sellerId, t.product_id);
    return {
      product_id: t.product_id,
      title: fact?.title ?? '',
      availability: fact?.availability ?? 'NOT_AVAILABLE',
      eligible: fact?.state === 'PUBLISHED',
      hotspots: t.hotspots,
    };
  }
  const blockedByModeration = (s: SceneRec): boolean => s.moderation !== null && BLOCKING_MODERATION.has(s.moderation.state);
  function resolve(sellerId: string, s: SceneRec): { visibility: SceneVisibility; reason: string | null; tags: SceneTag[]; available: number } {
    const tags = s.tags.map((t) => tagView(sellerId, t));
    const available = tags.filter((t) => t.eligible && t.availability !== 'NOT_AVAILABLE').length;
    if (s.state !== 'PUBLISHED') return { visibility: 'PRIVATE', reason: null, tags, available };
    if (blockedByModeration(s)) return { visibility: 'PRIVATE', reason: null, tags, available };
    if (available > 0) return { visibility: 'PUBLIC', reason: null, tags, available };
    return { visibility: 'PRIVATE', reason: tags.some((t) => t.eligible) ? 'ALL_TAGGED_PRODUCTS_OUT_OF_STOCK' : 'ALL_TAGGED_PRODUCTS_UNAVAILABLE', tags, available };
  }
  function blockersOf(sellerId: string, s: SceneRec): { code: string; field: string | null }[] {
    if (s.state !== 'DRAFT') return [];
    const out: { code: string; field: string | null }[] = [];
    if (s.image === null) out.push({ code: 'MEDIA_MISSING', field: 'image' });
    else if (imageState(s.image) !== 'READY') out.push({ code: 'MEDIA_NOT_READY', field: 'image' });
    if (s.caption.trim() === '') out.push({ code: 'CAPTION_REQUIRED', field: 'caption' });
    const r = resolve(sellerId, s);
    if (s.tags.length === 0) out.push({ code: 'PRODUCT_TAG_REQUIRED', field: 'tags' });
    else {
      for (const t of r.tags) if (!t.eligible) out.push({ code: 'PRODUCT_NOT_ELIGIBLE', field: 'tags' });
      if (r.available === 0) out.push({ code: 'NO_AVAILABLE_TAGGED_PRODUCT', field: 'tags' });
    }
    if (blockedByModeration(s)) out.push({ code: 'CONTENT_MODERATION_RESTRICTED', field: null });
    return out;
  }
  function actionsOf(s: SceneRec, a: Authz): string[] {
    if (!a.caps.has('content.write') || s.state === 'REMOVED' || s.state === 'ARCHIVED') return [];
    if (s.moderation !== null && s.moderation.state === 'REMOVED') return [];
    return s.state === 'DRAFT' ? ['EDIT', 'PUBLISH', 'ARCHIVE'] : ['EDIT', 'ARCHIVE'];
  }
  function detail(sellerId: string, s: SceneRec, a: Authz): SceneDetail {
    const r = resolve(sellerId, s);
    return {
      seller_id: sellerId,
      id: s.id,
      version: s.version,
      caption: s.caption,
      image: s.image === null ? null : { file_name: s.image.file_name, state: imageState(s.image), aspect: IMAGE_ASPECT },
      tags: r.tags,
      publication_state: s.state,
      visibility: r.visibility,
      private_reason: r.reason,
      moderation: s.moderation,
      blockers: blockersOf(sellerId, s),
      allowed_actions: actionsOf(s, a),
    };
  }
  function summary(sellerId: string, s: SceneRec): SceneSummary {
    const r = resolve(sellerId, s);
    return {
      id: s.id,
      caption_preview: s.caption.length > 90 ? `${s.caption.slice(0, 90)}...` : s.caption,
      publication_state: s.state,
      visibility: r.visibility,
      private_reason: r.reason,
      moderation: s.moderation,
      tag_count: s.tags.length,
      available_tag_count: r.available,
    };
  }
  function inTab(sellerId: string, s: SceneRec, tab: SceneTab): boolean {
    const r = resolve(sellerId, s);
    const blocked = blockedByModeration(s) || s.state === 'REMOVED';
    switch (tab) {
      case 'ALL':
        return true;
      case 'DRAFT':
        return s.state === 'DRAFT';
      case 'PUBLIC':
        return s.state === 'PUBLISHED' && r.visibility === 'PUBLIC';
      case 'PRIVATE':
        return s.state === 'PUBLISHED' && r.visibility === 'PRIVATE' && !blocked;
      case 'ARCHIVED':
        return s.state === 'ARCHIVED';
      case 'RESTRICTED':
        return blocked;
    }
  }
  /** Common entry for a Scene write: Seller scope, destination, capability, existence, editability, optimistic concurrency. */
  function open(ctx: CallContext, sceneId: string, version: number | null, action: string): { a: Authz; s: SceneRec } {
    const a = kit.authz(ctx);
    need(a, 'content');
    needCap(a, 'content.write');
    const s = find(a.sellerId, sceneId);
    if (!actionsOf(s, a).includes(action)) throw conflict();
    if (version !== null && s.version !== version) throw conflict();
    return { a, s };
  }

  // ---- Stories (GAP-SC-12) ---------------------------------------------------------------------------------------------
  const storyData = new Map<string, StoryRec[]>();
  const storyCreated = new Map<string, StoryView>();
  function storySeed(sellerId: string): StoryRec[] {
    if (sellerId !== 'fx_seller_alem') return [];
    const story = (n: number, hoursAgo: number, text: string | null, target: StoryRec['target'], state: StoryRec['state'] = 'PUBLISHED', moderation: ModerationView | null = null): StoryRec => ({
      id: `fx_story_alem_${n}`,
      version: 1,
      state,
      photo_name: `story-${n}.jpg`,
      text,
      target,
      publishedAt: kit.now() - hoursAgo * HOUR_MS,
      moderation,
    });
    // Newest first. 1h, 2h and 20h are inside the lifetime; 30h is past it.
    return [
      story(6, 3, 'Held back for review', null, 'RESTRICTED', { state: 'RESTRICTED', reason_code: 'POLICY_REVIEW', updated_at: kit.iso(kit.now() - 2 * HOUR_MS) }),
      story(5, 1, 'Evening edit', { kind: 'SCENE', id: 'fx_scene_alem_2' }),
      story(4, 5, 'Sold out already', null, 'WITHDRAWN'),
      story(3, 30, 'Last weekend only', null),
      story(2, 20, null, null),
      story(1, 2, 'New arrivals', { kind: 'PRODUCT', id: 'fx_prod_alem_4' }),
    ];
  }
  const storiesOf = (sellerId: string): StoryRec[] => {
    let list = storyData.get(sellerId);
    if (!list) {
      list = storySeed(sellerId);
      storyData.set(sellerId, list);
    }
    return list;
  };
  const publicScene = (sellerId: string, id: string): boolean => {
    const s = scenesOf(sellerId).find((x) => x.id === id);
    return s !== undefined && s.state === 'PUBLISHED' && resolve(sellerId, s).visibility === 'PUBLIC';
  };
  /** Product link: published and still available. A link that stops being eligible suppresses the Story: fail closed (STORY contract). */
  function targetOk(sellerId: string, target: StoryRec['target']): boolean {
    if (target === null) return true;
    if (target.kind === 'PRODUCT') {
      const f = catalogue.fact(sellerId, target.id);
      return f !== undefined && f.state === 'PUBLISHED' && f.availability !== 'NOT_AVAILABLE';
    }
    return publicScene(sellerId, target.id);
  }
  const targetLabel = (sellerId: string, target: NonNullable<StoryRec['target']>): string =>
    target.kind === 'PRODUCT' ? (catalogue.fact(sellerId, target.id)?.title ?? '') : (scenesOf(sellerId).find((x) => x.id === target.id)?.caption ?? '');
  function storyView(sellerId: string, s: StoryRec, a: Authz): StoryView {
    const expiresAt = s.publishedAt + STORY_LIFETIME_MS;
    const expired = s.state === 'PUBLISHED' && kit.now() >= expiresAt;
    const state: StoryState = expired ? 'EXPIRED' : s.state;
    const reason = state !== 'PUBLISHED' ? state : !targetOk(sellerId, s.target) ? 'TARGET_NOT_ELIGIBLE' : null;
    return {
      seller_id: sellerId,
      id: s.id,
      version: s.version,
      state,
      photo_name: s.photo_name,
      text: s.text,
      target: s.target === null ? null : { kind: s.target.kind, id: s.target.id, label: targetLabel(sellerId, s.target) },
      published_at: kit.iso(s.publishedAt),
      expires_at: kit.iso(expiresAt),
      public: reason === null,
      not_public_reason: reason,
      moderation: s.moderation,
      allowed_actions: a.caps.has('content.write') && state === 'PUBLISHED' ? ['WITHDRAW'] : [],
    };
  }

  const handlers: Content['handlers'] = {
    'stories.list': (_i, ctx) => {
      const a = kit.authz(ctx);
      need(a, 'content');
      return { seller_id: a.sellerId, items: storiesOf(a.sellerId).map((s) => storyView(a.sellerId, s, a)), allowed_actions: a.caps.has('content.write') ? ['CREATE'] : [] };
    },
    'stories.targets.get': (_i, ctx) => {
      const a = kit.authz(ctx);
      need(a, 'content');
      return {
        seller_id: a.sellerId,
        products: catalogue.facts(a.sellerId).filter((f) => f.state === 'PUBLISHED' && f.availability !== 'NOT_AVAILABLE').map((f) => ({ id: f.id, label: f.title })),
        scenes: scenesOf(a.sellerId).filter((s) => publicScene(a.sellerId, s.id)).map((s) => ({ id: s.id, label: s.caption })),
      };
    },
    'stories.create': (input, ctx) => {
      const a = kit.authz(ctx);
      need(a, 'content');
      needCap(a, 'content.write');
      return replayable(storyCreated, ctx, () => {
        const errors: Record<string, string> = {};
        if (input.photo_name.trim() === '') errors['photo'] = 'MEDIA_FILE_REQUIRED';
        else if (!input.content_type.startsWith('image/')) errors['photo'] = 'MEDIA_REJECTED'; // exactly one still photo: no video, no other file
        // Same Seller, same Market, publicly eligible. A foreign or unknown id is just "not eligible": existence is not disclosed.
        if (input.target !== null && !targetOk(a.sellerId, input.target)) errors['target'] = 'TARGET_NOT_ELIGIBLE';
        if (Object.keys(errors).length > 0) throw invalid(errors);
        const text = input.text === null || input.text.trim() === '' ? null : input.text;
        const s: StoryRec = { id: kit.next('fx_story'), version: 1, state: 'PUBLISHED', photo_name: input.photo_name, text, target: input.target, publishedAt: kit.now(), moderation: null };
        storiesOf(a.sellerId).unshift(s);
        return storyView(a.sellerId, s, a);
      });
    },
    'stories.withdraw': ({ story_id, version }, ctx) => {
      const a = kit.authz(ctx);
      need(a, 'content');
      needCap(a, 'content.write');
      const s = storiesOf(a.sellerId).find((x) => x.id === story_id);
      if (!s) throw notFound();
      if (s.version !== version) throw conflict();
      // An expired or already ended Story cannot be acted on, and withdrawal is final: nothing here brings it back.
      if (!storyView(a.sellerId, s, a).allowed_actions.includes('WITHDRAW')) throw conflict();
      s.state = 'WITHDRAWN';
      s.version += 1;
      return storyView(a.sellerId, s, a);
    },
    'scenes.list': ({ tab, cursor }, ctx) => {
      const a = kit.authz(ctx);
      need(a, 'content');
      const all = scenesOf(a.sellerId).filter((s) => inTab(a.sellerId, s, tab));
      const start = cursor === null ? 0 : all.findIndex((s) => s.id === cursor) + 1;
      const page = all.slice(start, start + PAGE_SIZE);
      const last = page[page.length - 1];
      return {
        seller_id: a.sellerId,
        items: page.map((s) => summary(a.sellerId, s)),
        next_cursor: start + PAGE_SIZE < all.length && last ? last.id : null,
        allowed_actions: a.caps.has('content.write') ? ['CREATE'] : [],
      };
    },
    'scenes.create': (_i, ctx) => {
      const a = kit.authz(ctx);
      need(a, 'content');
      needCap(a, 'content.write');
      return replayable(created, ctx, () => {
        const s: SceneRec = { id: kit.next('fx_scene'), version: 1, caption: '', image: null, tags: [], state: 'DRAFT', moderation: null };
        scenesOf(a.sellerId).unshift(s);
        return detail(a.sellerId, s, a);
      });
    },
    'scenes.get': ({ scene_id }, ctx) => {
      const a = kit.authz(ctx);
      need(a, 'content');
      return detail(a.sellerId, find(a.sellerId, scene_id), a);
    },
    'scenes.update': (input, ctx) => {
      const { a, s } = open(ctx, input.scene_id, input.version, 'EDIT');
      const errors: Record<string, string> = {};
      let tags = s.tags;
      if (input.tags !== undefined) {
        const seen = new Set<string>();
        const next: TagRec[] = [];
        for (const t of input.tags) {
          // Same-Seller ownership is the server's check, never the client's (CATINV S18): a foreign or unknown id is just ineligible.
          const fact = catalogue.fact(a.sellerId, t.product_id);
          if (!fact || fact.state !== 'PUBLISHED') errors['tags'] = 'TAG_PRODUCT_NOT_ELIGIBLE';
          else if (seen.has(t.product_id)) errors['tags'] = 'TAG_DUPLICATE';
          if (t.hotspots.some((h) => !(h.x_norm >= 0 && h.x_norm <= 1 && h.y_norm >= 0 && h.y_norm <= 1))) errors['hotspots'] = 'HOTSPOT_INVALID';
          seen.add(t.product_id);
          next.push({ product_id: t.product_id, hotspots: t.hotspots.map((h) => ({ id: kit.next('fx_hs'), x_norm: h.x_norm, y_norm: h.y_norm })) });
        }
        tags = next;
      }
      if (Object.keys(errors).length > 0) throw invalid(errors);
      s.caption = input.caption ?? s.caption;
      s.tags = tags;
      s.version += 1;
      return detail(a.sellerId, s, a);
    },
    'scenes.media.set': ({ scene_id, version, file_name, content_type }, ctx) => {
      const { a, s } = open(ctx, scene_id, version, 'EDIT');
      if (file_name.trim() === '') throw invalid({ image: 'MEDIA_FILE_REQUIRED' });
      s.image = { file_name, content_type, addedAt: kit.now() };
      s.version += 1;
      return detail(a.sellerId, s, a);
    },
    'scenes.publish': ({ scene_id, version }, ctx) => {
      const { a, s } = open(ctx, scene_id, version, 'PUBLISH');
      // Recomputed in the command (SCN S32): every blocker at once; nothing changes when any exists.
      if (blockersOf(a.sellerId, s).length > 0) return { seller_id: a.sellerId, result: 'BLOCKED', scene: detail(a.sellerId, s, a) };
      s.state = 'PUBLISHED';
      s.version += 1;
      return { seller_id: a.sellerId, result: 'PUBLISHED', scene: detail(a.sellerId, s, a) };
    },
    'scenes.archive': ({ scene_id, version }, ctx) => {
      const { a, s } = open(ctx, scene_id, version, 'ARCHIVE');
      s.state = 'ARCHIVED';
      s.version += 1;
      return detail(a.sellerId, s, a);
    },
    'scenes.tag_candidates.get': ({ query }, ctx) => {
      const a = kit.authz(ctx);
      need(a, 'content');
      const q = query.trim().toLowerCase();
      const items = catalogue
        .facts(a.sellerId)
        .filter((f) => f.state !== 'DRAFT' && (q === '' || f.title.toLowerCase().includes(q)))
        .map((f) => ({ id: f.id, title: f.title, availability: f.availability, taggable: f.state === 'PUBLISHED' }));
      return { seller_id: a.sellerId, items };
    },
  };

  return {
    handlers,
  };
}

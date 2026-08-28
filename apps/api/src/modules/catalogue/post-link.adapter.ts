import { assertFakeIsPermitted } from '../../common/adapters/fake-guard';
/**
 * Post-link resolution (ADU-DB-01 S9.6): matching is on canonical_post_id,
 * NEVER the URL string — TikTok share links are usually shortened, and
 * matching the raw string fails most of the time. The service performs the
 * redirect chain; the database stores only the canonical result.
 *
 * The real adapter follows redirects with a bounded hop count and parses
 * the platform's canonical id out of the final URL; locally and in tests
 * the fake maps configured URLs.
 */

export interface CanonicalPost {
  readonly platform: 'TIKTOK' | 'INSTAGRAM';
  readonly canonicalPostId: string;
}

export interface PostLinkAdapter {
  /** null when the URL resolves to nothing recognisable. */
  resolve(url: string): Promise<CanonicalPost | null>;
}

export const POST_LINK_ADAPTER = Symbol('POST_LINK_ADAPTER');

export class FakePostLinkAdapter implements PostLinkAdapter {
  constructor() {
    assertFakeIsPermitted('FakePostLinkAdapter');
  }

  private readonly map = new Map<string, CanonicalPost>();

  register(url: string, post: CanonicalPost): void {
    this.map.set(url, post);
  }

  async resolve(url: string): Promise<CanonicalPost | null> {
    return this.map.get(url) ?? null;
  }
}

import { assertFakeIsPermitted } from '../../common/adapters/fake-guard';
import { createLogger } from '../../common/logging';

const log = createLogger();
/**
 * The platform adapter (ADU-DB-01 S13.1 by way of S7.2): each social
 * platform sits behind this interface, and a platform failure degrades to
 * manual verification without affecting the others.
 *
 * INVARIANT — the follower count comes from the ADAPTER, never from the
 * request body. A count the seller supplies is a count the seller chose,
 * and eligibility would be self-attested. The MANUAL_FALLBACK source is an
 * operator path (Phase C6's tooling), not a client one.
 *
 * The real TikTok/Instagram adapters are deployment integrations (like the
 * SMS adapters, ADU-CON-02 section 18); locally and under test the
 * environment binds the fake below, which the specs configure per case.
 */

export interface SocialProfile {
  readonly platformAccountId: string;
  readonly followerCount: number;
  /** Whether the account's public bio currently contains the given code. */
  readonly bioContains: (code: string) => boolean;
}

export interface SocialPlatformAdapter {
  fetchProfile(platform: 'TIKTOK' | 'INSTAGRAM', handle: string): Promise<SocialProfile>;
  /**
   * S9.6 / S24's `social_post.availability_check`: is this post still served
   * by the platform? THROWS on an outage rather than returning false — the
   * caller must be able to tell "deleted" from "cannot reach TikTok", or an
   * incident silently unlinks every seller's catalogue.
   */
  postExists(platform: string, canonicalPostId: string): Promise<boolean>;
}

/** Injection token; AppModule binds by environment. */
export const SOCIAL_PLATFORM_ADAPTER = Symbol('SOCIAL_PLATFORM_ADAPTER');

/**
 * The local/test adapter. Deterministic and configurable: tests register
 * profiles; anything unregistered throws, which exercises the degradation
 * path exactly as a platform outage would.
 */
export class FakeSocialPlatformAdapter implements SocialPlatformAdapter {
  /** Tests register post ids; `true` = live, `false` = deleted, absent = outage. */
  private readonly posts = new Map<string, boolean>();

  constructor() {
    assertFakeIsPermitted('FakeSocialPlatformAdapter');
  }

  registerPost(platform: string, canonicalPostId: string, live: boolean): void {
    this.posts.set(`${platform}:${canonicalPostId}`, live);
  }

  postExists(platform: string, canonicalPostId: string): Promise<boolean> {
    const known = this.posts.get(`${platform}:${canonicalPostId}`);
    if (known === undefined) {
      // Unregistered = the platform could not be reached, which is the
      // degradation the UNKNOWN status exists for.
      return Promise.reject(new Error(`platform unreachable for ${platform}:${canonicalPostId}`));
    }
    return Promise.resolve(known);
  }

  private readonly profiles = new Map<
    string,
    { platformAccountId: string; followerCount: number; bio: string }
  >();

  register(
    platform: string,
    handle: string,
    profile: { platformAccountId: string; followerCount: number; bio: string },
  ): void {
    this.profiles.set(`${platform}:${handle}`, profile);
  }

  async fetchProfile(platform: 'TIKTOK' | 'INSTAGRAM', handle: string): Promise<SocialProfile> {
    const p = this.profiles.get(`${platform}:${handle}`);
    if (!p) {
      throw new Error(`platform unavailable for ${platform}:${handle}`);
    }
    return {
      platformAccountId: p.platformAccountId,
      followerCount: p.followerCount,
      bioContains: (code: string) => p.bio.includes(code),
    };
  }
}

/**
 * NO SOCIAL PLATFORM INTEGRATION IS CONFIGURED (T18 Phase 1).
 *
 * NOT a fake, and so NOT guarded against production -- the same argument
 * NullInferenceAdapter carries, one integration along. A fake pretends to be
 * a vendor and must refuse to run in production; this one says there is no
 * vendor, which is true in every environment we currently have.
 *
 * It THROWS on both calls, and that is the honest answer rather than a
 * convenient one: the interface's own contract is that `postExists` must
 * throw on an outage rather than return false, because the caller has to be
 * able to tell "deleted" from "cannot reach TikTok" -- and "we have no client
 * for TikTok at all" is the strongest possible case of cannot-reach. Both
 * call sites already land on the SPECIFIED degradation and neither of them
 * has to change:
 *
 *   onboarding.service.ts  catches and returns 503-retryable, which is
 *                          S13.1's "a platform failure degrades to manual
 *                          verification without affecting the others".
 *   e3-trust-stock.ts      catches and records UNKNOWN, never UNAVAILABLE,
 *                          because "A PLATFORM OUTAGE IS NOT A DELETED POST".
 *
 * Returning a fabricated profile would be the one unacceptable option: this
 * adapter's own INVARIANT is that the follower count comes from the adapter
 * and never from the seller, so an adapter that invents one is worse than an
 * adapter that refuses.
 */
export class NullSocialPlatformAdapter implements SocialPlatformAdapter {
  constructor() {
    log.warn({
      msg: '[NO SOCIAL PLATFORM] no TikTok/Instagram client is bound; verification degrades to the manual path and post checks record UNKNOWN.',
    });
  }

  postExists(platform: string, canonicalPostId: string): Promise<boolean> {
    return Promise.reject(
      new Error(`no social platform integration is configured (${platform}:${canonicalPostId})`),
    );
  }

  fetchProfile(platform: 'TIKTOK' | 'INSTAGRAM', handle: string): Promise<SocialProfile> {
    return Promise.reject(
      new Error(`no social platform integration is configured (${platform}:${handle})`),
    );
  }
}

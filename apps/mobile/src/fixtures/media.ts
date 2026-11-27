// DEVELOPMENT ONLY. Synthetic demonstration pictures, generated for this fixture world (no third-party asset, no network). They
// are reachable ONLY through this module, which only src/transport/select.ts may load, so the release export carries none of
// them: scripts/verify-release.mjs checks the release output by content hash, with the development export as positive control.
/* eslint-disable @typescript-eslint/no-require-imports -- Metro bundles a picture only through a static require. */
const ASSETS: Readonly<Record<string, number>> = {
  fx_media_demo_s1: require('./assets/s1.png') as number,
  fx_media_demo_s2: require('./assets/s2.png') as number,
  fx_media_demo_s3: require('./assets/s3.png') as number,
  fx_media_demo_s4: require('./assets/s4.png') as number,
  fx_media_demo_s5: require('./assets/s5.png') as number,
  fx_media_demo_s6: require('./assets/s6.png') as number,
  fx_media_demo_p1: require('./assets/p1.png') as number,
  fx_media_demo_p2: require('./assets/p2.png') as number,
  fx_media_demo_p3: require('./assets/p3.png') as number,
  fx_media_demo_p4: require('./assets/p4.png') as number,
  fx_media_demo_p5: require('./assets/p5.png') as number,
  fx_media_demo_p6: require('./assets/p6.png') as number,
  fx_media_demo_p7: require('./assets/p7.png') as number,
  fx_media_demo_p8: require('./assets/p8.png') as number,
};
/* eslint-enable @typescript-eslint/no-require-imports */

/** The fixture side of the media seam: a bundled picture for a reserved media ref, or null (the neutral placeholder). */
export const fixtureMedia = (ref: string): number | null => ASSETS[ref] ?? null;

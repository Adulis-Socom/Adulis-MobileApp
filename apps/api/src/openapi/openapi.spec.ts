import { buildOpenApiDocument } from './generate';

describe('generated OpenAPI contract (ARC-BE-02/05)', () => {
  it('contains only implemented routes: health outside /v1, every other path under /v1', async () => {
    const doc = await buildOpenApiDocument();
    const paths = Object.keys(doc.paths);
    expect(paths.sort()).toEqual(['/healthz', '/livez']);
    for (const p of paths.filter((x) => x !== '/healthz' && x !== '/livez')) expect(p.startsWith('/v1/')).toBe(true);
  });

  it('carries no retired surface', async () => {
    const text = JSON.stringify(await buildOpenApiDocument()).toLowerCase();
    for (const retired of ['reservation', 'payment', 'payout', 'handoff', '/orders', 'evidence']) expect(text).not.toContain(retired);
  });

  it('is byte-stable across builds', async () => {
    expect(JSON.stringify(await buildOpenApiDocument())).toBe(JSON.stringify(await buildOpenApiDocument()));
  });
});

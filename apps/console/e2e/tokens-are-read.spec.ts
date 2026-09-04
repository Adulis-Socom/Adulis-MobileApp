/**
 * tokens-are-read.spec.ts -- the gate D-285 proved did not exist (T23 Phase 2).
 *
 * `pnpm verify:tokens` compares packages/tokens/src/index.ts to
 * packages/tokens/tokens.css and passes when they agree. Both can be perfectly
 * correct and perfectly unread.
 *
 * THAT IS NOT HYPOTHETICAL. D-285: the console declared its own
 * `:focus-visible { outline: 3px solid var(--adu-color-accent) }` while the
 * token declared 2px and a dedicated `--adu-focus-ring-color`. Because the
 * token's rule is written `:where(...)`, deliberately at specificity ZERO so a
 * surface can override the treatment, THE CONSOLE'S ALWAYS WON. The console
 * painted 3px and never once read the focus token -- which made T21's D-271
 * fix, giving that ring a DARK value because a 2px #1e40af ring on a #14120f
 * page is the colour of the ground it sits on, INERT FROM THE MOMENT IT
 * SHIPPED. Every gate was green. None asked the browser what it painted.
 *
 * SIXTY-NINE VARIABLES, ANY OF WHICH COULD BE DEFINED, VERIFIED AND UNREAD.
 *
 * NOT ALL SIXTY-NINE ARE ASSERTED HERE, and that is deliberate. Three catch the
 * class, because they are the three ways a token gets consumed:
 *
 *   the FOCUS RING      a token read as a whole DECLARATION (outline shorthand)
 *   the ACCENT          a token read as a COLOUR, and the one D-285 bypassed
 *   a SEMANTIC TRIPLE   a token read as a SET, where the danger is that one of
 *                       three is hardcoded and the other two are not
 *
 * A gate that asserted all sixty-nine would be a transcription of tokens.css
 * with a browser attached, and would go stale the day a token is renamed. These
 * three go stale only if the console stops reading tokens at all, which is the
 * thing being guarded.
 *
 * IN BOTH MODES, because a mode is where an unread token is most likely to be
 * WRONG rather than merely unread: light and dark differ, so a hardcoded value
 * that happens to match in light cannot also match in dark.
 */
import { test, expect } from '@playwright/test';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { SEEDED } from './helpers/session';

const here = path.dirname(fileURLToPath(import.meta.url));
const TOKENS_CSS = path.resolve(here, '../../../packages/tokens/tokens.css');

/** `#1e40af` -> `rgb(30, 64, 175)`, which is what getComputedStyle returns. */
function hexToRgb(hex: string): string {
  const h = hex.replace('#', '').trim();
  const n = parseInt(h, 16);
  return `rgb(${(n >> 16) & 255}, ${(n >> 8) & 255}, ${n & 255})`;
}

/**
 * Read a custom property out of tokens.css FOR A MODE.
 *
 * The file declares light on `:root` and dark by REDEFINING ONLY THE RAMP AND
 * THE HUES inside the two dark blocks -- the roles themselves are declared once
 * as var() references, which is what lets a dark block move forty roles by
 * redefining eleven. So a dark lookup is: the dark block if it names the
 * property, otherwise :root, then follow one var() hop through the same rules.
 */
function tokenValue(name: string, mode: 'light' | 'dark'): string {
  const css = readFileSync(TOKENS_CSS, 'utf8');
  const rootBlock = css.slice(css.indexOf(':root {'), css.indexOf('\n}', css.indexOf(':root {')));
  const darkStart = css.indexOf(":root[data-theme='dark']");
  const darkBlock = css.slice(darkStart, css.indexOf('\n}', darkStart));

  const lookup = (prop: string): string | null => {
    const re = new RegExp(`${prop}\\s*:\\s*([^;]+);`);
    if (mode === 'dark') {
      const d = re.exec(darkBlock);
      if (d && d[1]) return d[1].trim();
    }
    const r = re.exec(rootBlock);
    return r && r[1] ? r[1].trim() : null;
  };

  let v = lookup(name);
  for (let hop = 0; hop < 4 && v; hop += 1) {
    const m = /^var\((--adu-[a-z0-9-]+)\)$/.exec(v);
    if (!m || !m[1]) break;
    v = lookup(m[1]);
  }
  if (!v) throw new Error(`token ${name} not found in tokens.css for ${mode}`);
  return v;
}

/** What the browser is actually painting, resolved through the cascade. */
async function painted(page: import('@playwright/test').Page, prop: string): Promise<string> {
  return page.evaluate(
    (p) => getComputedStyle(document.documentElement).getPropertyValue(p).trim(),
    prop,
  );
}

test.describe('the console READS the tokens @safety', () => {
  test('the focus ring, the accent and a semantic triple are the token values', async ({
    page,
  }, testInfo) => {
    // The dark project sets colorScheme; the project name says which is which.
    const mode = testInfo.project.name.startsWith('dark') ? 'dark' : 'light';

    await page.goto(`/s/${SEEDED.sellerId}/orders`);
    await expect(page.locator('[data-order]').first()).toBeVisible();

    // ------------------------------------------------------------------
    // 1. THE CUSTOM PROPERTIES REACH THE DOCUMENT. If the stylesheet never
    //    loaded, everything below would compare '' to '' and pass.
    // ------------------------------------------------------------------
    for (const prop of ['--adu-color-accent', '--adu-focus-ring-width', '--adu-color-danger']) {
      expect(await painted(page, prop), `${prop} is not defined in the document`).not.toBe('');
    }

    // ------------------------------------------------------------------
    // 2. THE VALUES MATCH tokens.css FOR THIS MODE. This is the half that
    //    would have caught the ring being 3px while the token said 2px --
    //    except the ring is a DECLARATION, so it is checked on a real
    //    element below rather than on the property alone.
    // ------------------------------------------------------------------
    const accent = tokenValue('--adu-color-accent', mode);
    expect(
      (await painted(page, '--adu-color-accent')).toLowerCase(),
      'the accent the document carries is not the accent tokens.css declares',
    ).toBe(accent.toLowerCase());

    // A SEMANTIC TRIPLE, read as a set: the failure mode is one of three
    // hardcoded and the other two not, which no single-value check finds.
    for (const role of ['--adu-color-danger', '--adu-color-danger-bg', '--adu-color-danger-border']) {
      expect((await painted(page, role)).toLowerCase(), `${role} drifted from tokens.css`).toBe(
        tokenValue(role, mode).toLowerCase(),
      );
    }

    // ------------------------------------------------------------------
    // 3. THE RING, ON A REAL FOCUSED ELEMENT. D-285 exactly: the property
    //    was right and the RULE that consumed it was not, so reading the
    //    property alone would have passed while the console painted 3px.
    // ------------------------------------------------------------------
    await page.keyboard.press('Tab');
    const ring = await page.evaluate(() => {
      const el = document.activeElement as HTMLElement | null;
      if (!el || el === document.body) return null;
      const s = getComputedStyle(el);
      return { width: s.outlineWidth, color: s.outlineColor, offset: s.outlineOffset };
    });
    expect(ring, 'nothing took keyboard focus, so the ring could not be measured').not.toBeNull();

    expect(ring?.width, 'the painted ring width is not --adu-focus-ring-width').toBe(
      tokenValue('--adu-focus-ring-width', mode),
    );
    expect(ring?.offset, 'the painted ring offset is not --adu-focus-ring-offset').toBe(
      tokenValue('--adu-focus-ring-offset', mode),
    );
    // The ring COLOUR aliases the accent, so this is the assertion that fails
    // if the console goes back to reading --adu-color-accent directly in a
    // mode where the two ever diverge, and the one that proves D-271's dark
    // value is actually on screen.
    expect(ring?.color, 'the painted ring colour is not the focus token').toBe(hexToRgb(accent));
  });
});

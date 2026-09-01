# @adulis/tokens

Design tokens shared by the console, the mobile app and the public website.

**Real, since T14 Part B.** The placeholder ("no tokens are defined here")
is withdrawn: T7 S7.2 held while the console was two screens, and twenty-two
more on a placeholder is twenty-two to revisit, so the values are defined now.

## What is here, and what is deliberately not

- `src/index.ts` -- the values as TypeScript, for React Native and any JS.
- `tokens.css` -- the same values as CSS custom properties, for the web
  surfaces. The two are kept in step by hand; a drift between them is a defect
  to fix in **both** until a build step derives one from the other.

**Values only -- no component** (root `CLAUDE.md`, the three seams). A web
button and a React Native button share values, not code. A primitive is
extracted when a second screen needs it, not before; a design system built
ahead of its screens is a set of guesses about screens.

## The shape of it

- A **neutral ramp** (`neutral[0..900]`), warm, with real steps; every role
  colour is a named position on it, not an unrelated grey.
- **One accent**, for action only, with hover / active / subtle states. If it
  appears where nothing is clickable, it is wrong.
- **Semantic state** as triples (`danger` / `dangerBg` / `dangerBorder`, and
  the same for success / warn / info). **No state is carried by colour alone**
  (ADU-CON-03 S15): the triple is there so a chip reads with an icon or a word
  in greyscale.
- A **type scale** with generous line-heights for Ge'ez (heading 1.3, base
  1.5), Latin-first with a Noto Sans Ethiopic fallback, and a mono family for
  request ids and amounts.
- A **spacing scale** (4px base) and **radii**.
- A **44px** minimum touch target, and a **focus ring** -- `tokens.css`
  applies a visible keyboard-only `:focus-visible` outline from the first
  primitive rather than retrofitting one.

Built for the conditions this product runs in: **high contrast** for sunlight
and cheap mid-range Android (the lightest text token clears 4.5:1 on white),
**restraint** because trust is the product, and **no fixed heights on text**
because Amharic runs 30-50% longer.

## Distribution

The public website keeps its own repository, and this package is **copied
there** until publishing it is worth the trouble (ADU-CON-02 S12) -- recorded
and accepted, not an oversight.

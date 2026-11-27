---
name: Adulis Seller Console
description: A ruled-row ledger of what the server decided, in a conventional app shell on the cool-neutral CTO palette, with one lime action per screen.
colors:
  page: "#f5f5f7"
  surface: "#ffffff"
  secondary: "#f4f5f7"
  secondary-hover: "#e5e7eb"
  secondary-active: "#c8ccd5"
  rule: "#e5e7eb"
  edge: "#7e8494"
  ink: "#111111"
  ink-hover: "#1f232d"
  ink-active: "#333846"
  text-secondary: "#333846"
  text-muted: "#5b6272"
  on-ink: "#ffffff"
  lime: "#c4fe29"
  lime-hover: "#b5ef18"
  lime-active: "#a5dd0a"
  lime-border: "#111111"
  danger: "#b91c1c"
  danger-bg: "#fef3f2"
  danger-border: "#fda29b"
  success: "#05603a"
  success-bg: "#ecfdf3"
  success-border: "#a6e9c6"
  warn: "#b54708"
  warn-bg: "#fffaeb"
  warn-border: "#fedf89"
  info: "#333846"
  info-bg: "#f4f5f7"
  info-border: "#c8ccd5"
typography:
  title:
    fontFamily: "system-ui, -apple-system, 'Segoe UI', Roboto, 'Noto Sans', 'Noto Sans Ethiopic', sans-serif"
    fontSize: "1.75rem"
    fontWeight: 700
    lineHeight: 1.3
    letterSpacing: "-0.01em"
  state-title:
    fontFamily: "system-ui, -apple-system, 'Segoe UI', Roboto, 'Noto Sans', 'Noto Sans Ethiopic', sans-serif"
    fontSize: "1.375rem"
    fontWeight: 700
    lineHeight: 1.3
  heading:
    fontFamily: "system-ui, -apple-system, 'Segoe UI', Roboto, 'Noto Sans', 'Noto Sans Ethiopic', sans-serif"
    fontSize: "1.125rem"
    fontWeight: 600
    lineHeight: 1.3
  body:
    fontFamily: "system-ui, -apple-system, 'Segoe UI', Roboto, 'Noto Sans', 'Noto Sans Ethiopic', sans-serif"
    fontSize: "1rem"
    fontWeight: 400
    lineHeight: 1.5
  label:
    fontFamily: "system-ui, -apple-system, 'Segoe UI', Roboto, 'Noto Sans', 'Noto Sans Ethiopic', sans-serif"
    fontSize: "0.875rem"
    fontWeight: 600
    lineHeight: 1.5
  badge:
    fontFamily: "system-ui, -apple-system, 'Segoe UI', Roboto, 'Noto Sans', 'Noto Sans Ethiopic', sans-serif"
    fontSize: "0.8125rem"
    fontWeight: 600
    lineHeight: 1.35
  code:
    fontFamily: "ui-monospace, 'SF Mono', 'Cascadia Code', 'Roboto Mono', monospace"
    fontSize: "1rem"
    fontWeight: 400
    lineHeight: 1.5
    letterSpacing: "0.15em"
rounded:
  sm: "0.25rem"
  md: "0.5rem"
  lg: "0.75rem"
  full: "9999px"
spacing:
  xs: "0.25rem"
  sm: "0.5rem"
  smd: "0.75rem"
  md: "1rem"
  lg: "1.5rem"
  xl: "2rem"
  xxl: "3rem"
  touch-min: "44px"
components:
  button-primary:
    backgroundColor: "{colors.ink}"
    textColor: "{colors.on-ink}"
    typography: "{typography.label}"
    rounded: "{rounded.md}"
    padding: "0.5rem 1rem"
    height: "44px"
  button-primary-hover:
    backgroundColor: "{colors.ink-hover}"
  button-primary-active:
    backgroundColor: "{colors.ink-active}"
  button-highlight:
    backgroundColor: "{colors.lime}"
    textColor: "{colors.ink}"
    rounded: "{rounded.md}"
    padding: "0.5rem 1rem"
    height: "44px"
  button-highlight-hover:
    backgroundColor: "{colors.lime-hover}"
  button-highlight-active:
    backgroundColor: "{colors.lime-active}"
  button-quiet:
    backgroundColor: "{colors.surface}"
    textColor: "{colors.ink}"
    rounded: "{rounded.md}"
    padding: "0.5rem 1rem"
    height: "44px"
  button-quiet-hover:
    backgroundColor: "{colors.secondary}"
  button-disabled:
    backgroundColor: "{colors.secondary}"
    textColor: "{colors.text-muted}"
    rounded: "{rounded.md}"
  text-input:
    backgroundColor: "{colors.surface}"
    textColor: "{colors.ink}"
    rounded: "{rounded.md}"
    padding: "0.5rem 0.75rem"
    height: "44px"
  badge-success:
    backgroundColor: "{colors.success-bg}"
    textColor: "{colors.success}"
    typography: "{typography.badge}"
    rounded: "{rounded.full}"
    padding: "0.125rem 0.5rem"
  badge-warn:
    backgroundColor: "{colors.warn-bg}"
    textColor: "{colors.warn}"
    typography: "{typography.badge}"
    rounded: "{rounded.full}"
    padding: "0.125rem 0.5rem"
  badge-danger:
    backgroundColor: "{colors.danger-bg}"
    textColor: "{colors.danger}"
    typography: "{typography.badge}"
    rounded: "{rounded.full}"
    padding: "0.125rem 0.5rem"
  badge-neutral:
    backgroundColor: "{colors.secondary}"
    textColor: "{colors.text-secondary}"
    typography: "{typography.badge}"
    rounded: "{rounded.full}"
    padding: "0.125rem 0.5rem"
  ledger-row:
    backgroundColor: "{colors.surface}"
    textColor: "{colors.ink}"
    padding: "0.75rem 1rem"
    height: "44px"
  nav-link:
    textColor: "{colors.ink}"
    typography: "{typography.label}"
    rounded: "{rounded.md}"
    padding: "0 0.75rem"
    height: "44px"
  nav-link-active:
    backgroundColor: "{colors.ink}"
    textColor: "{colors.on-ink}"
  sidebar:
    backgroundColor: "{colors.secondary}"
    width: "15rem"
    padding: "1rem"
  state-panel:
    backgroundColor: "{colors.surface}"
    rounded: "{rounded.lg}"
    padding: "1rem"
---

# Design System: Adulis Seller Console

## Overview

**Creative North Star: "The Ledger of What the Server Decided"**

The Console is an operating surface for sellers and their teams, used in sunlight on mid-range Android and on desktop. It does not decorate. Each screen reads as ruled rows of fact: a requirement or obligation, its status in words with a drawn mark, and its one resolving action. The console computes no business state, so the interface shows what the server resolved and nothing it invented. There are no metric tiles because there is no revenue, GMV or order figure to show.

The shell is conventional on purpose: a 15rem secondary-layer sidebar from 1024px, a top bar on every seller route, a bottom bar below 1024px. The distinctiveness sits inside the content area, in the ledger. The palette is the founder-approved cool neutral ramp (page #F5F5F7, white raised surfaces, hairline rules) with near-black action and a single lime accent. The system is light only; no dark theme exists.

Density is moderate and never cramped. Every length that scales with text is in rem and nothing that holds text has a fixed height, because Amharic runs 30 to 50 percent longer.

**Key Characteristics:**
- Ruled-row ledger sections rather than boxed cards; rows, not tiles.
- Status is always a drawn icon plus a word; colour only reinforces.
- Near-black is the action colour; lime marks the one standout action per screen.
- One system font stack, fixed rem scale, tabular numerals for times.
- Flat: tonal layers and hairlines carry depth, shadows are almost absent.
- 44px minimum targets, a visible 2px ink focus ring, reduced-motion respected.

## Colors

A cool-grey, high-contrast ramp with near-black as the action colour and one lime accent. Semantic colours exist only as text/background/border triples.

### Primary
- **Ink** (`#111111`): primary buttons, active navigation (with white text), the focus ring, heading and body text, the notification count badge, the caret. Hover and active step along the ramp (`ink-hover`, `ink-active`).

### Secondary
- **Mist Layer** (`#f4f5f7`): the sidebar and bottom bar fill, hover washes, disabled controls, neutral badges, inline code. Hover and active steps are the rule and deeper grey (`secondary-hover`, `secondary-active`).

### Tertiary
- **Signal Lime** (`#c4fe29`): the one standout action of a screen. Always filled with Ink text and drawn with a 1px Ink border, because lime against the page is about 1.1:1. Never text, never decoration.

### Neutral
- **Page Grey** (`#f5f5f7`): the page background.
- **Raised White** (`#ffffff`): ledgers, panels, fields, dialogs, the top bar.
- **Hairline** (`#e5e7eb`): rules between ledger rows and quiet borders.
- **Control Edge** (`#7e8494`): the boundary of fields, quiet buttons and unchosen options (3:1 or better).
- **Secondary Text** (`#333846`) and **Muted Text** (`#5b6272`): meta lines and hints; Muted is the lightest text permitted.
- **Semantic triples**: danger, success, warn and info each as text, tinted background and border. Info is a neutral role, not a hue.

### Named Rules
**The One Lime Rule.** Lime appears once per screen, on the single standout action, with Ink text and an Ink border. A second lime element is a defect.

**The Never Colour Alone Rule.** No state is carried by colour alone. A status is a badge with a drawn icon and a word.

**The Role Not Hex Rule.** All colour comes from the shared token custom properties. No literal colour appears in the stylesheet or in components.

## Typography

**Display Font:** none; the system stack is by design (tokens): system-ui, -apple-system, Segoe UI, Roboto, Noto Sans, Noto Sans Ethiopic.
**Body Font:** the same stack.
**Label/Mono Font:** ui-monospace stack, used for code-like entries (OTP) and inline code.

**Character:** One family, differentiated only by size and weight. Plain and legible on cheap screens, with Ethiopic fallback present from the start.

### Hierarchy
- **Title** (700, 1.75rem, 1.3, -0.01em): page title, focus target on route change.
- **State title** (700, 1.375rem, 1.3): heading inside a state panel.
- **Heading** (600, 1.125rem, 1.3): section headings, the lead paragraph and brand name share this size.
- **Body** (400, 1rem, 1.5): running text, capped near 70ch.
- **Label** (600, 0.875rem to 1rem, 1.5): labels, legends, buttons, nav, ledger titles.
- **Badge/meta** (600 at 0.8125rem for badges; 400 at 0.875rem for ledger meta and hints, muted colour).

### Named Rules
**The Tabular Time Rule.** Times use tabular numerals.

**The No Fixed Height Rule.** Nothing holding text has a fixed height; lengths that scale with text are rem.

## Layout

A conventional shell with a content column. Content is a single grid column, max 64rem (38rem for narrow single-task pages), gap 1rem, padding 1.5rem top and 1rem sides growing to 2rem sides at 1024px. Spacing is a 4px-based scale (0.25, 0.5, 0.75, 1, 1.5, 2, 3rem).

At 1024px and up: 15rem sidebar left, filling the viewport height and sticky; the top bar is sticky beside it. Below 1024px: the top bar is static (it scrolls away), content follows, and a sticky bottom bar carries the destinations. Fixture builds add a sticky strip above everything; its height is published as `--strip-h` so sticky chrome sits beneath it. Pages are left-aligned and not centred as a hero; sections stack as ruled ledgers.

## Elevation & Depth

Flat. Depth is tonal layering (page grey, white raised surface, secondary layer for chrome) plus 1px hairline borders. The only shadow in the build is on the dialog, and it is a tint of Ink with an Ink-tinted backdrop. A selected choice gains a 1px ring drawn as a box-shadow in Ink.

### Named Rules
**The Flat Rule.** Surfaces are flat at rest. Rules and tone separate; shadows are reserved for the modal dialog.

## Shapes

Gently rounded: 0.5rem on controls, 0.75rem on ledgers, panels, state panels and dialogs, 0.25rem on skeletons and inline code, fully round on badges and the count. Borders are 1px hairline for containers, 1px Control Edge for fields, 2px danger for invalid fields and the error summary. Ledgers clip their rows to the rounded outline. A ledger inside a panel drops its own box and keeps only top and row rules.

## Components

### Buttons
- **Shape:** 0.5rem radius, 44px minimum height, padding 0.5rem 1rem, semibold, 150ms background transition.
- **Primary:** Ink fill, white text; hover and active step to ink-hover and ink-active.
- **Highlight (standout):** lime fill, Ink text, 1px Ink border; once per screen.
- **Quiet:** white fill, Ink text, Control Edge border; hover is the secondary layer.
- **Link-style:** transparent with underline.
- **Disabled:** secondary fill, muted text, not-allowed cursor, set through `aria-disabled`. Unbuilt steps are disabled controls, not links.
- **Focus:** the shared 2px Ink ring at 2px offset on keyboard focus only.

### Status badges
Pill (full radius), icon plus word, 0.8125rem semibold, in neutral, success, warn, danger or info triples. Icons are the shared drawn set.

### Inputs / Fields
White fill, 1px Control Edge border, 0.5rem radius, 44px minimum height, a visible label above and hint in muted text below. Invalid fields take a 2px danger border plus an icon-led message, and a page-level error summary of anchor links. Choice rows are bordered 0.5rem rows with a checked state of Ink border plus ring.

### Navigation
Sidebar (secondary layer, 15rem) and bottom bar (secondary layer, top rule) use the same 44px rows. The current item is Ink fill with white text. Hover is secondary-hover. A disabled destination is muted with an adjacent reason line.

### Ledger (signature)
A white list with a hairline outline, 0.75rem radius and a 1px rule between rows. Each row holds a semibold title, a muted meta line and a trailing status badge or action; rows wrap on narrow screens. Linked rows are full-width anchors with a secondary-layer hover and an inset focus ring. Sections on Home are headings followed by a ledger, with a muted empty-state sentence when a list is empty. Readiness is independent rows, not a wizard.

### State panel
A bordered 0.75rem container with an icon-led heading, used for loading, empty, error and notice states. Tone changes background and border to the info, neutral, warn, danger or success triple, never colour alone.

### Dialog and demonstration strip
The dialog is a white 0.75rem container with a Control Edge border and the one shadow. The demonstration strip is a sticky Ink bar with white small text, rendered only in fixture builds.

## Do's and Don'ts

### Do:
- **Do** express a requirement as a ledger row: title, meta, status badge, its one resolving action.
- **Do** pair every status with a drawn icon and a word.
- **Do** keep lime to the single standout action per screen, with Ink text and Ink border.
- **Do** take every colour, size, space and radius from the shared token properties.
- **Do** keep targets at 44px or more and every list with an empty state.
- **Do** show unbuilt steps as disabled controls with a plain reason.
- **Do** let text wrap; use rem, never fixed heights on text.

### Don't:
- **Don't** nest boxes: a state, notice or ledger inside a panel loses its own border and fill.
- **Don't** use metric tiles or a grid of equal cards for Home.
- **Don't** carry state by colour alone.
- **Don't** use lime as text or decoration, or twice on one screen.
- **Don't** add a dark theme, a second font family, or literal colours.
- **Don't** pin the top bar below 1024px, where it takes half a phone screen.
- **Don't** link to destinations that do not exist yet.

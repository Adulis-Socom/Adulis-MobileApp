---
version: 1
slug: "src"
primary_target: "src"
related_targets: []
---

# Seller Console (SC-FE-01..03) -- Operate surface

Scope and visitor mode: Operate. A seller or team member completing sign-in, admission, readiness and reading Home. Code-led (an app, not a landing page). Established world: the founder-approved CTO tokens; no new world is created.

Audience, job, constraints: see PRODUCT.md. Used in sunlight on mid-range Android and on desktop. Structure is fixed by the governing designs (sidebar >= 1024px, bottom bar Home/Products/Inbox/More below, top bar per CONSOLE-02 S24, Readiness Hub as independent rows), so no structure tournament was run; this is recorded as a substitution.

Unresolved decisions: none visual. Product decisions remain open per PRODUCT.md.

## Direction contract

THESIS: The Console is a ledger of what the server decided. Every screen reads as ruled rows of fact (a requirement, its status in words and a drawn mark, its one resolving action) rather than a grid of equal cards or metric tiles. It refuses the dashboard-of-big-numbers default because no revenue, GMV or order number exists to show.

OWN-WORLD: Cool neutral ramp on the #F5F5F7 page, white raised surfaces, hairline #E5E7EB rules, near-black primary buttons and active nav (white text), a secondary layer #F4F5F7 for sidebar, bottom bar and quiet controls, and lime #C4FE29 with a 1px #111 border for the single standout action per screen. System UI stack, one family, fixed rem scale at ratio 1.2, tabular numerals for times. A drawn SVG icon set in one 1.75 stroke. Status is always icon plus word (done, needs action, waiting, unavailable, blocked), never colour alone. A persistent black demonstration strip with white text sits above everything in fixture builds.

STORY: A seller learns in one look which requirements are met and what is still theirs to do, resolves them in any order, and finds Home honest about what does not exist yet. A team member sees only what their capabilities allow, with a plain reason where a feature is disabled.

FIRST VIEWPORT: Desktop Home: 15rem secondary-layer sidebar left (five-plus destinations, active item black), top bar across the content (Seller name, switcher when more than one Seller, bell with unread count, Help, account), then the page title and a status sentence, then ruled sections: readiness rows with the one lime action on the first unmet item, or the operating brief rows. Mobile: top bar, page title, the same rows full-width, bottom bar with four destinations at 44px+ targets.

FORM: Left-aligned ruled-row ledger inside a conventional app shell (list position: dealt structure not applicable); seed: none (pinned) "Readiness is a Hub of independent items, not a wizard" and "Do not build a brittle linear wizard".

FINISH: unreviewed and undocumented is unfinished; this build ends with the finish review, the verdict, DESIGN.md, and every shipping raster carrying its provenance

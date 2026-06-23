# Command Center, design system

The visual language is token-driven. Each theme is a `Theme` object whose
`tokens` are flattened to `--cc-*` CSS custom properties at runtime
(`tokensToCssVars` / `applyTokens`), so `styles.css` reads from variables and
never hard-codes a palette. Switching theme re-paints by swapping variables.

## Themes

Eight shipped themes, two of them the auto day/night default:

- **Mineral** (day default): limestone ground, slate ink, oxidized-copper
  accent. Editorial, warm, restrained.
- **Twilight** (night default): the dark counterpart.
- **Hermione**: parchment light, oxblood accent.
- **Kirk**: deep-space dark, command-gold accent.
- **Supa**: terminal dark, phosphor-green accent.
- Aurora, Paper, Mono.

`resolveActiveTheme(config, now)` picks Mineral by day and Twilight by night
unless the user pins a theme.

## Color

Colors live in tokens, not in CSS. The role set:

- `bg`, `surface`: tinted neutrals, never pure `#000` / `#fff`. Mineral's ground
  is `#ECE8E0`, surface `#F8F6F1`.
- `text` `#21242A`, `muted` `#6A6E76`: ink and secondary ink.
- `accent` carries the theme's identity, used sparingly (one accent, product
  register, well under 10% of the surface).
- `positive` / `urgent`: state-only. Urgent (`#A4503C` rust in Mineral) appears
  only for overdue or at-risk, never decoration.
- Backgrounds are gentle vertical gradients (`background.value`), not flat fills.

Hairlines and fills are derived at the edge with `color-mix(in srgb, ...)` so
they track the active theme.

## Typography

- Display and UI: **Archivo Variable** (system-ui fallback). One family.
- Numerics are tabular (`numericTabular`) so clocks and timelines do not jitter.
- Hierarchy comes from scale and weight, not color. Clocks are large and light;
  labels are small, 600 weight, sometimes tracked uppercase.

## Space and shape

- Base unit 4px. Card padding 16px, card radius 14px (`--cc-card-radius`).
- Layout: a centered header (greeting + home clock), a timezone row with a 24h
  overlap timeline, and a three-column grid of compact work-stream panels.
- The dock is fixed bottom-center, floating above the ground.
- Panels are deliberately short (~150px min) so the page reads as a glance, not
  a feed.

## Motion

- `motion.enabled` / `speed` gate transitions globally.
- Ease-out only, exponential curves (e.g. `cubic-bezier(0.22, 1, 0.36, 1)`).
  No bounce, no elastic. Never animate layout properties.

## Components

- **Home clock + greeting**: the page's anchor, top-center.
- **Zone row**: home plus other timezones, each with local time and an overlap
  bar marking the shared meeting window.
- **Dock**: fixed bottom-center pill of favicon links.
- **Work-stream panels**: a brand tile (real Google Calendar / Linear / Notion
  marks on a white app tile), a title, and the connection's items, or a
  connect / loading / empty state.
- **Customize drawer**: a right slide-in dialog with stacked sections
  (Timezones, Dock links, Connections, Work streams, Wallpaper, Appearance,
  Backup). Edits apply live to the surface behind it. Rows use a hover-revealed
  grab handle for drag-reorder and inline inputs for editing.

## Edit-pane conventions

- Section title: small, uppercase, tracked, muted.
- Rows: `.cc-edit__row`, hairline border, surface-tinted background.
- Reorderable rows add `.cc-edit__row--drag` with a six-dot `.cc-edit__grip`
  that fades in on hover; `.is-dragging` and `.is-drop-target` mark drag state.
- Inputs are flat with a hairline; chips are pill toggles with an `.is-active`
  state.

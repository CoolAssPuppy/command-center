# Themes

Themes are the presentation layer. A theme takes the semantic widgets from [13-representation-model.md](13-representation-model.md) and paints them. Command Center ships two to three beautiful themes and publishes a guideline so anyone can build more.

A theme owns pixels and only pixels. It never sees raw credentials, never fetches provider data, and never changes what a provider published. It decides how a metric, a list, a table, a chart, and a background look and move.

## Two tiers of theme

Most people who want to theme do not want to write a renderer. So there are two tiers, and the easy one is the default.

### Tier 1: token themes

A token theme is design tokens and assets only. No code. It restyles the platform's built-in renderers.

```text
my-theme/
  theme.json        # metadata and capability declaration
  tokens.json       # colors, type, spacing, radii, motion, background
  assets/           # optional fonts, background images
```

Token themes are safe by construction. They cannot run logic, cannot reach the network, and cannot break layout. They are the right tool for the large majority of looks: a light editorial theme, a dark glass theme, a high-contrast theme. We expect most community themes to be this tier.

### Tier 2: render themes

A render theme provides custom renderers for some or all widget types, so it can do things tokens cannot: bespoke chart styling, canvas or SVG or WebGL effects, an animated ambient background, novel layouts.

```text
my-theme/
  theme.json
  tokens.json
  renderers.js      # exports render functions per widget type
  assets/
```

Render themes are powerful and therefore trusted code. They run in the new tab page and can see the glanceable data on screen. That is a privacy surface, so they carry a trust model, described below. For the first release we ship first-party render themes and publish the API. Third-party render themes are gated behind explicit user install and review.

## theme.json

```json
{
  "schemaVersion": 1,
  "themeId": "com.acme.aurora",
  "name": "Aurora",
  "author": "Acme",
  "version": "1.0.0",
  "tier": "render",
  "renders": ["metric", "list", "table", "chart", "timeline", "progress", "text", "background"],
  "supportsReducedMotion": true,
  "supportsLightDark": true
}
```

`renders` declares which widget types the theme draws itself. Anything not listed falls back to the platform's default renderer styled by the theme's tokens. A theme must, directly or through fallback, be able to render every widget type, so the surface is never blank.

## Tokens

Tokens are the shared styling contract. The platform exposes a fixed set, and themes provide values.

```json
{
  "color": {
    "bg": "#0B0F1A", "surface": "#121826", "text": "#E6EAF2",
    "muted": "#9AA4B2", "accent": "#7C8CFF",
    "positive": "#34D399", "urgent": "#F87171"
  },
  "type": { "fontFamily": "Inter, system-ui", "scale": 1.0, "numericTabular": true },
  "space": { "unit": 4, "cardPadding": 16, "cardRadius": 16 },
  "motion": { "enabled": true, "speed": 1.0 },
  "background": { "mode": "gradient", "value": "linear-gradient(...)", "imageOfDay": false }
}
```

The platform maps tones, `positive`, `urgent`, `neutral`, to token colors, so a provider that marks a glance `urgent` is shown in the theme's urgent color, whatever that is.

## The render API, Tier 2

A render theme exports a module the platform calls. Each renderer receives a host node, the widget model, and a context with tokens and helpers.

```js
export default {
  meta: { /* mirrors theme.json */ },

  renderMetric(host, model, ctx) { /* paint into host */ },
  renderList(host, model, ctx)   { /* ... */ },
  renderTable(host, model, ctx)  { /* ... */ },
  renderChart(host, model, ctx)  { /* model.data.subtype, series ... */ },
  renderTimeline(host, model, ctx) { /* ... */ },
  renderProgress(host, model, ctx) { /* ... */ },
  renderText(host, model, ctx)   { /* ... */ },

  // Optional ambient layer behind all cards.
  renderBackground(host, ctx)    { /* ... */ }
}
```

- `host` is an isolated node, a shadow root, so a theme's styles cannot leak into or be broken by the platform or another theme.
- `ctx` carries resolved tokens, a number and date formatter, the user's locale, and a `reducedMotion` flag the theme must honor.
- `model` is the widget data only. A theme cannot request more data, cannot reach a provider, and has no token or credential in scope.

When a theme renders an action target, it must call `ctx.invokeAction(item.action)` rather than building a URL itself. The platform still validates and routes. A theme cannot open arbitrary URLs.

## Isolation and limits

- Each card renders into its own shadow root. Themes cannot read across cards through the DOM.
- The theme execution context has a content security policy with no network: `connect-src 'none'`. A render theme cannot exfiltrate what it draws.
- Themes run within the page's performance budget. First paint from cache stays under 100ms, so theme guidelines include a performance section and a frame budget for animations and charts.
- Reduced motion is mandatory to honor. A theme that ignores it fails review.

## Trust model for third-party render themes

Because a render theme runs code and sees on-screen data, third-party render themes are installed deliberately, never silently:

1. The user installs a theme explicitly and sees its author and a plain-language note that it can see what is shown on the dashboard, though not credentials or raw provider data.
2. The no-network policy above means a theme cannot send that data anywhere.
3. Token themes carry none of this weight and can be offered freely, because they are data, not code.

This mirrors the provider trust model in [10-security.md](10-security.md): power requires consent, and the safe tier is the default.

## What ships

Two to three first-party themes that show the range and set the bar:

- Aurora. A dark glass look with a living gradient background and soft motion. The showpiece.
- Paper. A calm light, editorial theme with generous type. Quiet and focused.
- Mono. A dense, high-information theme with tabular numbers and sparklines, for people who want maximum signal per pixel.

Each ships as a render theme so it can demonstrate charts, motion, and backgrounds, and each also exposes its tokens so people can fork a token theme from it. The published guideline explains the tiers, the token set, the render API, the isolation rules, and the trust expectations, with a sample theme of each tier.

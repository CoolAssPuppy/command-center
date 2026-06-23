# Representation model

This is the shared language between providers and themes. A provider declares what it has and how it wants it shown, using a fixed vocabulary of widgets. A theme renders that vocabulary into pixels. The core guarantees that every theme can render every widget.

The rule, restated: providers declare intent, themes render. A provider never ships HTML, CSS, JavaScript, images-as-layout, or any pixels. It picks a widget type and binds data. This is what makes the platform safe to open and themeable by anyone.

## A provider publishes cards

The unit a provider publishes is a card. A card has a header, a glance line, and one or more widgets.

```json
{
  "schemaVersion": 1,
  "card": {
    "title": "DeployBot",
    "icon": "rocket",
    "accentColorHex": "#16A34A",
    "glance": { "value": "2", "label": "deploys today", "tone": "positive", "trend": "up" },
    "preferredSize": "medium",
    "widgets": [ ]
  }
}
```

- `glance` is required. It is the one-line summary the platform can always show, even when the card is collapsed, demoted, or shown in a dense layout. It is a small metric: a `value`, a `label`, an optional `tone` of `neutral`, `positive`, or `urgent`, and an optional `trend` of `up`, `down`, or `flat`.
- `preferredSize` is a hint, `small`, `medium`, or `large`. The platform's attention and layout model has the final say, not the provider.
- `widgets` is the body, shown when the card has room.

## The widget vocabulary

Every theme must render all of these. Providers may use only these. Each widget has a `type`, an optional `title`, typed `data`, optional `action`, and optional `hints`.

### metric

A number or short string with meaning.

```json
{ "type": "metric", "title": "Open PRs",
  "data": { "value": "12", "label": "awaiting review", "tone": "urgent", "trend": "up", "delta": "+3" } }
```

### list

Rows of items, the workhorse for inboxes and schedules.

```json
{ "type": "list", "data": { "items": [
  { "leading": { "kind": "avatar", "url": "https://..." },
    "title": "Grace assigned ENG-412",
    "subtitle": "2m ago",
    "trailing": { "kind": "badge", "text": "urgent", "tone": "urgent" },
    "action": { "ref": "open", "params": { "url": "https://linear.app/..." } } }
] } }
```

`leading` may be an `avatar`, an `icon`, or a `colorDot`. `trailing` may be a `badge`, `text`, or `time`.

### table

Columns and rows with typed cells.

```json
{ "type": "table",
  "data": {
    "columns": [ { "key": "name", "label": "Service", "type": "text" },
                 { "key": "p95", "label": "p95", "type": "number", "unit": "ms" },
                 { "key": "status", "label": "", "type": "badge" } ],
    "rows": [ { "name": "api", "p95": 142, "status": { "text": "ok", "tone": "positive" } } ]
  } }
```

Cell types: `text`, `number`, `date`, `badge`, `progress`.

### chart

Series data. The provider picks a subtype; the theme draws it.

```json
{ "type": "chart", "title": "Signups",
  "data": {
    "subtype": "line",
    "xType": "time",
    "yLabel": "signups",
    "series": [ { "name": "this week", "points": [ { "x": "2026-06-14T00:00:00Z", "y": 120 } ] } ]
  } }
```

Subtypes every theme renders: `line`, `area`, `bar`, `sparkline`, `donut`, `gauge`. `xType` is `time`, `category`, or `number`. Color comes from the theme by default; a provider may suggest a series color with the series `colorHex` field, which the theme is free to honor or override. (A general `hints` mechanism is planned but not yet in the schema.)

### timeline

Time-anchored items along an axis, used for a day's events or a world clock strip.

```json
{ "type": "timeline",
  "data": { "from": "2026-06-14T08:00:00-07:00", "to": "2026-06-14T18:00:00-07:00",
            "items": [ { "start": "2026-06-14T16:00:00-07:00", "end": "2026-06-14T16:30:00-07:00",
                         "label": "Design review", "tone": "neutral",
                         "action": { "ref": "join", "params": { "url": "https://meet.google.com/..." } } } ] } }
```

### progress

A value between 0 and 1 with a label.

```json
{ "type": "progress", "data": { "value": 0.6, "label": "Sprint 14", "tone": "neutral" } }
```

### text

Short plain text with light emphasis. No HTML, no links as markup. Links are expressed as actions, never as embedded anchors.

```json
{ "type": "text", "data": { "body": "All systems normal.", "emphasis": "muted" } }
```

## Actions

Widgets do not open things directly. They reference an action declared in the provider's manifest, and the platform resolves it safely.

```json
"actions": [
  { "id": "open", "urlTemplate": "linearbar://open?url={url}" },
  { "id": "join", "route": "commandcenter://join" }
]
```

A widget item carries `"action": { "ref": "open", "params": { "url": "..." } }`. The platform fills the template or route, validates the URL, and only then navigates. In defense in depth, the dashboard enforces the scheme allowlist (dangerous schemes blocked) and the native app enforces the host allowlist (a `commandcenter://join` target must be a known meeting host). A provider can never cause an arbitrary URL to open. See [10-security.md](10-security.md).

## Hints, not commands

A provider may attach `hints` to a widget: a preferred series color, a compact or expanded preference, a number format. Hints are advisory. The theme and the platform may honor or ignore them. This keeps the provider's intent expressible without letting it dictate the look, which is the theme's job.

## Convenience kinds

The fixed feed kinds in [04-feed-schemas.md](04-feed-schemas.md), such as `calendar.today` and `linear.inbox`, are convenience layers over this model. They exist so common cases need no widget authoring. The platform maps each convenience kind to a default card and widget set, which a theme then renders. A provider that wants full control over representation publishes widgets directly. A provider that just has events publishes `calendar.today` and lets the platform shape it.

## Why the vocabulary is fixed

A fixed, curated vocabulary is the price of two open communities coexisting. If providers could publish arbitrary markup, no theme could promise to render it, and any provider could break the page or leak data. By constraining providers to declared semantics, every theme can render every provider, the platform can enforce the glance and the attention budget, and the surface stays safe and consistent. The vocabulary grows deliberately, by adding new widget types to the spec, never by letting providers smuggle in their own.

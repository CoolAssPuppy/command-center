# Dashboard UI

The dashboard is the product. Everything else exists to feed it. Build it static-first against mock data so it can be seen and refined before any native wiring.

## Tech choice

Keep it light. The dashboard ships as static assets inside the extension and must load instantly on every new tab.

- Plain TypeScript compiled to a single bundle, or a minimal framework if preferred. Avoid heavy runtimes. A new tab page that takes 400ms to paint feels broken.
- One CSS file with custom properties for theming. Theme tokens come from settings.
- No network on first paint except weather, which loads after the layout is up.
- Bundle a small IANA city table for the time zone picker. No runtime fetch for time zones.

The build outputs to `CommandCenterExtension/Resources/assets/` and `newtab.html` references the bundle.

## Data lifecycle

1. On load, paint the shell immediately with last-known data from `localStorage`, so the page never flashes empty.
2. Call `getDashboard` over native messaging.
3. Replace the shell with live data. Cache the payload to `localStorage` for the next instant paint.
4. Poll every 60 seconds and on `visibilitychange` to visible. New tabs are short-lived, so this is plenty.

## Layout

A calm, single-screen grid. No scrolling for the common case.

```text
+--------------------------------------------------------------+
|  9:41 AM            Saturday, June 14            [weather]    |
|  Good morning, Prashant                                       |
+----------------------------+---------------------------------+
|  TODAY                      |  WORLD CLOCK                    |
|  9:30  Design review  Join  |  SF   9:41 AM  (sun)            |
|  11:00 1:1 with Grace Join  |  LON  5:41 PM  (sun)            |
|  2:00  Offsite planning     |  BLR 10:11 PM  (moon)  +12:30   |
|                             |  [timeline strip]               |
+----------------------------+---------------------------------+
|  LINEAR INBOX  (3)          |  REMINDERS                      |
|  Grace assigned ENG-412     |  Send offsite agenda  5:00 PM   |
|  SLA at risk ENG-388        |  Review PR                      |
+----------------------------+---------------------------------+
```

Cards are driven by which providers exist. The grid reflows when a card is absent. Order is configurable in settings, with a sensible default: schedule, world clock, then provider cards, then reminders.

## Widgets

### Header

Current local time and date, computed from the browser, updated each minute. A greeting using the user's name from settings. The weather summary sits top right.

### Today (schedule)

Renders `calendar.today` feeds, merged across providers and sorted by start time. Each row shows time, title, and a colored dot for the calendar. Events that are happening now get a subtle highlight. Rows with a `meeting` object get a Join button.

Join navigates to `commandcenter://join?url=<encoded>&platform=<platform>`. The dashboard does not open browsers. It hands off to the native app, which honors the user's per-platform browser routing.

Location and attendee count show as secondary text. Keep it scannable.

### World clock

Renders the cities in settings. For each city: current time, day or night glyph, and the date offset from local, for example `+1` or `-1` shown only when the date differs. Below the list, a horizontal timeline strip aligns each city's current hour against the user's local hours, so overlap windows are visible at a glance. Day or night uses local hour bands first, refined by sunrise and sunset from the weather source for the matching city when available.

### Weather

Reads the chosen location from settings, fetches Open-Meteo by latitude and longitude, and shows current temperature, condition, and a short daily range. Units come from settings. This is the only first-party network call.

### Provider cards

One card per provider feed kind the dashboard knows. Linear inbox renders `linear.inbox` with unread count, actor, reason phrase, and target identifier. Clicking a row runs the provider's `open` action from the manifest, which routes through `commandcenter://openProvider` so it lands in the Linear Bar app. Future kinds, `docs.recent` for Notion for example, render with the same card shell.

### Reminders

Renders `reminders.today`. Overdue items, if included, sort to the top with a quiet warning tint.

## States

Every card handles these without layout jumps:

- Loading: skeleton rows, never a spinner that shifts layout.
- Empty and ok: a calm line such as "No events today".
- Needs auth: "Reconnect in Linear" button that runs the provider action.
- Stale: a small "updated 6m ago" timestamp, data still shown.
- Provider absent: the card is not rendered at all.

## Look and feel

Theming is data, not code. The dashboard reads tokens from settings and sets CSS custom properties:

- Color theme: light, dark, or follow system, with an accent color.
- Background: solid, gradient, or a daily image and quote if the user enables it.
- Density: comfortable or compact.
- Font scale.

Defaults should look finished out of the box. Aim for the quiet confidence of a well-made start page, not a settings panel pretending to be a product. See [08-settings-sync.md](08-settings-sync.md) for the token list.

## Accessibility and performance

- Full keyboard navigation. Join and provider rows are real buttons and links.
- Respect reduced motion. The timeline and any background animation freeze when the user asks.
- Target first paint under 100ms from cache, live data swap under 300ms.
- All text meets contrast on both themes.

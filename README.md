# Command Center

A calm Chrome new tab page. World clocks, a meeting-window finder, a five-day
forecast, a dock of links, data cards from Google Calendar, Linear, and Notion,
and a wallpaper that can be a gradient, a slow fluid drift, or an Unsplash photo.
The whole surface shifts with the time of day. Inspired by Sean Oliver's
[solstice](https://github.com/seanoliver/solstice).

## What it does

- A big local clock for your home timezone, with a row of other zones showing the
  offset, day or night (a corner sun or moon), and current temperature.
- A **meeting window** that finds the best overlap across your zones and says
  honestly when no single hour catches everyone.
- A **five-day forecast** strip under the home clock, with minimalist icons, in
  Fahrenheit or Celsius.
- A **day and night theme** that auto-switches with your home zone: Mineral by
  day, Twilight by night, or pick one of eight.
- A macOS-style **dock** of links with hover magnification and real brand icons
  for Gmail and Google Calendar.
- **Data cards**: titled panels that show a connection's items. A Google
  Calendar agenda, your Linear inbox, a Notion database, or all your calendars
  merged into one.
- A **wallpaper** that is the theme gradient, a slow fluid drift, an Unsplash
  photo (by random subject, on a frequency you choose), or a custom image.
- **Drag to rearrange** anything in place: timezone cards, data cards, and dock
  links reorder on the dashboard and sync to the editor.
- A 12 or 24 hour clock, and settings import and export.

Everything is serverless. Settings live in `chrome.storage`; your keys never
leave the browser.

## Themes

Eight token themes plus an auto day/night mode:

- **Mineral** (day default) and **Twilight** (night default).
- **Hermione** (Harry Potter parchment and Gryffindor scarlet), **Kirk** (1960s
  Star Trek), **Supa** (Supabase).
- **Aurora**, **Paper**, **Mono**.

## Install (load unpacked)

```sh
cd dashboard
pnpm install
pnpm run build:extension
```

Then open `chrome://extensions`, turn on Developer mode, click Load unpacked, and
choose `dashboard/dist-extension`. Open a new tab.

To ship it (run it permanently for yourself without the Web Store, or publish to
the store, including the Google OAuth setup), see **[docs/packaging.md](docs/packaging.md)**.

## Configure

Open a new tab and click the gear button in the bottom-right corner. Each section
has its own icon, and a long pane collapses section by section.

- **Timezones**: add a city (searched live), set the home zone, drag the grab
  handle to reorder, or remove.
- **Weather**: show the forecast for the home clock and the temperature on the
  zone cards, and pick Fahrenheit or Celsius.
- **Dock links**: add a link (a bare host becomes `https://`), edit it inline,
  drag to reorder, or remove.
- **Connections**: add a named connection to a service (you can have several of
  each), pick the service first, then fill its setup.
- **Data cards**: build a card that shows a connection, or "Combine all
  calendars" when you have more than one Google Calendar. Rename, repoint, drag
  to reorder.
- **Wallpaper**: choose the source and how often it changes; for Unsplash set the
  subjects and the darkening, and paste your access key.
- **Appearance**: your name, the theme, and the clock format.
- **Backup**: export or import your settings as JSON.

## Connecting services

Connections are named instances of a service. You can have a "Work" and a
"Personal" Google Calendar, two Linear keys, several Notion databases. A data
card points at a connection. Credentials live in `chrome.storage.local`, keyed by
connection, and never sync.

### Google Calendar

Uses Chrome's native OAuth (`chrome.identity`), so it needs a one-time Google
Cloud setup and the installed extension (it does not work on the dev server). The
full steps are in [docs/packaging.md](docs/packaging.md). Once set up, add a
Google Calendar connection and click **Connect Google** on its row; that is the
sign-in. Leave the calendar field blank for your main calendar, or paste another
calendar's id from Google Calendar settings.

### Linear

Create a personal API key in Linear (Settings, API) and paste it into a Linear
connection. The card lists your open assigned issues.

### Notion

Create an internal integration at
[notion.so/my-integrations](https://www.notion.so/my-integrations), copy its
token, and share the database or page with it. Paste the token into a Notion
connection and paste the database's URL (the app keeps the id and drops the `?v=`
view). Notion uses an internal token, not a client id or secret.

### Unsplash

Create a free access key at
[unsplash.com/developers](https://unsplash.com/developers) and paste it under
Wallpaper. Only the **Access Key** is needed. Search subjects are comma
separated, and one is picked at random for each new photo.

## Develop

```sh
cd dashboard
pnpm run dev             # 127.0.0.1; uses localStorage instead of chrome.storage
pnpm test                # vitest
pnpm run lint            # eslint + tsc
pnpm run build:extension # the unpacked extension in dist-extension/
pnpm run package         # build and zip for the Web Store
pnpm run icons           # regenerate the extension icons
```

On the dev server, Notion, Linear, and Unsplash are routed through a Vite proxy
so the browser does not hit CORS from the localhost origin. Google OAuth and the
real `host_permissions` only exist in the installed extension, so connect Google
there.

## Architecture

One Chrome MV3 extension. TypeScript and Vite, vanilla DOM, no UI framework. The
page is driven by a single validated `Config` (Zod) in `chrome.storage`, painted
from a cache first so the new tab never flashes empty.

- `src/config` — the config schema, defaults, and the storage-backed store.
- `src/time`, `src/weather`, `src/geo` — the clock and overlap engine, Open-Meteo
  weather and forecast, and city search.
- `src/dock`, `src/streams`, `src/wallpaper` — the dock, the data cards, and the
  Unsplash and fluid wallpapers.
- `src/integrations` — the pluggable integration platform plus the Google
  Calendar, Linear, and Notion integrations. Add a source by implementing the
  `Integration` interface and listing it in `src/integrations/registry.ts`.
- `src/theme`, `src/edit`, `src/shell`, `src/app` — themes, the edit pane, the
  page composition (with a FLIP reflow animation), and the run lifecycle.
- `src/security` — text-only rendering, the URL scheme allowlist, and the content
  security policy (the single source for the manifest CSP).

## Privacy and security

Non-secret settings live in `chrome.storage.sync`. Secrets (the Unsplash access
key and each connection's credential) live in `chrome.storage.local` and never
sync. There is no server. Network calls go only to the services you connect:
Open-Meteo (weather and geocoding), Unsplash, Notion, Linear, and Google. A
credential in extension storage is fine for a personal tool, but anything with
access to your Chrome profile can read it.

## Safari

Chrome is the primary, clone-and-run target. Safari is also supported: it runs
the same dashboard inside a signed macOS app that hosts the extension, and Google
sign-in runs in that app because Safari has no `chrome.identity`. Building or
releasing the Safari target needs Xcode, an Apple Developer account, and a signing
identity, so it is an advanced target rather than a peer of Chrome. See
`docs/safari-release-setup.md` for the full setup.

## History

This project once explored a broader native provider platform. That earlier work
is preserved at the git tag `archive/safari-platform-2026-06-23`, with its plan
under `tasks/archive/` and older design docs under `docs/archive/`.

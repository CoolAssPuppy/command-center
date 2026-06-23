# Command Center

A calm Chrome new tab page. It shows world clocks, a dock of links, collapsible work streams, an optional Unsplash wallpaper, and pluggable integrations (Notion first). Inspired by Sean Oliver's [solstice](https://github.com/seanoliver/solstice).

## What it does

- A big local clock for your home timezone, with a row of other zones showing the offset, day or night, and current weather.
- A macOS-style dock of favicon links with hover magnification.
- Collapsible work streams: free text notes, a group of links, or a live integration feed.
- An optional full-screen wallpaper from Unsplash, chosen by your search terms.
- A Notion integration that shows a database with custom filters.
- Themes (Mineral, Aurora, Paper, Mono), a 12 or 24 hour clock, and settings import and export.

## Install (load unpacked)

1. `cd dashboard && npm install`
2. `npm run build:extension`
3. Open `chrome://extensions`, turn on Developer mode, click Load unpacked, and choose `dashboard/dist-extension`.
4. Open a new tab.

## Package for the Chrome Web Store

- `cd dashboard && npm run package` builds the extension and writes `dashboard/command-center.zip`. Upload that zip.

## Configure

Open a new tab, move the mouse to the top-right, and click Edit.

- **Timezones**: add a city (searched live), set the home zone, reorder, or remove.
- **Dock links**: add a link (a bare host becomes `https://`), reorder, or remove.
- **Work streams**: add a Notes, Links group, or Notion database stream; rename, reorder, and set whether it starts collapsed.
- **Connections**: paste your Notion token.
- **Wallpaper**: turn it on, set search terms, adjust the darkening, and paste your Unsplash access key.
- **Appearance**: your name, the theme, and the clock format.
- **Backup**: export or import your settings as JSON.

### Notion

1. Create an internal integration in your Notion settings and copy its token.
2. Share the database you want to show with that integration.
3. In the edit pane, paste the token under Connections, add a "Notion database" stream, and set its database id. Optionally set a title property, item count, and a raw Notion filter as JSON.

### Unsplash

Create a free access key at [unsplash.com/developers](https://unsplash.com/developers) and paste it under Wallpaper.

## Settings and privacy

Non-secret settings live in `chrome.storage.sync`. Secrets (the Unsplash key and the Notion token) live in `chrome.storage.local` and never sync. There is no server; the only network calls go to Open-Meteo (weather and geocoding), Unsplash, and Notion. A token in extension storage is fine for a personal tool, but anything with access to your Chrome profile can read it.

## Develop

```sh
cd dashboard
npm run dev      # localhost; uses localStorage instead of chrome.storage
npm test         # vitest
npm run lint     # eslint + tsc
npm run build:extension
npm run icons    # regenerate the extension icons
```

## Architecture

One Chrome MV3 extension. TypeScript and Vite, vanilla DOM, no UI framework. The whole page is driven by a single validated `Config` (Zod) in `chrome.storage`.

- `src/config` — the config schema, defaults, and the storage-backed store.
- `src/time`, `src/weather`, `src/geo` — the clock engine, Open-Meteo weather, and city search.
- `src/dock`, `src/streams`, `src/wallpaper` — the dock, work streams, and Unsplash wallpaper.
- `src/integrations` — the pluggable integration platform and the Notion integration. Add a source by implementing the `Integration` interface and listing it in `src/integrations/registry.ts`.
- `src/theme`, `src/edit`, `src/shell`, `src/app` — themes, the edit pane, the page composition, and the run lifecycle.
- `src/security` — text-only rendering, the URL scheme allowlist, and the content security policy (the single source for the manifest CSP).

## History

This project started as a Safari extension plus a native macOS app and an open provider platform. That work is preserved at the git tag `archive/safari-platform-2026-06-23` and the plan at `tasks/archive/`. The current direction is Chrome only; older design docs are in `docs/archive/`.

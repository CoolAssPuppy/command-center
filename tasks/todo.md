# Command Center build plan (Chrome pivot)

This is the loop's worklist. Every task is implemented test-first. A task is only checked off when its tests, the linter, and the build all pass. Commits are local until the user asks to push.

Legend: `[ ]` todo, `[~]` in progress, `[x]` done.

## Direction (reset 2026-06-23)

We are pivoting away from the Safari extension + native macOS app + provider platform. Inspiration: Sean Oliver's solstice (a Chrome MV3 new-tab extension, https://github.com/seanoliver/solstice). We keep solstice's spirit (one extension, settings in local storage, no server) but go further on features and target Chrome.

Decisions locked:
- **Full pivot.** Drop `native/` (Swift app + Safari extension) and `core/` (SwiftPM). The pre-pivot state is preserved at git tag `archive/safari-platform-2026-06-23` and the old plan at `tasks/archive/safari-platform-todo.md`.
- **Reuse the tested TS core, keep the build.** Rather than rewrite vanilla like solstice, wrap the existing `dashboard/src/` logic (time engine, weather, themes, security, render helpers) in a Chrome MV3 shell built with Vite.
- **Notion auth = pasted integration token.** No OAuth broker for now. The user creates a Notion internal integration and pastes the token. Secrets live in `chrome.storage.local`, never synced.

What we keep from `dashboard/src/`:
- `time/clock.ts`, `time/solar.ts`, `time/overlap.ts` (timezone + day/night + meeting-overlap math)
- `weather/openMeteo.ts` (per-zone weather, optional)
- `theme/*` (mineral, aurora, paper, mono token themes + registry)
- `security/*` and `render/helpers.ts` (text-only render, URL validation, host allowlist, CSP)
- `cities/cities.ts` (seed zones + skylines), `test/factories.ts`

What we repurpose:
- `shell/header.ts` -> the centered home-zone clock
- `shell/cityRow.ts` -> the row of other timezones
- `shell/overlapTimeline.ts` -> optional, can live inside a work stream
- `shell/dashboard.ts` -> the new new-tab composition

What we remove:
- `bridge/native.ts` (native messaging) -> replaced by a `chrome.storage` settings bridge
- `native/`, `core/`, `scripts/release.sh`, `native/scripts/embed-dashboard.sh`
- Provider-platform code paths (ingest, SDK, consent) and the cards' `needs_auth/reconnect` flow tied to native providers

## The new-tab page (target composition, top to bottom)

1. **Background wallpaper** — full bleed, Unsplash by search terms, with a readability scrim.
2. **Centered home clock** — big current local time + date + day/night phase for the home timezone, prominent in the center.
3. **Timezone row** — a simple horizontal row of the other zones beneath the home clock; each compact card shows time, UTC offset, day/night tint, optional weather.
4. **Dock** — a centered row of icon-sized favicons for customizable links, macOS-dock style with a subtle magnification on hover.
5. **Work streams** — collapsible titled sections (chevron, collapsed by default). Static for the MVP; designed so an integration feed (Notion first) plugs in as a stream's content.
6. **Edit pane** — one drawer to configure zones, dock links, streams, wallpaper terms, theme, and integrations.

Settings model: `chrome.storage.sync` for non-secret config (zones, links, streams, wallpaper terms, theme); `chrome.storage.local` for secrets (Notion token, Unsplash access key). First paint repaints instantly from cached config, then live data fills in.

## Gates applied to every task

- Tests written before implementation (TDD). `npm test` green, `npm run lint` clean, `npm run build` succeeds.
- No `any`, no swallowed errors. Feed/integration text rendered as text, not HTML. Link/action URLs validated against the host allowlist.
- Secrets never written to `chrome.storage.sync`. First-paint budget respected.
- Respect `prefers-reduced-motion` for dock magnification and any wallpaper/transition motion.

---

## Phase 0: pivot and scaffold

- [x] P0.1 Strip native: removed `native/`, `core/`, `packages/`, `examples/`, `scripts/`, `.doppler.yaml`. Archive tag created.
- [x] P0.2 Chrome MV3 manifest: `chrome_url_overrides.newtab`, no service worker (page does its own storage + fetch), `host_permissions` for notion/unsplash/open-meteo/favicons. CSP single-sourced from `security/csp.ts` (manifest-match test).
- [x] P0.3 Settings bridge: `ConfigStore` over `chrome.storage` (sync config, local secrets), Zod schema, with localStorage + in-memory adapters for dev/tests. Native-messaging deleted.
- [x] P0.4 Build + dev harness: Vite builds an unpacked MV3 extension to `dist-extension/` (newtab.html + manifest assembled by `finish-extension.mjs`). Dev page runs against localStorage. Verified load + green build.
- [x] P0.5 Recompose the shell: new layout (wallpaper slot, centered home clock, zone row, dock/stream slots, edit button). 3-column provider grid removed; dead provider modules swept. Integration tests + live screenshot.

## Phase 1: timezones (centered home + row)

- [x] P1.1 Zone settings schema: `{ id, label, timeZone, lat?, lon?, isHome }` + `homeZone`/`otherZones` selectors, seeded from `cities/cities.ts`. Tests.
- [x] P1.2 Centered home clock: big local time + date + phase for the home zone, minute ticker, reuses `time/clock.ts` + `time/solar.ts`. Tests with injected `now`.
- [x] P1.3 Timezone row: compact cards for non-home zones with time, offset-from-home, day-offset badge, day/night tint. Tests.
- [x] P1.4 Per-zone weather via `weather/openMeteo.ts` (zones with coords), fetched after first paint, repaints. Injected-fetch tests.
- [x] P1.5 Edit pane (zones): add/remove/reorder zones, set the home zone, city search via the Open-Meteo geocoder. Extensible section architecture (later phases append sections). Live-apply. Tests + live screenshot.

## Phase 2: dock-style links

- [x] P2.1 Link settings schema: `{ id, title, url, iconUrl? }`, url-validated; navigation gated by `isSafeUrl`. Tests.
- [x] P2.2 Favicon resolution: explicit iconUrl, else Google s2 by domain, else a letter glyph (img onerror fallback). Tests.
- [x] P2.3 Dock render: centered row of favicons in a glass tray.
- [x] P2.4 Magnification: macOS-dock proximity scale on pointermove, disabled under reduced motion. Verified live.
- [x] P2.5 Edit pane (dock): add (host normalized to https + validated), remove, reorder. Tests. (Inline rename deferred to P6.)

## Phase 3: collapsible work streams

- [x] P3.1 Stream settings schema: `{ id, title, collapsedByDefault, content }` with a `static | links | integration` content union. Tests.
- [x] P3.2 Stream UI: native `<details>` section with a rotating chevron, collapsed by default, open-state persisted in local UI state (`streamState`). Static/links/integration content. Tests + live screenshot.
- [x] P3.3 Edit pane (streams): add (notes or links group), rename, reorder, toggle collapsed-default, remove, edit body / pick links. Shared edit controls factored out. Tests.
- [ ] P3.4 (Optional, deferred) host the 24h overlap timeline as a built-in stream type.

## Phase 4: Unsplash wallpaper

- [x] P4.1 Unsplash client: official random-photo API by terms (access key via local secrets), attribution + download-trigger per the API guidelines. Injected-fetch tests.
- [x] P4.2 Wallpaper render: full-bleed background + readability scrim, light foreground over photo, per-day cache keyed by terms (falls back to last good photo on failure), Unsplash credit. Tests + live screenshot.
- [x] P4.3 Edit pane (wallpaper): enable toggle, comma-separated terms, scrim slider, and the access key (stored in local secrets, never synced). Live-refetch on change. Tests.

## Phase 5: integration platform (lean) + Notion first

- [x] P5.1 Integration interface + registry: `{ id, displayName, fetch(rawConfig, ctx) -> NormalizedItem[] }`, text-only URL-validated items, `IntegrationResult` states (loading/ok/error/needs_auth). Registry. Tests.
- [x] P5.2 Notion client: query a database with the local token, `Notion-Version` header, defensive title extraction. 401 -> needs_auth. Injected-fetch tests.
- [x] P5.3 Notion filters: raw Notion `filter` + `sorts` passed through; configurable via the stream's Filter (JSON) editor. Tests on filter -> query mapping.
- [x] P5.4 Stream `integration` content: streams render their integration's items (loading/needs_auth/error/items). Platform resolves results in `run.ts` (cached per render, refetch on load + edit). Tests + live screenshot.
- [x] P5.5 Edit pane: Connections section for the Notion token (local secret); per-stream Notion config (database id, title prop, items, filter JSON) in the Work streams section. Tradeoff documented. Tests.

## Phase 6: edit pane unification + polish

- [x] P6.1 One drawer, section-per-phase: Timezones, Dock, Streams, Connections, Wallpaper, Appearance, Backup. Up/down reorder throughout. Single-pane guard.
- [x] P6.2 Theme selection in the Appearance section (mineral/aurora/paper/mono), applies live. Tests + screenshot (Mono).
- [x] P6.3 Backup section: export config to JSON (secrets excluded), import JSON (validated/repaired through parseConfig).
- [x] P6.4 First-run onboarding: defaults seed zones, a few dock links, and a welcome Notes stream. Empty states (dock/streams hidden when empty, "no zones" hint). Verified.
- [x] P6.5 A11y: edit-pane focus trap + Escape, aria roles/labels, reduced-motion respected (dock magnify off, transitions guarded), keyboard-navigable controls.

## Phase 7: ship

- [x] P7.1 `npm run package` builds and zips `dist-extension/` to `command-center.zip` (111 KB). Load-unpacked documented in the README.
- [x] P7.2 Icons: dependency-free PNG encoder (`npm run icons`) draws a mineral clock at 16/48/128, referenced in the manifest. Removed the unused city skyline JPGs (~770 KB).
- [x] P7.3 Root `README.md`: install, package, configure (Notion + Unsplash), privacy, develop, architecture. Old platform docs moved to `docs/archive/` with a note.

---

## Active epic: implement the Paper redesign + real integrations (started 2026-06-23)

User direction: implement the Paper "Twilight/Mineral" design in the app, plus real service auth. Auth decision (serverless, no broker): Google Calendar via `chrome.identity` OAuth; Linear via a pasted personal API key; Notion via its integration token (done). The user provides the Google OAuth client id, Linear key, and Notion token; these can't be hardcoded or tested without their accounts.

- [x] D1 Day/night themes: new Twilight (night) theme + Mineral (day) gradient backgrounds; `resolveActiveTheme` auto-switches by the home zone's local time; "Auto · day & night" option in the edit pane. Tests + live (Twilight verified).
- [ ] D2 Meeting-window widget (compact, honest "no single hour" verdict) + place-card / integration-panel restyle with brand icons.
- [ ] D3 Wallpaper source picker: gradient | Unsplash terms | custom URL (+ rotation), in config + edit pane.
- [ ] D4 Google Calendar integration via `chrome.identity` OAuth (Today panel) + setup doc.
- [ ] D5 Linear integration via personal API key (Inbox panel).
- [ ] D6 Wire Calendar/Linear/Notion as default panels; settings; tests; build; README/docs.

## Standing quality mandate

Every iteration: keep the architecture impeccable, not just green. Before marking a task done, refactor what you touched (no duplication, no dead code, single source of truth, honest docs). The reused TS core is already audited; do not regress it. Keep files under ~300-500 lines and split by responsibility (UI / settings / integration / render).

---

## Review (completed 2026-06-23)

All phases P0–P7 done. The Chrome pivot shipped on branch `build/chrome-pivot`.

What landed:
- A single Chrome MV3 new-tab extension, config-driven (one Zod `Config` in `chrome.storage.sync`; secrets in `local`). 150 tests, lint clean, build + package green.
- Centered home clock + timezone row (offset, day/night, weather), reusing the tested time/solar/weather engine.
- macOS-style dock with proximity magnification.
- Collapsible work streams (notes / links / integration), open-state persisted.
- Unsplash wallpaper (per-day cache, scrim, attribution).
- Pluggable integration platform with Notion (token, filters, normalized items, needs-auth/error states).
- One edit drawer: Timezones, Dock, Streams, Connections, Wallpaper, Appearance, Backup. Live-apply, focus trap, import/export.
- Onboarding seeds, four themes, icons, README, archived platform docs.

Verified live at each phase (screenshots): skeleton, edit pane, dock magnify, streams, wallpaper, Notion config + needs-auth, onboarding, live theme switch.

Not done / deferred:
- P3.4 (24h overlap timeline as a built-in stream type) — optional; `overlapTimeline.ts` is kept and ready.
- Inline rename of dock links (remove + re-add for now).
- Live Notion API call needs the user's real token + a shared database to exercise end-to-end (client is fully unit-tested).
- Notion sorts UI (raw `sorts` pass-through is supported in config; no dedicated editor yet).
- Periodic integration refresh (currently refetches on load and on edit, not on a timer).

Nothing is pushed; commits are local on `build/chrome-pivot`. The pre-pivot platform is at tag `archive/safari-platform-2026-06-23`.

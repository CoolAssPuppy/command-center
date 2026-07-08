# Tech debt audit: Command Center

Date: 2026-07-08. Scope: the `dashboard/` extension (about 11.6k lines of source
TypeScript, 5.2k of tests). Goal: get the codebase ready to open-source for a wide
audience, judged on readability, maintainability, performance, and security.

Method: the full source was read across five review passes (app and integrations,
edit pane, shell and rendering, config and core libraries, security and config in
depth), plus tooling: `pnpm audit`, `knip`, `madge --circular`, `depcheck`, and
targeted greps. Every concrete finding cites `file:line` relative to `dashboard/`.

## Executive summary

Ranked by impact.

1. **A malformed config can wipe the whole config.** `parseConfig` only rescues
   bad data cards. Any other invalid field (a zone, link, connection, wallpaper,
   or custom theme) resets the user to empty defaults. Because config syncs across
   devices and versions, one bad field can blank a working setup. This is the one
   finding that can lose user data. (`config/schema.ts:408`)
2. **Two schema fields validate URLs but not their scheme.** `DockLinkSchema.url`
   and `iconUrl` use `z.string().url()`, which accepts `javascript:` and `data:`.
   The render and navigate paths catch this today, so it is not currently
   exploitable, but the trust boundary is the schema, and the schema lets it
   through. (`config/schema.ts:30`)
3. **`run.ts` is a god function.** One ~560-line closure holds a dozen mutables
   and fifteen nested functions, which is why only a four-case happy-path test
   exists for the app's core. (`app/run.ts:116`)
4. **Dead code that will mislead new contributors.** Two whole modules
   (`time/overlap.ts`, most of `time/solar.ts`), a misleading half-populated
   barrel (`integrations/index.ts`), and about 94 lines of dead CSS. All safe to
   delete, all with docstrings describing features that no longer ship.
5. **The same network transport is copy-pasted six times.** Every integration
   repeats the try/catch, status-to-needs-auth mapping, and JSON parsing. The copies
   have already drifted: Linear maps HTTP 400 to "needs auth," so a bad query is
   reported to the user as an auth problem. (`integrations/linear.ts:477`)
6. **Persistence failures are silent.** `store.save` is fire-and-forget with no
   error handling and no debounce, so a failed or rate-limited sync write loses
   the edit with no signal. The whole config also lives in one `chrome.storage.sync`
   item, which has an 8KB per-item quota that custom themes can exceed.
7. **The Customize pane refetches Google calendars on every keystroke.** Each edit
   rebuilds all ten sections, and any open calendar disclosure refires a live
   Google request on every rebuild. (`edit/editPane.ts:214`, `edit/streamsSection.ts:340`)
8. **Security fundamentals are genuinely strong.** No `innerHTML` or equivalent
   anywhere, all text renders through `textContent`, all navigation is gated by a
   robust `isSafeUrl`, and secrets are kept in `chrome.storage.local` and never
   synced. This is real and worth protecting; several findings are about keeping
   it that way.
9. **Duplication is the dominant maintainability cost.** Beyond the transport
   copies, the edit pane re-implements the same toggle, chip, and password field
   four to six times each, and three UI-state modules copy the same storage
   scaffold. None is a bug; together they are the bulk of the debt.
10. **Dependency CVEs are dev-only.** The five advisories from `pnpm audit` are all
    in the Vite and Vitest build toolchain, none ships in the extension. Low real
    risk, but worth bumping before the repo is public and people run `pnpm audit`.

## Architectural mental model

Command Center is a Chrome Manifest V3 extension that overrides the new tab page.
It has no server. A single Zod-validated `Config` object, held in
`chrome.storage.sync`, drives everything; secrets live separately in
`chrome.storage.local` and never sync. `main.ts` boots, paints instantly from a
localStorage cache, then `app/run.ts` orchestrates: it resolves Google tokens,
fetches each connected integration, weather, and tickers, and repaints.

Rendering is vanilla DOM with no framework. `shell/dashboard.ts` renders the whole
page as a pure function of the model; on any change it calls `replaceChildren` and
rebuilds, using a FLIP pass to animate surviving nodes. Data flows through a small
vocabulary of `NormalizedItem`s that integrations produce and the shell renders.
The `integrations/` folder is a clean plugin set behind a `registry`; each turns
one external source into items and never touches the DOM or holds a secret of its
own. The `security/` layer (`dom.ts` text-only render, `url.ts` scheme allowlist,
`csp.ts`) is the sanitization spine, and it is used consistently.

This model is sound and the layering is real. The debt is not rot inside the layers;
it is a heavy orchestrator (`run.ts`), cross-file duplication, a data-loss corner in
config parsing, and dead code left from removed features. The README matches the
implementation, which is a good sign.

## Findings

Severity: Critical / High / Medium / Low. Effort: S (under an hour), M (half a day),
L (a day or more).

### Data integrity and correctness

| ID | File:Line | Sev | Eff | Finding | Recommendation |
|----|-----------|-----|-----|---------|----------------|
| DATA-1 | config/schema.ts:408 | High | M | `parseConfig` only prunes invalid streams; any other invalid field (zone, link, connection, wallpaper, customTheme) fails the parse and falls through to `ConfigSchema.parse({})`, wiping all of it. The doc comment ("the rest is kept") overstates the protection. | Prune per section, keeping valid zones/links/connections/themes individually; only fall back to empty for a wholly unreadable blob. Add tests for a malformed zone and a malformed custom theme. |
| DATA-2 | integrations/linear.ts:477 | Medium | S | HTTP 400 is mapped to `NEEDS_AUTH`, so a malformed GraphQL query is reported to the user as an auth failure instead of the real error. | Drop 400 from the auth branch; let Linear's `errors[]` handling surface the message. Confirm 400 is not Linear's bad-key response first (open question). |
| CORR-1 | app/run.ts:446 | Medium | M | `refreshIntegrations` mutates a shared results object across `Promise.all`; two overlapping runs (config apply and secrets apply can both trigger it) race, and a slow in-flight fetch writes into the newer run's object. | Add a monotonic run token; discard writes from a stale run. Apply the same to weather and ticker refresh. |
| CORR-2 | time/clock.ts:47 | Medium | M | `new Intl.DateTimeFormat(_, { timeZone })` throws `RangeError` for an invalid IANA zone, but the schema validates `timeZone` only as a non-empty string, so a bad synced zone throws on the render hot path. | Validate against `Intl.supportedValuesOf('timeZone')` at parse, or try/catch with a UTC fallback in `clock.ts`. |
| CORR-3 | perf/perf.ts:37, main.ts:18 | Medium | S | `measureFirstPaint` times a synchronous callback, but it is handed `() => void runDashboard(...)`, which is async, so `elapsedMs` is always about 0 and the first-paint budget never fires. | Measure to first meaningful render inside `runDashboard`, or remove the guard. |
| ERR-1 | edit/connectionsSection.ts:145 | Medium | S | `void connect(id).then(...)` on the Google OAuth call has no `.catch`; a rejected popup or network error becomes an unhandled rejection with no user feedback. | Add `.catch` that shows a hint, mirroring `zonesSection.ts:151`. |
| ERR-2 | theme/contrast.ts:14 | Medium | S | `parseHex` matches only 6-digit hex; 3-digit hex, `rgb()`, or named colors return undefined and `relativeLuminance` coerces to 0 (pure black), producing wrong contrast ratios. Masked because shipped themes use 6-digit hex. | Support 3-digit hex; signal unparseable colors instead of coercing to 0. |

### Persistence and configuration

| ID | File:Line | Sev | Eff | Finding | Recommendation |
|----|-----------|-----|-----|---------|----------------|
| CFG-1 | config/store.ts:49 | Medium | S | `store.save` has no error handling and every caller is fire-and-forget (`void store.save(...)`), so a rejected sync write (quota, offline, rate limit) silently loses the edit. `cache.ts` guards its writes; the authoritative store does not. | Catch and surface save failures; debounce saves (sync caps around 120 writes/min). |
| CFG-2 | config/store.ts:29 | Medium | M | The entire config is one `chrome.storage.sync` item. Sync's per-item quota is about 8KB; custom themes plus many streams/zones can exceed it and `set()` rejects. | Keep bulky data (custom themes) in local or under separate keys; guard size and fall back to local on quota error. |
| CFG-3 | edit/connectionsSection.ts:96 | Medium | S | Removing a connection filters `config.connections` but never deletes `draftSecrets.connectionSecrets[id]` or `googleTokens[id]`, so a deleted connection's credential and OAuth token linger in device-local storage. A privacy and hygiene issue. | On remove, also delete the matching secret and token via `updateSecrets`. |
| CFG-4 | config/schema.ts:250, 317 | Low | S | The `version` field is decorative: `ConfigSchema` defaults it to 2, `defaultConfig` seeds 1, and `migrateConfig` never reads it (it keys on data shape and runs unconditionally). "For future migrations" is misleading. | Either wire `version` into migration gating and bump it, or drop the field and the comment. |
| CFG-5 | config/schema.ts:82 | Low | S | `CardConfigSchema.filter` is `z.unknown()`, an unvalidated blob persisted into synced config and forwarded to Notion. Low security risk (user's own data) but an unbounded sync-quota contributor and a validation gap. | Constrain to the Notion filter shape used, or document and cap its size. |

### Security

| ID | File:Line | Sev | Eff | Finding | Recommendation |
|----|-----------|-----|-----|---------|----------------|
| SEC-1 | config/schema.ts:30 | Medium | S | `DockLinkSchema.url` and `iconUrl` use `z.string().url()`, which accepts `javascript:`, `data:`, `vbscript:`. Schema validation gives false scheme safety; the real guard is `isSafeUrl` downstream. An imported config with a `javascript:` dock link passes the schema. | Add an `isSafeUrl` refinement to `url` and `iconUrl` so dangerous schemes are rejected at the storage boundary. |
| SEC-2 | main.ts:22 | Medium | S | The navigate sink `window.location.href = url` has no guard of its own; safety rests on every call site gating first (they do today). One future caller that forgets turns a config URL into a live `javascript:` navigation. | Gate inside the sink: `if (isSafeUrl(url)) window.location.href = url`. |
| SEC-3 | integrations/news.ts:113 | Medium | S | `parseFeed` takes the RSS/Atom link verbatim into `item.url` with no scheme check; feed content is untrusted, and a hijacked feed could inject a non-http scheme. Curated feeds lower but do not remove the risk. | Validate `http(s):` only at the integration boundary, as `conference.ts` already does. |
| SEC-4 | shell/dashboard.ts:110 | Medium | S | The wallpaper URL is interpolated into a CSS `url("...")` custom property, guarded by `isSafeUrl(_, ["https:"])` and `!imageUrl.includes('"')`. Correct today but fragile: deleting the quote check silently reopens CSS injection. | Add a comment marking it load-bearing and a test asserting a quote-containing URL is rejected. |
| SEC-5 | theme/tokens.ts:11 | Medium | S | `ThemeSchema` validates every color as bare `z.string()` and `background.value` as an unconstrained string. Synced and imported custom themes flow into `setProperty`; invalid CSS is dropped (no injection), but junk passes validation with no guard, and no contrast check runs on import (custom themes can render invisible text). | Constrain colors with a hex regex; run `contrast.ts` when accepting a custom theme and warn or reject below AA. |
| SEC-6 | integrations/googleOAuth.ts:42 | Low | M | The implicit OAuth flow builds the auth URL with no `state`/nonce and does not verify one on return. For a server-less extension the CSRF surface is small, but it deviates from OAuth practice. | Generate a random `state`, include it, and reject a redirect that does not echo it. |
| SEC-7 | public/manifest.json:16 | Low | S | `https://www.google.com/s2/favicons*` and `https://images.unsplash.com/*` sit in `host_permissions`, but both load as image `src` (covered by CSP `img-src https:`) and do not need host permission. Over-broad permissions read worse in review. | Drop the two image hosts from `host_permissions`; verify wallpaper and favicons still load. |

### Architecture and dead code

| ID | File:Line | Sev | Eff | Finding | Recommendation |
|----|-----------|-----|-----|---------|----------------|
| ARCH-1 | app/run.ts:116 | High | L | `runDashboard` is one ~560-line closure over a dozen mutables and fifteen nested functions (paint, edit wiring, wallpaper, Google tokens, integrations, tickers, weather, reorder). Each concern is untestable in isolation. | Extract cohesive controllers (`WallpaperController`, `IntegrationsController`, `TickerController`, `WeatherController`), each owning its state with a `refresh()`; `runDashboard` becomes wiring. |
| DEAD-1 | time/overlap.ts:1 | High | S | The entire module (`overlapBands`, `nowFraction`, `workingBands`, `isWorkingAt`, `Band`) plus its test is imported by nothing; it duplicates helpers that live in `meetingWindow.ts`. Verified no non-test importers. | Delete `overlap.ts` and `overlap.test.ts`. |
| DEAD-2 | time/solar.ts:31 | High | S | The solar-position model (`solarElevation`, `daylightState`, `isMorning`, `DaylightState`) is called by nothing; only `phaseLabel` is used. The docstring describes a "live daylight state" feature that no longer ships. Verified. | Delete the dead solar code, keep `phaseLabel`, fix the docstring. |
| DEAD-3 | integrations/index.ts:1 | High | S | The barrel has zero importers and re-exports only four of six integrations, so a reader gets a misleading picture. Verified no importers. | Delete it, or make it the single sanctioned import surface and route consumers through it. |
| DEAD-4 | styles.css:1900 | High | S | The `.cc-stream__link*` family (about 42 lines) is unused; verified zero `.ts` references. | Delete. |
| DEAD-5 | styles.css:1612 | High | S | The `.cc-edit__calendars*` / `.cc-edit__calendar-list` family (about 52 lines) is unused; the live calendar UI uses `cc-calfold*`. Verified zero `.ts` references. | Delete. |
| DEAD-6 | (knip output) | Medium | S | knip reports 8 unused barrel `index.ts` files and 33 unused exports (several schemas and helpers exported but used only internally or by nothing). | Prune, or adopt barrels as the real import surface. `ALL_DAY_INLINE_LIMIT` (streams/calendarView.ts:22, added this release) can drop its `export`. |
| ARCH-2 | edit/editPane.ts | Medium | M | 10 circular dependencies, all `editPane.ts` importing each `*Section.ts` while each section imports types from `editPane.ts` (madge). Works, but it complicates reasoning and reuse. | Move the shared `SectionContext`/`SectionRenderer` types into a `sectionTypes.ts` the sections import instead of `editPane.ts`. |
| ARCH-3 | app/run.ts:325 | Low | M | `resolveGoogleTokens` is Google-auth domain logic living in the app orchestrator and it mutates its `secrets` argument in place before persisting. | Move it beside `googleOAuth.ts`, returning `{ tokens, updatedSecrets }` without mutating the input. |

### Duplication and consistency

| ID | File:Line | Sev | Eff | Finding | Recommendation |
|----|-----------|-----|-----|---------|----------------|
| DUP-1 | integrations/{notion,linear,github,googleCalendar,todoist,googleTasks}.ts | High | M | The identical transport wrapper (try/catch, status-to-needs-auth, JSON parse) is copied six times and has drifted (see DATA-2). | Add a shared `fetchJson(ctx, request, { serviceName })`; integrations keep only schema and normalization. |
| DUP-2 | weather/openMeteo.ts:52, wallpaper/unsplash.ts:23, geo/geocode.ts:24 | Medium | M | The `FetchLike` interface and the fetch to ok to json to safeParse scaffold are copy-pasted across all three network clients. | Extract a shared `fetchJson<T>(url, schema, deps)` into `domain/`. |
| DUP-3 | edit/{dockSection,weatherSection,tickersSection}.ts (+3 inline) | Medium | S | The labeled-checkbox `checkRow` is copied into three sections and hand-rolled in three more. Six implementations of one toggle. | Add one `checkRow` to `controls.ts`; import everywhere. |
| DUP-4 | edit/{weatherSection,wallpaperSection,appearanceSection,zonesSection}.ts | Medium | S | The "chip button with active toggle" is rebuilt four to five times. | Add a `chip(label, {active, onClick, onRemove?})` helper to `controls.ts`. |
| DUP-5 | edit/{connectionsSection,wallpaperSection,tickersSection}.ts | Medium | S | Four ad-hoc `type="password"` field builders; `connectionsSection` has two (inline plus `secretField`). | Add `secretInput()` to `controls.ts`; route all four through it. |
| DUP-6 | edit/streamsSection.ts:303, 384 | Medium | M | `renderCalendarPicker` and `renderCombineCalendarPicker` share about 40 lines of details/summary/chevron/loading scaffold, a large chunk of the 515-line file. | Extract a `calendarDisclosure(...)` shell; keep only the checkbox-population distinct. |
| DUP-7 | shell/needsYouLane.ts:190, streams/streams.ts:182 | Medium | M | `renderLaneItem` and `renderItem` are near-identical (navigable gate, click-navigate, icon + title + sub) and drift independently. | Extract `renderNavigableRow(item, {classPrefix, extras}, deps)`. |
| DUP-8 | shell/{tickerModeState,taskFilterState}.ts, streams/streamState.ts | Medium | S | The `webStorage()` helper plus load/save try/catch is copied verbatim across three UI-state modules. | Extract one `createLocalState<T>(key, parse, serialize)` factory. |
| DUP-9 | integrations/linear.ts:138 | Low | M | The GraphQL envelope schema and the `errors[]`/`data === undefined` unwrap are repeated across five Linear parsers. | Add a `graphqlEnvelope(dataSchema)` builder and a shared `unwrapGraphql`. |
| DUP-10 | styles.css:960, 1052 | Medium | S | The floating-surface recipe (color-mix, hairline, shadow, backdrop-blur) is copied between `.cc-dock` and `.cc-edit-btn`, with ad-hoc shadow magic numbers at several sites. | Extract a shared class or `--cc-float-*` tokens. |
| CON-1 | 7 integration sites | Low | S | The default item count `?? 6` is a magic number duplicated seven times. | Export `DEFAULT_ITEM_COUNT`, or resolve `count` once before dispatch. |
| CON-2 | 4 integration sites | Low | S | The `secret` missing to `NEEDS_AUTH` guard is repeated verbatim in the four key-based integrations. | Hoist a `requireSecret(secret)` guard. |
| CON-3 | shell/{brandIcons,itemIcons,conferenceIcons}.ts | Low | S | Three different dispatch idioms for id-to-icon (if-chain, Record map, Record plus fallback). | Standardize on the Record-map pattern for exhaustiveness. |
| CON-4 | shell/ticker.ts:139, dashboard.ts:137 | Low | S | Three direct `.textContent =` assignments bypass the `setText` helper that the docs say is used exclusively. Safe, but weakens the "one audited text path" claim. | Route through `setText` or soften the doc wording. |

### Types and contracts

| ID | File:Line | Sev | Eff | Finding | Recommendation |
|----|-----------|-----|-----|---------|----------------|
| TYPE-1 | app/run.ts:106 | Medium | S | `RunDeps.getAuthToken` is typed as one arg, but the real signature and `IntegrationContext.getAuthToken` take `(provider, connectionId?)`. It compiles only because the extra param is optional, so a test cannot select a per-account token. | Match the two-arg signature. |
| TYPE-2 | integrations/googleCalendarList.ts:27 | Medium | S | This integration hand-rolls validation with `as` casts instead of zod, unlike every other integration. | Replace with a small zod schema. |
| TYPE-3 | integrations/googleOAuth.ts:67 | Medium | S | `fetchEmail` uses the global `fetch` (not the injectable client) and casts the body with `as`, so `googleOAuth.ts` has no test and the userinfo response is unvalidated. | Route through an injected fetch, validate with zod, add a test. |
| TYPE-4 | wallpaper/wallpaper.ts:26 | Low | S | `isPhoto` is a hand-rolled type guard duplicating the shape `unsplash.ts` already models with `PhotoSchema`; two sources of truth that can drift. | Export a zod schema and `safeParse` in the cache loader. |

### Performance

| ID | File:Line | Sev | Eff | Finding | Recommendation |
|----|-----------|-----|-----|---------|----------------|
| PERF-1 | edit/editPane.ts:214, streamsSection.ts:340 | High | M | Every edit rebuilds all ten sections via `renderBody()`, and any open calendar disclosure refires `fetchGoogleCalendarList` (and `Promise.all` across accounts for combine) on every rebuild. Toggling an unrelated checkbox refires live Google requests. | Memoize calendar-list results per access token for the pane's lifetime, or fetch only on disclosure open. |
| PERF-2 | shell/dashboard.ts:94 | Medium | L | `renderDashboard` does `replaceChildren` and rebuilds the whole subtree on every 60s tick, weather arrival, and reorder, re-running FLIP `getBoundingClientRect` twice per keyed node (forced reflow). Acceptable at this scale, but the main ceiling. | Skip FLIP capture when nothing structural changed (the minute tick only changes text); longer term, diff at the widget level. |
| PERF-3 | app/run.ts:558, 675 | Medium | M | `refreshWeather` fetches every located zone on every new-tab open and config change with no cross-load cache (unlike wallpaper's per-day cache). New tabs open constantly, so this is repeated API load. | Add a short-TTL (15 to 30 min) cache keyed by lat/lon/unit. |
| PERF-4 | app/run.ts:203 | Medium | S | Applying config or secrets fires integrations, weather, tickers, and wallpaper refresh on every apply with no debounce or diff, so rapid edits fan out full re-fetches. | Debounce apply-driven refreshes, or refresh only the subsystem that changed. |
| PERF-5 | dock/dock.ts:99 | Low | S | The dock magnify `pointermove` handler calls `getBoundingClientRect` for every item on every move; the rects only change on layout. | Cache item centers on `pointerenter`/resize and read `event.clientX` against the cache. |
| PERF-6 | app/run.ts:332 | Low | S | `resolveGoogleTokens` refreshes expired tokens sequentially in a `for await` loop across accounts. | Resolve independent per-connection tokens with `Promise.all`. |
| PERF-7 | styles.css:2187 | Medium | S | The ticker "down" delta is a raw `color: #cf3322` while "up" uses a token, so user themes cannot recolor negative deltas and it clashes off-palette. | Add a `--cc-color-negative` token. |

### Test debt

| ID | File:Line | Sev | Eff | Finding | Recommendation |
|----|-----------|-----|-----|---------|----------------|
| TEST-1 | config/schema.ts:408 | High | S | No test covers the data-loss path in DATA-1 (a malformed non-stream field). | Add tests for a malformed zone and a malformed custom theme, asserting the rest survives. |
| TEST-2 | edit/tickersSection.ts, backupSection.ts | Medium | M | Tickers (symbol parsing, Finnhub secret, news multi-select) and Backup (export blob, import-replace, the delete-all-keys path) have no tests. | Add pane-level tests through `openEditPane`. |
| TEST-3 | edit/streamsSection.ts:157 | Medium | L | The highest-complexity logic (per-service card branching, both calendar pickers, the "none or all means every calendar" combine rule) is untested. | Test the combine clear-on-all/none rule and per-service field selection. |
| TEST-4 | integrations/linear.ts:34 | Medium | M | Linear exports about 11 GraphQL query constants and four parsers only for tests, which assert on raw query substrings (implementation testing, against the repo's own rules). | Test through `linearIntegration.fetch` with a stub client asserting normalized output; stop exporting internals. |
| TEST-5 | integrations/googleOAuth.ts | Medium | M | The entire multi-account OAuth flow (fragment parse, expiry, email fallback) is untested. | Add behavior tests for `parseFragment`, `buildAuthUrl`, `authorizeGoogleAccount` via an injected identity. |
| TEST-6 | shell/taskFilterState.ts | Medium | S | The state module with the most parsing/validation logic has no test, while its simpler sibling `streamState.ts` does. | Add `taskFilterState.test.ts` covering malformed persisted JSON. |
| TEST-7 | wallpaper/brightness.ts:8 | Medium | M | `analyzePhotoTone` (canvas-null, tainted-canvas, luminance threshold, no-DOM path) has no test. | Add `brightness.test.ts` with stubbed Image/canvas. |
| TEST-8 | theme/resolve.ts:34 | Medium | S | The "appearance.theme points at a deleted custom theme" fallback is implemented but untested. | Add a test: unknown id resolves to the auto day/night theme. |

### Dependencies

| ID | File:Line | Sev | Eff | Finding | Recommendation |
|----|-----------|-----|-----|---------|----------------|
| DEP-1 | package.json | Low | S | `pnpm audit` reports 5 advisories (1 critical, 1 high, 3 moderate), all in the Vite/Vitest build toolchain (`vite <=6.4.2`, `launch-editor`). None ships in the extension. | Bump Vite/Vitest to patched versions before the repo is public, so `pnpm audit` is clean for cloners. |
| DEP-2 | (depcheck) | Low | S | `depcheck` flags `@vitest/coverage-v8` as unused; it is a false positive (used by `test:coverage`). No action, noted so the next runner is not confused. | None. |

## Top 5: if you fix nothing else, fix these

1. **DATA-1: stop the config wipe.** Rework `parseConfig` (`config/schema.ts:408`)
   so a bad field drops only that entry. Sketch: after a failed full parse, walk
   the sections and safeParse each array element, keeping the survivors, instead of
   reparsing only streams then falling to `parse({})`. This is the only finding
   that can destroy user data, and it gets worse as config syncs across versions.

2. **SEC-1 and SEC-2: put URL-scheme safety at the boundaries.** Add an `isSafeUrl`
   refinement to `DockLinkSchema.url`/`iconUrl` (`config/schema.ts:30`) so a
   `javascript:` link cannot enter storage, and gate the navigate sink itself
   (`main.ts:22`) so no future caller can bypass it. Both are one-line changes that
   move the invariant from "every call site remembers" to "the boundary enforces."

3. **Delete the dead code before going public.** DEAD-1 through DEAD-5:
   `time/overlap.ts` (+test), the dead half of `time/solar.ts`,
   `integrations/index.ts`, and about 94 lines of dead CSS. All verified unused,
   all carrying docstrings that describe features that no longer ship. Nothing
   confuses a new contributor faster than dead code that lies about itself.

4. **Unify the network transport (DUP-1) and fix the drift it hid (DATA-2).**
   Introduce `fetchJson(ctx, request, { serviceName })` and route all six
   integrations through it. Doing so forces one auth-status policy, which removes
   Linear's "400 means needs auth" bug where a malformed query is reported as a
   sign-in problem.

5. **Make persistence honest (CFG-1, CFG-2) and the edit pane cheap (PERF-1).**
   Catch and surface `store.save` failures and debounce them; move custom themes
   out of the single 8KB sync item; and memoize the Customize pane's Google
   calendar list so editing an unrelated field stops refiring live requests.

## Quick wins

Low effort, medium-or-higher payoff. A checklist.

- [ ] Delete `time/overlap.ts` + test and the dead half of `time/solar.ts` (DEAD-1, DEAD-2).
- [ ] Delete the two dead CSS families, about 94 lines (DEAD-4, DEAD-5).
- [ ] Delete or repurpose `integrations/index.ts` (DEAD-3).
- [ ] Add `isSafeUrl` refinement to dock link URLs (SEC-1) and gate the navigate sink (SEC-2).
- [ ] Add `.catch` to the Google connect call (ERR-1) and to `store.save` (CFG-1).
- [ ] Delete orphaned secrets when a connection is removed (CFG-3).
- [ ] Add a `--cc-color-negative` token for the ticker down-delta (PERF-7).
- [ ] Drop the two image hosts from `host_permissions` (SEC-7).
- [ ] Validate RSS item URLs at the boundary (SEC-3).
- [ ] Fix `RunDeps.getAuthToken` to the two-arg signature (TYPE-1).
- [ ] Merge the duplicated `.cc-edit__textarea` rule (styles.css:1448 and 1510).
- [ ] Bump Vite/Vitest to clear `pnpm audit` (DEP-1).

## Things that look bad but are actually fine

Calls considered and deliberately not flagged, with reasoning.

- **`isSafeUrl` (`security/url.ts:20`).** Robust. It extracts the scheme with the
  WHATWG URL parser (which normalizes classic bypasses like `java\tscript:` and
  leading whitespace), then blocks a dangerous-scheme set on top of an http/https
  allowlist, and returns false for anything unparseable. No bypass found. Keep it.
- **No `innerHTML` anywhere.** Verified: zero `innerHTML`/`insertAdjacentHTML`/
  `outerHTML`/`srcdoc`/`eval` in source. All feed text renders through
  `textContent`. The strong claim in the docstrings is accurate.
- **Whole-tree `replaceChildren` rebuild (`dashboard.ts:94`).** Looks alarming but
  is deliberate: render is pure, state lives in the model, FLIP animates survivors,
  and detached nodes are garbage-collected with their listeners (so the 29-to-3
  add/remove listener imbalance is not a leak). The only persistent listeners are
  document-level popovers, which are correctly removed.
- **Implicit OAuth flow (`response_type=token`).** Correct for a server-less
  extension: there is no client secret to protect, and expiry is handled by silent
  re-auth pinned with `login_hint`. SEC-6 is a small hardening nit, not a flaw.
- **Hardcoded Google client id and the manifest `key`.** Both are public by
  design (a public OAuth client id; the extension packaging key). Not secrets.
- **Unsplash access key in the request URL.** Unsplash's publishable key by
  design, kept in `chrome.storage.local` and never synced. Secrets separation is
  correct.
- **The eight `catch {}` blocks.** All are storage writes or `new URL()` parses,
  each with a justifying comment or an explicit fallback. No swallowed errors on a
  render path.
- **`devProxy.ts`.** Dev-only; tree-shaken from the production build. The host
  list is not a runtime permission surface.
- **CSP defined in both `csp.ts` and the manifest.** Guarded: `csp.test.ts`
  asserts the manifest equals `DEFAULT_CSP`, so drift is caught in CI.
- **The ten near-identical palette files.** Declarative theme data, not logic
  duplication. Greppable and easy for theme authors to copy.
- **`domain/result.ts`.** Small but genuinely used across about ten clients; a
  correct discriminated-union error type, not dead.
- **`ticker.ts` RAF polling of `clientWidth`.** Looks like a busy loop but is
  self-limiting, bails on disconnect, and its `ResizeObserver` self-disconnects.
  Correct handling of the zero-width-until-shown new-tab case.
- **The `?? 6` and per-integration guards individually.** Each is fine in
  isolation; they are listed under duplication (CON-1, CON-2) only because the
  repetition, not any single site, is the cost.

## Open questions for the maintainer

- **DATA-2 (Linear 400):** does Linear ever return HTTP 400 for a bad API key? If
  so, the current mapping is partly intentional and needs a more precise split
  rather than a straight removal.
- **CFG-4 (version field):** is a real migration-versioning scheme planned, or
  should the field and its comment be dropped now?
- **PERF-2 (whole-tree rebuild):** is the current scale (a personal dashboard)
  expected to hold, or is a widget-level diff worth planning for a heavier config?
- **SEC-5/theme contrast:** should an imported custom theme that fails AA contrast
  be rejected outright, or accepted with a warning? That is a product call.
- **The barrels (DEAD-3, DEAD-6):** are the `index.ts` files meant to be the public
  import surface (and currently under-maintained), or leftover scaffolding to remove?

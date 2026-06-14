# Command Center build plan

This is the loop's worklist. Every task is implemented test-first. A task is only checked off when its tests, the linter, and the build all pass. Work happens on branch `build/platform`. Commits are local until the user asks to push.

Legend: `[ ]` todo, `[~]` in progress, `[x]` done.

## Gates applied to every task

- Tests written before implementation (TDD).
- `npm test` green, `npm run lint` clean, `npm run build` succeeds for web work.
- For Swift work: `swift build` and `swift test` green, SwiftLint clean.
- No `any`, no swallowed errors, feed text rendered as text not HTML, action URLs validated.
- First paint budget respected for dashboard work.

---

## Phase 1: dashboard, static and test-driven

Foundation, no native code. Renders the widget vocabulary and the first theme against mock data.

- [x] P1.1 Scaffold `dashboard/`: npm, strict TS, Vite, Vitest, jsdom, Testing Library DOM, ESLint, Zod. Scripts: test, lint, build, dev.
- [x] P1.2 Core domain types and Zod schemas: FeedEnvelope, Status, Glance, Card, Action, and the Widget union (metric, list, table, chart, timeline, progress, text). Validation tests with factory functions.
- [x] P1.3 Convenience-kind schemas and mappers to cards/widgets: calendar.today, reminders.today, linear.inbox, docs.recent. Tests.
- [x] P1.4 Time engine: world-clock current time, day/night, date offset, timeline overlap, all with injectable now. Pure, deterministic tests.
- [x] P1.5 Weather client: Open-Meteo fetch and parse, injected-fetch behavior tests.
- [x] P1.6 Dashboard composition: from a getDashboard payload, compose ordered cards and resolve states ok, stale, needs_auth, error, absent. Tests.
- [x] P1.7 Attention and layout model, basic: ordering and glance-versus-full decisions. Tests.
- [x] P1.8 Security utilities: text-only rendering helper, action URL validation against host allowlist, CSP string. Tests cover injection attempts.
- [x] P1.9 Default widget renderers, vanilla DOM into a host node, one per widget type. Testing Library behavior tests.
- [x] P1.10 Theme token layer and the first theme tokens (Aurora). Token application. Tests.
- [x] P1.11 Dashboard shell: header with time, date, greeting; responsive grid; instant paint from cache; all card states. Integration tests.
- [x] P1.12 Mock native bridge and mock feed fixtures for local dev and the demo page.
- [x] P1.13 Performance pass: bundle budget check, reduced-motion support, first-paint measurement harness.
- [x] P1.14 Phase 1 demo: index.html renders the full dashboard from mocks. Verified with a live screenshot.

## Phase 2: native shell and the bridge

Decision: Developer ID distribution, non-sandboxed (see lessons). Build/test logic unsigned; signing and notarization wait for the release task and the user's certificate. Lead with the distribution-agnostic SwiftPM core, which needs no signing.

- [x] P2.0 SwiftPM core package `CommandCenterCore`: Codable manifest/feed models mirroring the TS contract (feed `data` kept as opaque JSONValue and forwarded; the dashboard stays the single widget validator), feed-envelope decoding with schemaVersion + glance guard, and provider-installed detection via NSWorkspace (injectable for tests). `swift test`. Distribution-agnostic, no signing.
- [x] P2.2 FeedStore directory scanner in CommandCenterCore: given an injected container base URL, list Providers/<id>/manifest.json, decode each manifest and its feeds, drop unreadable feeds, filter to installed providers, and compose a DashboardData-like result. Signing-free; swift-test with temp directories. (Moved before Xcode scaffolding so it needs no Team ID.)
- [x] P2.1 Scaffold `app/` and `extension/` with XcodeGen project.yml, Developer ID entitlements (App Group, ubiquity-kvstore, no sandbox), Info.plist, referencing CommandCenterCore. Structure verified: unsigned build assembles CommandCenter.app with the embedded extension and resources. Team ID DEVELOPMENT_TEAM = 955GSY56UT.
- [ ] P2.1b Signed build / capability registration (USER-BLOCKED). Signed build fails: the provisioning profile lacks the iCloud capability and the ubiquity-kvstore entitlement. Resolve by either registering iCloud (KVS) + App Group capabilities for App IDs com.strategicnerds.commandcenter and .Extension in the Apple Developer account, or deferring iCloud settings sync (remove the ubiquity-kvstore entitlement, keep the App Group). Awaiting the user's choice. (see lessons; Developer ID cert in keychain). Author the project, `xcodegen generate`, and attempt `xcodebuild` of the app + extension. If the App Group entitlement or signing blocks a local build (e.g. App Group not registered to the team, or codesign fails), STOP and report the exact error rather than guessing.
- [x] P2.3 SafariWebExtensionHandler getDashboard and getSettings, composing providers plus settings.
- [ ] P2.4 Swap dashboard from mock JSON to sendNativeMessage, with graceful fallback.
- [x] P2.5 commandcenter:// URL scheme, Router, host-allowlist validation, browser routing reusing MeetAppType.
- [x] P2.6a Settings writer (core): a SettingsStore that atomically writes/reads CommandCenter/settings.json in an injected container URL, plus a defaultSettingsDocument. Round-trip tested with temp dirs; FeedStore.loadSettings reads what it writes. Defer iCloud KVS sync (entitlement unregistered, P2.1b).
- [x] P2.6b Settings UI (app): the menu-bar popover + settings window in SwiftUI, MATCHING Sync Bar / Meeting Notifier. Port their design system (AppRadius/AppSpacing, ThemePalette, AppTheme + ThemeStore, DesignComponents, MenuBarPopover/SettingsView styling) into the CommandCenter app target; read those files first. Compile-verify via unsigned xcodebuild.
- [x] P2.7 Apple EventKit provider, publishing calendar.today (reminders.today can reuse the same FeedPublisher later).
- [ ] P2.8 Safari extension manifest with newtab override, minimal background, CSP. Cold-start test.

## Phase 3: first real provider

- [ ] P3.1 Add App Group entitlement to Linear Bar.
- [ ] P3.2 FeedPublisher in Linear Bar, publish linear.inbox with honest status. Tests.
- [ ] P3.3 Verify live inbox renders, absence hides the card, needs_auth prompts reconnect.

## Phase 4: schedule provider

- [ ] P4.1 App Group and FeedPublisher in Meeting Notifier, publish calendar.today.
- [ ] P4.2 Join routing decision and wiring.

## Phase 5: open provider platform

- [x] P5.4d FeedStore multi-root discovery: scan the App Group container AND the well-known Application Support dir (file-drop), dedupe by providerId (earlier root wins), via a MultiRootFeedStore composed on FeedStore + a ProviderSource protocol. Wire the extension handler to both roots. Update docs/12/03.
- [x] P5.5 Providers consent screen (app UI): list registrations (RegistrationStore), approve (IngestHandler.approve -> show token for delivery)/deny/revoke, status. Match the suite theme via the ported ThemeStore. Compile-verify unsigned.

- [x] P5.2a Ingest core logic (CommandCenterCore, testable): capability-token issuance/validation/revocation, a registration model (pending consent -> approved), and an IngestHandler that processes typed ingest requests (register, publish, revoke) — validating tokens and writing feeds via FeedPublisher into an injected container. Security tests: publish without a valid token refused, revoked token stops working, registration needs consent. Identity = loopback + consent tokens (lessons).
- [x] P5.1 Local ingest endpoint TRANSPORT (app, thin): loopback NWListener HTTP + WebSocket wired to the IngestHandler, default port + Bonjour discovery. Compile-verify unsigned; do not bind real ports in unit tests.
- [x] P5.3 CommandCenterKit SDK: register, publish, two transports (file-drop + endpoint), token storage. Tests. (openStream/live-publish deferred to a later iteration.)
- [ ] P5.4 Full widget vocabulary including charts and tables in renderers.
- [ ] P5.5 Providers screen: approval, status, revocation.
- [x] P5.6 Sample provider app and public protocol docs.

## Phase 6: open presentation layer

- [x] P6.2 Ship Aurora, Paper, Mono (token themes) + registry + settings-driven selection.
- [x] P6.1 Render-theme tier (custom JS renderers, shadow-root isolation). First-party render themes; third-party untrusted render themes gated behind an iframe/worker sandbox (future, needs user security review).
- [ ] P6.3 Theme guideline and a sample theme of each tier.

## Phase 7: polish and ship

- [ ] P7.1 Onboarding: enable extension, show detected providers.
- [ ] P7.2 Background image and quote option, reminders card.
- [ ] P7.3 Accessibility and reduced-motion full pass.
- [ ] P7.4 Cold-start service-worker testing on target Safari.
- [ ] P7.5 Developer ID signing, notarization, Sparkle, release pipeline.

---

## Standing quality mandate

Every iteration: keep the architecture impeccable, not just green. Before marking a task done, refactor what you touched (no duplication, no dead code, single source of truth, honest docs). Periodically re-audit. The full tech-debt audit (below) set the baseline; do not regress it.

## Tech-debt audit (2026-06-14) — completed

Three parallel specialist audits (dashboard TS, Swift, cross-language contract). Verdict: architecture healthy (no God classes, no oversized files, clean boundaries, provider-declares/theme-renders enforced in code). Fixed:
- DEFECTS: openProvider/reconnect silent no-op (now resolves providerId -> installed app and launches it); FeedStore traversal guard now resolves symlinks (+ test); feed image URLs validated (https-only) before render; settings/calendar write failures logged not swallowed.
- SINGLE SOURCE: meeting-host list unified into MeetingHosts (was duplicated across Routing + CalendarFeed); shared ISO8601 formatter; shared path-safety helper used by FeedStore + FeedPublisher; shared Swift test support (removed 5 duplicated locators + temp-dir helpers); shared firstIssue() zod-error helper at all 5 TS parse sites.
- DEAD CODE: removed textEl, tokensToCssText, formatBytes/isWithinBudget/BUNDLE_GZIP_BUDGET_BYTES (+ tests); SizeSchema now used in CardSchema.
- PARITY: Swift feed decoding tightened to TS (positive version, non-empty providerId/kind); JSONValue Sendable; EventKit I/O moved off the main thread; browserRouting added to the TS settings schema; table cells routed through setText.
- DOCS: reconciled the scheme-vs-host validation split, openProvider behavior, unimplemented transports, planned reminders producer and settings write-back, and series colorHex-vs-hints.
- Verified: 51 swift tests, 142 dashboard tests, lint, unsigned native build, bundle size — all green.

Remaining MINOR/deferred (non-blocking, by design): accountEmail optional field unused by the Apple provider (privacy stance prefers names+counts — consider dropping); manifest schemaVersion not version-guarded (feed envelope is); deriveAllowedSchemes can widen the scheme set from a manifest (documented trust boundary, native re-validates host); JSONValue decodes numbers as Double (no large-int feed fields today).

## Review log

### Iteration 22 (P5.2a)

Shipped: the ingest core in CommandCenterCore. ProviderRegistration + RegistrationStore persist provider registrations (consent state pending/approved/denied) to CommandCenter/registrations.json, surviving restarts. IngestHandler processes register (idempotent, starts pending), approve (issues a capability token ONCE, persists only its SHA-256 hash, writes the manifest), deny, revoke, and publish (writes the feed via FeedPublisher only for an approved provider with a matching token). Tokens are secrets: only the hash is stored, comparison is constant-time, and values are never logged. Quality: factored the encode+atomic-write pattern into writeJSONAtomically, now used by FeedPublisher, SettingsStore, and RegistrationStore (removed 3-way duplication).

Verified: 9 new swift tests (60 total) green: pending start, idempotent register, publish refused before approval / with wrong token / for unknown / revoked / denied providers, approved publish writes a FeedStore-readable feed, and a restart test asserting the token still works AND the raw token never appears in the persisted file. Changed publish to return IngestError? (Void Result is not Equatable). Unsigned native build + dashboard gates green.

Next: P5.1 the loopback NWListener transport (thin, wired to IngestHandler), then the CommandCenterKit SDK. Possible later hardening noted: move token hashes to the Keychain rather than the container file.

### Iteration 23 (P5.1)

Shipped: the ingest transport, split wire-protocol (pure) from socket (thin). In CommandCenterCore: IngestRequest (register/publish, typed Codable enum that throws on unknown type), IngestResponse, and handleIngestMessage(Data, using: IngestHandler) -> Data that decodes, dispatches, and encodes a response (registered+status / accepted / refused-with-code); IngestError gained a stable wire code. In the app target: IngestEndpoint, an NWListener on 127.0.0.1 (loopback-only) with 4-byte length-prefixed framing, a 1 MB cap, and per-connection receive->handle->send->close; started at launch only when the App Group container exists (inert in unsigned dev, not dead code). Tokens are never echoed in a response.

Verified: 6 new swift tests (66 total): register->pending, malformed->invalid_request, unknown type refused, publish-before-approval->not_approved, approved publish over the protocol writes a FeedStore-readable feed, and a response never echoes a token. Unsigned native build (NWListener compiles) + dashboard green.

Next: P5.3 CommandCenterKit SDK (a separate SwiftPM package: register/publish/openStream, transport auto-select file-drop vs endpoint, token storage in Keychain), then P5.5 providers screen (approve/deny/revoke + token delivery UX). Self-review for new debt is due around now per the mandate.

### Iteration 24 (P5.3)

Shipped: the CommandCenterKit SwiftPM package (packages/CommandCenterKit), a path dependency on CommandCenterCore so it reuses JSONValue, IngestRequest/Response, and FeedPublisher (single source of truth, no duplication). Public API CommandCenter(providerId:displayName:bundleId:transport:) with register(manifest:) and publish(_:to:); one IngestTransport protocol with two implementations: FileDropTransport (writes via the core FeedPublisher into the well-known dir, for Developer ID apps) and EndpointTransport (encodes IngestRequest, sends via an injected IngestSocketClient, reads the token from an injected TokenStore). Thin concrete pieces: LoopbackSocketClient (NWConnection, length-framed, async) and KeychainTokenStore (SecItem), plus InMemoryTokenStore for tests. Token is a secret: Keychain-stored, never logged. Made IngestResponse's init public so SDK consumers can construct responses.

Verified: 6 Kit swift tests (file-drop register+publish -> FeedStore-readable provider; endpoint encodes the right register/publish request incl. the stored token; publish without a token throws notApproved; a refused response surfaces). Core 66 + unsigned native build + dashboard all green.

Next: P5.5 providers screen (approve/deny/revoke + token-delivery UX, matching the suite theme) and the second discovery root (FeedStore scanning the well-known dir). openStream/live WebSocket publishing also deferred.

### Iteration 25 (P5.4d)

Shipped: multi-root provider discovery. ProviderSource protocol (FeedStore and MultiRootFeedStore both conform); MultiRootFeedStore composes per-root FeedStores, unions providers, dedupes by providerId with earlier roots winning, and takes settings from the first root that has them. DashboardComposer now takes a ProviderSource (was a concrete FeedStore). The well-known directory path moved to CommandCenterContainer.wellKnownDirectoryURL as the single source (the SDK's FileDropTransport now delegates to it). The extension handler discovers across both roots (App Group first, then the well-known dir). Docs 12 and 03 updated: Transport 1 (file-drop) and Transport 2 (endpoint) are now implemented; discovery spans two roots.

Verified: 3 new core swift tests (69 total): unions providers across roots, earlier-root-wins on a providerId collision, settings from the first root that has them. Kit 6, unsigned native build, dashboard all green.

Next: P5.5 the providers consent screen UI (approve/deny/revoke + token delivery), matching the suite theme.

### Iteration 26 (P5.5)

Shipped: the providers consent screen. Pure core: ProviderRow + providerRows(from:) maps registrations to sorted display rows (tested). App: ProvidersModel (loads rows from RegistrationStore, routes Approve/Deny/Revoke to IngestHandler, holds the one-time token in memory only) and ProvidersCard, a themed SwiftUI card added to SettingsView listing each app with its consent state and actions, plus a token-delivery row after approval (monospaced, copy to pasteboard, shown once, never persisted/logged). Quality: extracted AppContainer.url() as the single dev/App-Group container resolver, and refactored AppSettings to use it (removed the duplicated fallback logic).

Verified: 2 new core swift tests (71 total): mapping sorts case-insensitively and carries consent/ids. Kit 6, unsigned native build, dashboard green. Fixed a try?-flattening double-bind (logged).

The open platform is now functionally complete end to end (unsigned): a third-party app uses CommandCenterKit to register/publish (file-drop or endpoint), the user approves it here and delivers the token, and the dashboard discovers and renders the feed across both roots. Remaining Phase 5: openStream/live WebSocket publishing (deferred). Phase 6 (themes for the dashboard) and Phase 7 (ship) remain, plus the signed/Safari and other-app tasks that need the user.

### Iteration 27 (P6.2)

Shipped: the dashboard's token themes. Added Paper (light editorial serif) and Mono (dense monospaced) alongside Aurora, a theme registry (SHIPPED_THEMES, DEFAULT_THEME, themeById(id, fallback)), and settings-driven selection: renderDashboard now resolves the theme from settings.appearance.theme (a themeId) and applies it, defaulting to Aurora; added appearance.theme to the settings schema. The dashboard's web themes stay separate from the native app themes.

Verified: 6 new dashboard tests (148 total): each shipped theme validates against ThemeTokensSchema with a unique id, registry lookup + fallback, and an integration test that settings.appearance.theme = mono applies mono's bg var to the root. Lint, build, size all green.

Self-review done (was due): the Phase 5 + theme code is clean; the real duplications were already factored as I went (writeJSONAtomically, hexString, AppContainer, MeetingHosts, ProviderSource, the well-known path). No new debt.

NOTE on the render-theme tier (P6.1): deferred for the user's review. It executes third-party JavaScript in the new tab page; its security guarantees (shadow-root isolation, no-network theme CSP) cannot be fully verified in jsdom and warrant the user weighing in on the security model before building. Token themes already deliver the user-facing theming.

Next: P5.6 a sample provider using CommandCenterKit + a public "build a provider" doc (fully verifiable, showcases the platform).

### Iteration 28 (P5.6) — autonomous backlog exhausted; loop paused for the user

Shipped: examples/sample-provider, a SwiftPM package (library + executable + tests) depending on CommandCenterKit and CommandCenterCore. SampleProvider builds a DeployBot manifest + a metric-card feed (sub-expression JSON to keep the type checker fast) and publishes via CommandCenter + FileDropTransport. The executable takes an optional output dir (default the well-known dir). Plus docs/15-building-a-provider.md (accurate to the SDK API: register/publish, file-drop vs endpoint, the consent/token flow, the glance + display-data-only rules), linked from docs/README.

Verified: sample package builds (incl. executable) and 2 tests pass (publish -> FeedStore-readable provider; feed decodes as a valid envelope). RAN the executable against a temp dir: it wrote Providers/com.example.deploybot/{manifest,deploys}.json. Full sweep green: core 71, Kit 6, sample 2, dashboard 148, unsigned native build.

LOOP PAUSED. The cleanly-autonomous, unsigned, this-repo backlog is exhausted. Everything remaining needs the user:
- Signing + capability registration -> run in Safari, finish P2.4 (native-messaging swap) + P2.8 (manifest cold-start). Needs iCloud/App Group capabilities on the Apple account (or -allowProvisioningUpdates approval).
- Phase 3-4: make Linear Bar + Meeting Notifier publish feeds (modifies the other apps).
- Phase 7: release pipeline (notarization, fresh Sparkle key, R2).
Deferred for a user decision: the render-theme tier (P6.1, executes third-party JS; security can't be fully verified in jsdom) and openStream/live WebSocket publishing (optional).

### Iteration 29 (P6.1) — render-theme tier (first-party)

User chose to build the render-theme tier. Shipped the verifiable first-party core: a RenderThemeRenderers type (per-widget-type WidgetRenderer), an optional `renderers` on Theme and `themeRenderers` on RenderContext, and renderWidget dispatch that, when the active theme provides a renderer for a widget type, renders it into an isolated SHADOW ROOT (DOM/style isolation; --cc-* tokens still pierce). Theme renderers receive only display data + the validated context (format time, invokeAction) — no feeds, no tokens, no direct URL opening. Threaded the active theme's renderers through renderDashboard -> card -> ctx. Updated docs/14 with an honest implementation status.

Security boundary (told the user up front): this is for FIRST-PARTY (trusted) render themes. The connect-src 'none' no-network guarantee and a true JS sandbox for UNTRUSTED third-party render themes need a sandboxed iframe/worker — NOT built, gated, pending the user's security review. Token tier remains the safe default for outside contributors.

Verified: 3 new dashboard tests (151 total): themed widget renders into a shadow root and is isolated from the light DOM; falls back to the platform renderer when the theme lacks one; a theme renderer can only invoke actions through the validated context. Lint, build, size green.

Remaining unsigned/optional: openStream/live WebSocket publishing, and the third-party render-theme sandbox (needs user security review). Everything else (signed/Safari, Phase 3-4 other apps, Phase 7 ship) needs the user.

### Iteration 30 (tech-debt audit) — duplication swept into shared libraries

A 3-agent duplication audit (Swift, TS, library boundaries) confirmed the codebase is well-factored; it found one HIGH bug and a handful of small dedups, all now fixed:

- HIGH (a real bug, not just duplication): the 4-byte length-prefix wire framing was implemented twice and had drifted. IngestEndpoint capped reads at 1 MB; LoopbackSocketClient had NO bound (unbounded-read risk). Extracted `IngestWire` in core (single source for defaultPort, loopbackHost, maxMessageBytes, frame(), and a bounded decodeLength()), and refactored both transports onto it. Both ends now share one codec and one cap.
- MEDIUM: container resolution was inconsistent in unsigned dev. AppSettings/ProvidersModel used AppContainer.url() (dev fallback) while RouteHandler/EventKitCalendarProvider used CommandCenterContainer.url() (nil unsigned -> silent no-op). Funneled the latter two through AppContainer.url(). Added `CommandCenterContainer.applicationSupportBaseURL()` as the single source for the App Support base path (well-known dir + dev fallback both derive from it).
- Dedups: a public `AllInstalledProviderLocator` in core replaces three private always-true copies across the test targets; a shared `host()` test helper in dashboard/src/test/dom.ts replaces seven identical copies; a `makeActionable(node, action, ctx)` helper in render/helpers.ts replaces the repeated action-wiring block in list.ts and timeline.ts. Added cross-language "keep in sync" comments tying the TS MeetingSchema platform enum to the Swift MeetingPlatform.

Verified: full sweep green after every change. Core 75 tests (+ new IngestWire round-trip/bounds tests), Kit 6, sample 2, dashboard 151 + lint + build + size (22.9 KB gzip, budget 90), unsigned native xcodebuild SUCCEEDED. No behavior changed; the unbounded-read path is now closed.

Each iteration appends a short note here: what shipped, what was verified, what is next.

### Iteration 1 (P1.1, P1.2)

Shipped: dashboard project scaffold (strict TS, Vite, Vitest, ESLint type-checked, Zod) and the full core domain model: primitives (Tone, Trend, Status, Glance), actions (ActionRef, ManifestAction), the seven-type widget vocabulary plus Card, and the FeedEnvelope with version-aware parsing and freshness. Strict tsconfig: noUncheckedIndexedAccess, exactOptionalPropertyTypes, no `any`.

Verified: 21 tests green across feed, widgets, actions, including rejection of out-of-vocabulary widgets, missing glance, future schema versions, and bad dates. Lint and typecheck clean. Production audit 0 vulnerabilities (dev-only advisories noted).

Next: P1.3 convenience-kind schemas (calendar.today, reminders.today, linear.inbox, docs.recent) and their mappers to cards and widgets, test-first.

### Iteration 2 (P1.3)

Shipped: convenience-kind data schemas and `cardFromFeed`, mapping calendar.today, reminders.today, linear.inbox, and docs.recent to default list cards, plus pass-through of generic `card` feeds and a skip-able error for unknown kinds. Times are kept as ISO `time` trailings so the renderer formats them, keeping mappers deterministic and i18n-correct. Meeting events get a validated join action; inbox rows get an open action; overdue reminders and urgent inbox rows get urgent badges.

Verified: 12 new tests (33 total) green, covering each kind, missing required fields (start, url), empty days, malformed cards, and unknown kinds. Lint and typecheck clean.

Next: P1.4 time engine (world-clock time, day/night, date offset, timeline overlap) with injectable now, pure and deterministic.

### Iteration 3 (P1.4)

Shipped: the time engine in src/time/clock.ts. Every function takes an explicit instant, so it is pure and deterministic and reads no system clock. Built on a single Intl.DateTimeFormat parts extractor: zonedTime, tzOffsetMinutes, relativeOffsetMinutes (the world-clock timeline alignment value), dateOffsetDays (date-line crossing), dayNight with configurable sunrise and sunset bands, formatClock, and cityClock composing the per-city view.

Verified: 13 new tests (46 total) green, including a half-hour zone (Kolkata), summer-time offsets, a date-line crossing in both directions, and day/night band edges. A bad test expectation (offset arithmetic) was caught by the red test and corrected; the implementation was right. Lint and typecheck clean.

Next: P1.5 weather client (Open-Meteo fetch and parse) with mocked-fetch behavior tests.

### Iteration 4 (P1.5)

Shipped: the Open-Meteo weather client in src/weather. fetch is injected, so it is tested with no network and no global coupling. It talks to exactly one host (no key, no token), validates the response with Zod, maps WMO codes to a condition and icon with a safe fallback, and returns a ParseResult so a bad body never yields a partial model. Network throws and non-ok statuses become error results.

Verified: 9 new tests (55 total) green, covering success, host targeting, HTTP error, malformed body, network throw, and a response with no daily block. tsc caught an untyped vi.fn mock (empty-tuple call args); fixed by typing the stub parameter. Lint and typecheck clean.

Next: P1.6 dashboard composition (compose ordered cards from a getDashboard payload, resolve states ok/stale/needs_auth/error/absent), test-first.

### Iteration 5 (P1.6)

Shipped: the getDashboard payload schemas (Manifest, ProviderEntry, Settings, DashboardPayload) and composeDashboard, which flattens providers x feeds into ordered ComposedCards. State resolution: disabled is dropped, unknown kinds are silently skipped (one bad provider cannot break the page), needs_auth and error map to their states, malformed known-kind feeds and future schema versions become error (never half-rendered), empty days become empty, and ok/stale drive a fresh flag plus ageSeconds for the "updated Nm ago" note. Ordering honors settings.layout.cardOrder with a stable index tiebreak and drops hidden entries. No fetching, no tokens; composition only shapes finished feeds.

Verified: 13 new tests (68 total) green across every state, freshness past ttl, ordering, hidden, and payload parse rejection. Lint and typecheck clean.

Next: P1.7 attention and layout model (glance-versus-full decisions when many providers exist), test-first.

### Iteration 6 (P1.7)

Shipped: the attention model in src/dashboard/attention.ts. planLayout annotates each composed card as full or glance under a maxFull budget. Empty and error cards never consume a full slot; urgent cards (with a body) are promoted to full even past budget; remaining slots go to ready and needs_auth cards in order, so reconnect prompts surface and user ordering is respected. Also added the required feed glance to ComposedCard so glance-only and needs_auth cards always have a glance line to show.

Verified: 6 new tests (74 total) green, covering budget cutoff, urgent promotion past budget, empty/error never full, needs_auth full, all-urgent overflow, and order preservation. Lint and typecheck clean.

Next: P1.8 security utilities (text-only render helper, action-URL validation against a scheme and host allowlist, CSP string), test-first, with injection attempts in the tests.

### Iteration 7 (P1.8)

Shipped: the security utilities in src/security. url.ts resolves a manifest action plus a widget action-ref into a single validated URL: params are URL-encoded so they cannot break out, dangerous schemes (javascript, data, file, vbscript, blob, about) are always blocked, and the final scheme must be allowlisted, so a malicious param can never change the scheme and a dangerous template scheme is rejected. dom.ts gives setText and textEl, the only way renderers emit feed text, always as inert text, never innerHTML. csp.ts builds the new tab CSP, scripts self-only with no inline or eval, connect limited to the weather host.

Verified: 16 new tests (90 total) green, including javascript:/data:/file: rejection, scheme-change-by-param attempts, XSS strings rendered inert, and CSP shape. tsc caught a closure-narrowing bug (a guard collapsed to never); fixed by pre-scanning placeholders and logged as a lesson. Lint and typecheck clean.

Next: P1.9 default widget renderers (vanilla DOM, one per widget type) with Testing Library behavior tests, using the security helpers exclusively.

### Iteration 8 (P1.9)

Shipped: the default widget renderers in src/render, one per vocabulary type (metric, list, table, chart, timeline, progress, text) plus a renderWidget dispatch and a RenderContext (formatTime, invokeAction, reducedMotion). All text goes through the security helpers, so feed content is always inert. Renderers never resolve or open URLs: actionable rows and timeline items call ctx.invokeAction with the action ref, leaving validation and navigation to the platform. Charts are dependency-free SVG to respect the first-paint budget; progress is an accessible progressbar; tones become data attributes the theme styles. Added a minimal index.html and main.ts entry so the full build pipeline (tsc plus vite) is green.

Verified: 17 new tests (101 total) green, including XSS strings rendered inert, time formatting via context, click wiring to the action ref (no URL built in the renderer), typed table cells, line-chart point counts, timeline positioning, and progressbar aria. Security hook flagged an innerHTML in test cleanup; switched to replaceChildren. Lint, typecheck, and build all pass.

Next: P1.10 theme token layer and the first theme tokens (Aurora), applying tokens as CSS custom properties, test-first.

### Iteration 9 (P1.10)

Shipped: the theme token layer in src/theme. ThemeTokensSchema and ThemeMeta define the styling contract; tokensToCssVars flattens tokens to --cc-* custom properties (colors, px sizes, tabular-nums flag, motion speed, background); applyTokens sets them on an element and forces motion to zero under reduced motion; tokensToCssText emits a :root block. Added the Aurora theme (dark glass, gradient background) as the first shipped theme's token layer. Tones map to token colors so a data-tone attribute resolves to the theme's color.

Verified: 7 new tests (108 total) green, covering schema validation, the var mapping with units and flags, runtime application, the reduced-motion override, and CSS text output. Lint, typecheck, and build all pass.

Next: P1.11 dashboard shell (header with time/date/greeting, responsive card grid, instant paint from cache, all card states), tying renderers, theme, time, and weather together, with integration tests.

### Iteration 10 (P1.11)

Shipped: the dashboard shell in src/shell. renderDashboard applies theme tokens, then composes the header (time, date, hour-based greeting), a rail (weather summary with loading skeleton, world clock), and the card grid. renderCard handles every state: glance vs full presentation, needs_auth reconnect (launches the provider via a commandcenter://openProvider route, no feed param needed), quiet error and empty notices, and an age note for stale data. The action invoker (src/shell/actions.ts) binds manifest actions to navigation, deriving the allowed scheme set from declared non-dangerous app schemes while resolveActionUrl still blocks dangerous ones. Added a localStorage cache for instant paint and extended Settings with worldClock and weather.

Verified: 18 new tests (126 total) green: header greeting/time/date, world clock day-night and date offset, weather skeleton vs present, every card state, reconnect navigation, the cache round-trip and corrupt-cache fallback, and a full renderDashboard integration test that clicks an inbox row and asserts the resolved linearbar:// navigation. Two issues caught before completion: the needs_auth reconnect originally reused a param-requiring action (would never fire), redesigned to openProvider; and a ComposedCard-vs-PlacedCard factory type mismatch, fixed with makePlacedCard. Lint, typecheck, and build pass.

Next: P1.12 mock native bridge and mock feed fixtures, so the dashboard runs end to end against realistic data for local dev and the demo.

### Iteration 11 (P1.12)

Shipped: the DashboardBridge interface (getDashboard returns unknown, always validated), a createMockBridge, and a realistic mockDashboardPayload exercising the full variety: a calendar list card with meet/zoom join actions, an urgent linear inbox, a generic card-kind provider carrying a metric plus a bar chart, and a needs_auth Notion provider. Settings include three world-clock cities and a weather location. Web links use a commandcenter://open route rather than a raw https template, since the action resolver URL-encodes params (an encoded https value is not a navigable URL); the native app decodes and opens. Added buildDashboardModel (parse, compose, plan) as the single call the shell makes from bytes to cards.

Verified: 9 new tests (135 total) green: the fixture parses, exercises every required kind and the needs_auth status, carries a glance on every feed, and buildDashboardModel surfaces the needs_auth card and the chart-bearing generic card, with an error path for bad input. Lint, typecheck, and build pass.

Next: P1.13 performance pass (bundle budget check, reduced-motion support, first-paint measurement harness).

### Iteration 12 (P1.13)

Shipped: the perf module (src/perf). prefersReducedMotion reads the media query (injectable, safe when unavailable, returns false rather than throwing); measureFirstPaint times a render callback against the 100ms budget with an injectable clock; budget helpers and a 90KB gzip ceiling. Added scripts/check-bundle.mjs and an npm "size" script that gzips dist and fails if over budget; current bundle is 0.5KB gzipped with huge headroom (the full app pulls in more once main wires it). Reduced motion flows through applyTokens (motion speed 0) and the RenderContext.

Verified: 8 new tests (143 total) green, including the reduced-motion guard, the paint timer within and over budget, and the byte helpers. Fixed a jsdom crash where the default matcher assumed window.matchMedia exists; guarded it. Added scripts/ to eslint ignores (node tooling, not in the TS program). Lint, typecheck, build, and size all pass.

Next: P1.14 the viewable demo: CSS for the Aurora look and a main.ts that wires the mock bridge, reduced motion, first-paint measurement, weather fetch, and instant paint from cache, then a manual verification screenshot. This completes Phase 1.

### Iteration 13 (P1.14) — Phase 1 complete

Shipped: the viewable demo. runDashboard (src/app/run.ts) is the testable app orchestration: instant paint from cache, then live bridge data which it caches, then a weather fetch and repaint, all injectable. main.ts wires it to the mock bridge with real Date, navigation, reduced-motion, and first-paint timing. styles.css implements the Aurora look entirely off the --cc-* tokens, so a theme swap restyles everything. Added vite-env.d.ts for CSS imports.

Verified: 4 new tests (147 total) green, including a full end-to-end render (cache then bridge then weather, clickable navigation) and the cache-fallback-on-bridge-failure path. Built and served via vite preview, then loaded in a real browser: the dashboard renders the header greeting, world clock (SF/London/Bengaluru), the calendar card with two clickable meeting rows, the Linear inbox, the DeployBot chart card, and the Notion reconnect card. Screenshot delivered to the user. Bundle 22.4KB gzipped (budget 90KB). Lint, typecheck, build, and size all pass. Only console noise was a harmless favicon 404.

PHASE 1 DONE. Phase 2 (native macOS app, Safari extension, EventKit, native bridge) begins Swift/Xcode work that needs user decisions before proceeding: Developer ID vs Mac App Store distribution (affects sandbox, entitlements, and the Apple-Notes-adjacent scope), and the endpoint identity approach for later phases. Loop paused here pending those decisions.

### Iteration 14 (P2.0) — Phase 2 begins

Decisions applied: Developer ID, non-sandboxed (lessons). Shipped the CommandCenterCore SwiftPM package: JSONValue (lossless any-JSON, so feed data and settings forward to the dashboard unchanged and the widget vocabulary is never duplicated in Swift), the contract models (Tone/Trend/FeedStatus/Glance, Manifest, FeedEnvelope, ProviderEntry, DashboardPayload), decodeFeedEnvelope with a schemaVersion + non-empty-glance guard, decodeDashboardPayload, and injectable ProviderLocator provider-installed detection (WorkspaceProviderLocator over NSWorkspace).

Verified: 10 swift tests green via `swift build` + `swift test` (no signing): status mapping (needs_auth), opaque data round-trip, future-version refusal, empty-glance rejection, malformed JSON, JSONValue round-trip and bool-vs-number, and provider filtering. SourceKit showed stale cross-file errors that swift build resolved.

Design decision recorded: native forwards feed `data` as opaque JSON; the dashboard is the single widget validator (avoids two-language drift).

Next: P2.2 FeedStore directory scanner (signing-free, temp-dir tests), then P2.1 Xcode scaffolding which will pause for the user's Team ID and signing identity.

### Iteration 15 (P2.2)

Shipped: FeedStore in CommandCenterCore. Given an injected container URL it scans Providers/<id>/manifest.json, decodes each manifest, filters to installed providers via the ProviderLocator, reads each manifest feed path and decodes it (dropping unreadable or invalid feeds without failing the provider), and exposes loadProviders plus loadSettings (settings forwarded as opaque JSONValue). Security: feed paths are provider-controlled, so safeURL refuses any path that escapes the provider folder (../ traversal), verified by a test that plants a file outside the folder and confirms it is not read.

Verified: 7 new swift tests (17 total) green via swift build + swift test, no signing: installed provider with feed, uninstalled dropped, missing feed dropped but provider kept, no-manifest and malformed-manifest skipped, path traversal refused, settings present/absent. Files under 300 lines.

Next: P2.1 Xcode app/extension scaffolding. This needs the user's Apple Team ID (for the App Group identifier) and a signing identity to build the app target, so the loop will author the config and STOP to ask rather than guess.

### Iteration 16 (P2.1) — scaffolding verified, signed build user-blocked

Shipped: native/ XcodeGen project with two macOS targets, the CommandCenter menu-bar app (LSUIElement, status item, commandcenter:// URL type) and the CommandCenterExtension Safari Web Extension (NSExtension web-extension point, SafariWebExtensionHandler, manifest.json/newtab.html/background.js resources). Both reference the CommandCenterCore package. Entitlements: App Group group.com.strategicnerds.suite, ubiquity-kvstore; no sandbox; DEVELOPMENT_TEAM 955GSY56UT.

Verified: xcodegen generate succeeds; an unsigned build (CODE_SIGNING_ALLOWED=NO) SUCCEEDS and produces CommandCenter.app with CommandCenterExtension.appex embedded in PlugIns and the manifest/web resources in place. core swift test still green.

Blocked: a signed build fails with two exact errors: the Mac Team Provisioning Profile "doesn't include the iCloud capability" and "doesn't include the com.apple.developer.ubiquity-kvstore-identifier entitlement." The App Group did not error (it may auto-manage), but the build stops at iCloud KVS first. This needs an Apple Developer account capability decision, so the loop stopped and asked the user (P2.1b). No -allowProvisioningUpdates was run, since that would create/modify App IDs and capabilities on the user's account.

Next (pending user): resolve P2.1b, then P2.3 SafariWebExtensionHandler + getDashboard bridge.

### Iteration 17 (P2.3)

Shipped: DashboardComposer in CommandCenterCore, which assembles the getDashboard payload (installed providers via FeedStore + opaque settings + a passed-in generatedAt) and serializes it; plus CommandCenterContainer (the App Group id and container URL helper). Wired the thin SafariWebExtensionHandler to answer "getDashboard" by reading the container through a FeedStore and returning the composed JSON; all real logic stays in core, the handler is glue. No token or secret crosses the boundary; only display data.

Verified: 3 new swift tests (20 total) green via swift test (compose providers+settings, composeJSON round-trips through decodeDashboardPayload, empty container yields empty payload). xcodegen generate + unsigned xcodebuild SUCCEEDED with the extension importing CommandCenterCore. Dashboard gates still green.

Next: P2.5 commandcenter:// URL router + browser routing (testable routing logic in core), then P2.6 settings, P2.7 EventKit provider. (P2.4 swap dashboard to native messaging and P2.8 manifest cold-start need a signed/run-in-Safari build, so defer those until signing is resolved.)

### Iteration 18 (P2.5)

Shipped: the commandcenter:// router in CommandCenterCore. parseRoute turns a URL into a typed CommandCenterRoute (settings, join, open, openProvider) with native-side re-validation: join targets must be https meeting hosts (suffix-matched, so zoom subdomains pass), open requires https, openProvider refuses dangerous schemes; an encoded javascript:/file: url is refused after decoding. Plus BrowserChoice (bundle ids, mirroring MeetAppType), browserRouting(from: settings), and resolveBrowserBundleId (platform -> bundle id, system = default). The app-side RouteHandler is thin: it reads routing from settings and calls NSWorkspace.open; AppDelegate handles application(_:open:). All decision logic is in core and tested.

Verified: 17 new swift tests (37 total) green, including malicious-URL attempts (javascript, file, encoded scheme, non-meeting host), zoom subdomains, and browser resolution. xcodegen + unsigned xcodebuild SUCCEEDED. Dashboard gates green.

Next: P2.6 settings (settings.json App Group mirror writer in core, testable; menu-bar + settings UI matching Sync Bar / Meeting Notifier per lessons; defer iCloud KVS). Then P2.7 EventKit provider (pure EKEvent->feed mapping in core).

### Iteration 19 (P2.6a)

Shipped: SettingsStore in CommandCenterCore. The app is the sole writer of CommandCenter/settings.json; it writes atomically (Data.write .atomic) into an injected container URL and reads it back, plus defaultSettingsDocument mirroring docs/08 (theme, world-clock cities, weather, browserRouting). Settings stay opaque JSONValue (no token ever written here).

Verified: 6 new swift tests (43 total) green: write/read round-trip, nil before first write, directory creation, FeedStore.loadSettings reads what SettingsStore writes, default document round-trip and shape. Unsigned native build + dashboard gates green. Caught a Swift type-checker timeout on the big nested settings literal; fixed by building it from sub-expressions (logged as a lesson).

Next: P2.6b the menu-bar popover + settings window UI matching Sync Bar / Meeting Notifier (port their design system), then P2.7 EventKit provider mapping.

### Iteration 20 (P2.6b)

Shipped: the native UI matching Sync Bar / Meeting Notifier. Ported their design system into the app target verbatim: ThemePalette, AppTheme (system + 9 named themes: Hoth, Risa, Weasley, Starbuck, Cylon, Vader, Kirk, Hermione, Nerds), all palette definitions, ThemeStore (UserDefaults-persisted, re-publishes on OS light/dark flip), AppRadius/AppSpacing tokens, and the EnvironmentValues.theme. Built Components (SectionLabel, themed Card with soft elevation and NO borders per the design rule, SettingRow), a themed MenuBarPopover (brand header, theme picker, Settings/Quit), and a SettingsView (Appearance theme picker, per-platform browser routing, weather units, world-clock cities add/remove). AppSettings persists the dashboard-facing prefs via the core SettingsStore, with an Application Support dev-container fallback since the App Group is inactive unsigned. The status item shows the popover; the Settings scene hosts SettingsView.

Verified: unsigned native build SUCCEEDED with the full UI; 43 swift tests and dashboard gates green. One real compile fix: ForEach over BrowserChoice needed id: \.self (enum is Hashable, not Identifiable).

Next: P2.7 EventKit provider — pure EKEvent->calendar.today feed mapping in CommandCenterCore (testable), with the permission-gated EventKit reading kept thin in the app.

### Iteration 21 (P2.7)

Shipped: the Apple calendar provider. In CommandCenterCore: CalendarEventInput (EventKit-agnostic), detectMeeting (scans url, then location, then notes via NSDataDetector; classifies meet/zoom/teams/webex with suffix matching), calendarFeedEnvelope (sorted events -> calendar.today JSON with a derived glance and ISO times), appleCalendarManifest, and a general FeedPublisher that atomically writes manifest.json + feeds under Providers/<id>/. The app's EventKitCalendarProvider is thin: it maps EKEvent -> CalendarEventInput (including calendar color -> hex) and publishes via core; refreshIfAuthorized never prompts. Added NSCalendars[FullAccess]UsageDescription to the app Info.plist.

Verified: 7 new swift tests (50 total) green: meeting detection from each source/platform, a non-conference URL ignored, a valid decodable feed with the meeting object, empty-day glance, and a publish->FeedStore round-trip. Unsigned native build SUCCEEDED; dashboard green. One real fix: AppDelegate needed @MainActor to hold the @MainActor EventKit provider.

Remaining Phase 2 is signed/Safari-only and deferred: P2.4 (swap dashboard to native messaging), P2.8 (Safari manifest cold-start), and P2.1b (capability registration). The unsigned-buildable native logic for Phase 2 is now complete. Suggest pausing the loop here or moving to Phase 3 satellite integration (also needs the other apps + App Group), which is largely user/signing-gated. Consider reporting status to the user.

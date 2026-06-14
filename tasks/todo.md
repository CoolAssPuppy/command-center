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
- [ ] P2.1 Scaffold `app/` and `extension/` with XcodeGen project.yml, Developer ID entitlements (App Group, ubiquity-kvstore, no sandbox), Info.plist, referencing CommandCenterCore. Team ID is now known: DEVELOPMENT_TEAM = 955GSY56UT (see lessons; Developer ID cert in keychain). Author the project, `xcodegen generate`, and attempt `xcodebuild` of the app + extension. If the App Group entitlement or signing blocks a local build (e.g. App Group not registered to the team, or codesign fails), STOP and report the exact error rather than guessing.
- [ ] P2.3 SafariWebExtensionHandler getDashboard and getSettings, composing providers plus settings.
- [ ] P2.4 Swap dashboard from mock JSON to sendNativeMessage, with graceful fallback.
- [ ] P2.5 commandcenter:// URL scheme, Router, host-allowlist validation, browser routing reusing MeetAppType.
- [ ] P2.6 Settings: iCloud key-value store writer, settings.json mirror, Darwin-notification refresh.
- [ ] P2.7 Apple EventKit provider, optional, publishing calendar.today and reminders.today.
- [ ] P2.8 Safari extension manifest with newtab override, minimal background, CSP. Cold-start test.

## Phase 3: first real provider

- [ ] P3.1 Add App Group entitlement to Linear Bar.
- [ ] P3.2 FeedPublisher in Linear Bar, publish linear.inbox with honest status. Tests.
- [ ] P3.3 Verify live inbox renders, absence hides the card, needs_auth prompts reconnect.

## Phase 4: schedule provider

- [ ] P4.1 App Group and FeedPublisher in Meeting Notifier, publish calendar.today.
- [ ] P4.2 Join routing decision and wiring.

## Phase 5: open provider platform

- [ ] P5.1 Local ingest endpoint: loopback HTTP plus WebSocket, port and Bonjour discovery.
- [ ] P5.2 Registration with user consent, capability tokens, revocation. Security tests.
- [ ] P5.3 CommandCenterKit SDK: register, publish, openStream, transport auto-select, token storage. Tests.
- [ ] P5.4 Full widget vocabulary including charts and tables in renderers.
- [ ] P5.5 Providers screen: approval, status, revocation.
- [ ] P5.6 Sample provider app and public protocol docs.

## Phase 6: open presentation layer

- [ ] P6.1 Two-tier theme system, token and render themes, shadow-root isolation, no-network theme context.
- [ ] P6.2 Ship Aurora, Paper, Mono.
- [ ] P6.3 Theme guideline and a sample theme of each tier.

## Phase 7: polish and ship

- [ ] P7.1 Onboarding: enable extension, show detected providers.
- [ ] P7.2 Background image and quote option, reminders card.
- [ ] P7.3 Accessibility and reduced-motion full pass.
- [ ] P7.4 Cold-start service-worker testing on target Safari.
- [ ] P7.5 Developer ID signing, notarization, Sparkle, release pipeline.

---

## Review log

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

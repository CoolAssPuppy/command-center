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
- [ ] P1.4 Time engine: world-clock current time, day/night, date offset, timeline overlap, all with injectable now. Pure, deterministic tests.
- [ ] P1.5 Weather client: Open-Meteo fetch and parse, MSW-mocked behavior tests.
- [ ] P1.6 Dashboard composition: from a getDashboard payload, compose ordered cards and resolve states ok, stale, needs_auth, error, absent. Tests.
- [ ] P1.7 Attention and layout model, basic: ordering and glance-versus-full decisions. Tests.
- [ ] P1.8 Security utilities: text-only rendering helper, action URL validation against host allowlist, CSP string. Tests cover injection attempts.
- [ ] P1.9 Default widget renderers, vanilla DOM into a host node, one per widget type. Testing Library behavior tests.
- [ ] P1.10 Theme token layer and the first theme tokens (Aurora). Token application. Tests.
- [ ] P1.11 Dashboard shell: header with time, date, greeting; responsive grid; instant paint from cache; all card states. Integration tests.
- [ ] P1.12 Mock native bridge and mock feed fixtures for local dev and the demo page.
- [ ] P1.13 Performance pass: bundle budget check, reduced-motion support, first-paint measurement harness.
- [ ] P1.14 Phase 1 demo: index.html renders the full dashboard from mocks. Manual verification screenshot.

## Phase 2: native shell and the bridge

- [ ] P2.1 Scaffold `app/` and `extension/` with XcodeGen project.yml, entitlements, Info.plist, shared Swift package.
- [ ] P2.2 FeedStore: App Group discovery, manifest and feed decode, NSWorkspace install check. swift-test.
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

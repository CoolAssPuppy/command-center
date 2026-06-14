# Roadmap

Build order is chosen so something is visible and testable as early as possible, and so the riskiest unknowns are retired first.

## Phase 0: prove the two unknowns

Before building the product, confirm the two things that could invalidate the design. A day or less.

1. New tab override. Create a throwaway Safari Web Extension with `chrome_url_overrides.newtab` pointing at a static page. Install it, open a new tab, confirm the page renders. Then quit and reopen Safari and confirm behavior, noting the known service worker false error. This validates [06-safari-extension.md](06-safari-extension.md) on the actual target Safari version.
2. App Group round trip. Make two tiny signed apps under the same team. One writes a file to `group.com.strategicnerds.suite`, the other reads it. Confirm the container path resolves for Developer ID builds. This validates [03-provider-contract.md](03-provider-contract.md).

If both pass, the architecture holds. If the override fails on the target version, fall back to the homepage approach noted in [06-safari-extension.md](06-safari-extension.md), where the user sets the dashboard URL as their Safari homepage and new tab page in Settings.

## Phase 1: the dashboard, static and beautiful

Build the dashboard as a standalone static web app against mock feed JSON. No native code yet. This is where the product look is won.

- Header with time, date, greeting.
- World clock with day and night and a timeline strip. Pure JS, no provider needed.
- Weather from Open-Meteo for one chosen city.
- Schedule card from a mock `calendar.today` feed, with Join buttons that, for now, just log the intent.
- Linear inbox card from a mock `linear.inbox` feed.
- All card states: loading, empty, needs auth, stale, absent.
- Theme tokens and a couple of finished-looking presets.

Deliverable: open `index.html` locally and see the full dashboard with mock data. This is shippable as a demo on its own.

## Phase 2: the native shell and the bridge

Wrap the dashboard in the extension and wire the real read path.

- Create the Command Center app and the extension target with XcodeGen, mirroring the existing apps.
- Implement `FeedStore` discovery and `SafariWebExtensionHandler.getDashboard`.
- Swap the dashboard from mock JSON to `sendNativeMessage`.
- Implement the `commandcenter://` scheme and Join routing to browsers, reusing Meeting Notifier's `MeetAppType` and routing rules.
- Settings window writing iCloud key-value store and the `settings.json` mirror.

Deliverable: install the app, enable the extension, open a new tab, see the dashboard reading real settings, with Join opening the right browser. Providers still mock until Phase 3.

## Phase 3: make one real provider slot in

Pick Linear Bar first, since its feed is a single kind and it is self-contained.

- Add the App Group entitlement to Linear Bar.
- Add `FeedPublisher`, write the manifest, and publish `linear.inbox` after each inbox refresh, with honest `status`.
- Confirm the dashboard renders the live inbox, that removing Linear Bar hides the card, and that `needs_auth` shows a reconnect prompt.

Deliverable: a user with Linear Bar installed sees their real inbox on the new tab page, with no new sign-in.

## Phase 4: the schedule provider

- Add the App Group and `FeedPublisher` to Meeting Notifier, publishing `calendar.today`.
- Decide Join routing, recommended through Command Center.
- Optionally enable the Apple EventKit provider in Command Center for users without Meeting Notifier.

Deliverable: real schedule with working one-click joins from any connected source.

## Phase 5: open the platform

Turn the internal contract into a public one. This is where Command Center stops being an app and becomes a platform.

- Stand up the local ingest endpoint from [12-transports-and-ingest.md](12-transports-and-ingest.md), with registration consent and revocable tokens. Now Mac App Store apps can publish, not just Developer ID apps.
- Ship `CommandCenterKit`, the SDK that makes publishing a few lines, and a sample provider app.
- Implement the full widget vocabulary from [13-representation-model.md](13-representation-model.md), including charts and tables, so providers can choose their own representation rather than only the convenience kinds.
- Add the providers screen for approval, status, and revocation.
- Publish the protocol documentation for outside developers.

Deliverable: a developer outside Strategic Nerds can add the SDK, publish a metric or a chart, and see it on the surface after a one-time approval.

## Phase 6: open the presentation layer

- Implement the two-tier theme system from [14-themes.md](14-themes.md), token themes and render themes, with shadow-root isolation and the no-network theme context.
- Ship the two to three first-party themes, Aurora, Paper, and Mono.
- Publish the theme guideline and a sample theme of each tier.

Deliverable: a person can switch themes, and a designer can build and share one.

## Phase 7: polish and ship

- Onboarding that walks the user to enable the Safari extension and points out which providers were detected.
- Background image and quote option.
- Reminders card.
- Reduced-motion and accessibility pass.
- Cold-start testing of the Safari service worker caveat.
- Developer ID signing, notarization, Sparkle, matching the existing apps' release pipeline.

## Risks and how the design handles them

| Risk | Handling |
| --- | --- |
| Safari new tab override misbehaves on cold start | Keep the service worker trivial, do not depend on it, test cold start, homepage fallback exists |
| App Group not provisioned for Developer ID | Phase 0 proves it before any product work |
| Provider refresh races | Single owner per provider, no shared tokens |
| A feed leaks a secret | Review checklist in [10-security.md](10-security.md), display-only schemas |
| Provider installed but not authorized | `status: needs_auth` drives a precise reconnect prompt |
| Stale data shown as current | `updatedAt` plus `ttlSeconds` drive a visible freshness note |
| Adding future providers | File or endpoint discovery, zero Command Center changes |
| Any local process posting to the endpoint | Registration consent and revocable per-provider tokens |
| A render theme exfiltrating on-screen data | No-network theme context, shadow-root isolation, explicit install |
| Too many providers crowding the surface | Attention and layout model decides glance versus click |

## Open questions

1. Join routing: route everything through Command Center, or let Meeting Notifier keep opening its own links. Recommendation is to centralize in Command Center, decided in Phase 4.
2. Mac App Store or Developer ID. Developer ID matches the existing apps and avoids sandbox friction for the Apple Notes-style features that are already out of scope. Default to Developer ID unless App Store distribution is a hard requirement.
3. Notion and other future providers. They follow the same contract. Whether they are new standalone apps or modes inside Command Center is a later product call.
4. Whether the dashboard offers inline settings edits or defers all settings to the app window. Start by deferring to the app, add inline quick actions if the friction is real.

# Lessons

Patterns learned during the build, so mistakes are not repeated. Reviewed at the start of each loop iteration.

## Process

- Verify before asserting. The Safari new tab override was first claimed impossible from memory and turned out to be supported. Check primary sources before stating a hard constraint.
- App Groups are team-scoped. They cannot be the cross-developer transport. The open platform uses the local endpoint and a well-known directory instead.

## Testing

- Compute expected numeric values (time-zone offsets, dates) independently before writing the assertion. A red test caught a hand-done offset arithmetic slip in P1.4; the code was correct. Trust the red, then verify which side is wrong.
- Under strict TS plus type-checked ESLint, do not assign a closure-captured variable to drive later control flow. The compiler cannot see the assignment, narrows the variable to its initial type, and a later guard collapses to `never` (hit in P1.8 fillTemplate). Pre-scan or compute the value before the callback instead.
- In DOM render tests, attach the host node to document.body (and clear it in afterEach with replaceChildren, never innerHTML). getByText throws on miss so it already proves existence, but toBeInTheDocument additionally requires the node be attached to the document; a detached host fails it (hit in P1.9).
- Keep a buildable entry (index.html + src/main.ts) so `npm run build` stays green every iteration; vite needs an HTML entry even while the real shell is unwritten.
- A needs_auth reconnect must not reuse an action that requires a feed-supplied param (like open?url={url}); with no url it silently never fires. Launch the provider via a parameterless commandcenter://openProvider route instead. Design-review actions for their required params before wiring a button to them.
- To open a plain web link, use a commandcenter://open route with the url as a param, not a urlTemplate of `{url}`. The action resolver URL-encodes every param so it cannot break out, and an encoded https value (https%3A%2F%2F...) is not a navigable URL. The native app decodes the route param and opens it in the browser.

## Decisions

- Distribution: Developer ID, side-loaded and notarized, like Linear Bar and Meeting Notifier. The app is NOT sandboxed. Entitlements: App Group group.com.strategicnerds.suite, ubiquity-kvstore.
- Apple Team ID: 955GSY56UT. Signing identity: "Developer ID Application: Prashant Sridharan (955GSY56UT)" (Developer ID cert is in the local keychain). Set DEVELOPMENT_TEAM = 955GSY56UT in the Xcode project.
- Secrets live in Doppler project `command-center` (configs dev/stg/prd, repo `.doppler.yaml` points to dev). It holds APPLE_TEAM_ID, SIGN_IDENTITY, Cloudflare R2 (CLOUDFLARE_*, R2_*), PostHog (POSTHOG_*), notarization app-specific password (SPARKLE_APP_SPECIFIC_PASSWORD), and OAuth client creds (GOOGLE/LINEAR/NOTION CLIENT_ID/SECRET), copied from the sync-bar project. Build/release scripts should pull from Doppler like sync-bar does (doppler secrets get ... --project command-center).
- SPARKLE_PRIVATE_KEY was deliberately NOT copied from sync-bar: the Sparkle update-signing key must be unique per app for isolation. Generate a fresh EdDSA key for command-center at release time. Spotify/OpenAI keys skipped as out of scope.
- Phase 5 endpoint identity: loopback TCP + per-provider consent tokens (user-approved default). Registration is gated by a user consent prompt that issues a revocable capability token; every publish carries it. The Unix-domain-socket variant (peer code-signature verification) is a possible later hardening, not the default. Keep the request-handling logic pure and testable in CommandCenterCore; the NWListener transport stays a thin wrapper.
- Build unsigned during development (user choice). A SIGNED build is blocked because the provisioning profile lacks the iCloud capability and the ubiquity-kvstore entitlement (the App Group did NOT error and likely auto-manages). iCloud KVS + App Group capability registration and signed builds are deferred until the user is ready to run in Safari. Verify the app/extension targets with `xcodebuild ... CODE_SIGNING_ALLOWED=NO CODE_SIGNING_REQUIRED=NO`. Put testable native logic in CommandCenterCore so it runs under `swift test` with no signing; keep the Xcode targets thin.

## Process

- The Bash tool runs zsh, which does NOT word-split an unquoted `$VAR` in `for x in $VAR` (bash does). Use a literal list in the for statement, or `${=VAR}`, or an array. A copy loop silently iterated once over the whole string before this was caught.
- A large deeply-nested Swift literal (e.g. a JSONValue.object tree) can exceed the type-checker budget ("unable to type-check this expression in reasonable time"). Build it from named sub-expression `let`s instead of one literal. Hit in defaultSettingsDocument (P2.6a).
- An NSApplicationDelegate that holds a @MainActor-isolated property must itself be @MainActor (its AppKit delegate methods already run on the main thread). Otherwise the default property initializer is "called in a synchronous nonisolated context". Hit in P2.7.
- Result<Void, E> is not Equatable (Void is not Equatable), so XCTAssertEqual on it fails to compile. For an operation that returns nothing on success, return `E?` (nil = success) instead — Equatable and reads cleanly. Hit in P5.2a.
- `try?` flattens: `try? f()` where f returns `String?` yields `String?`, not `String??`. So `if let x = try? f()` already binds a non-optional; a second `let x` is a compile error. Hit in P5.5.

## Design

- No decorative borders or accent stripes on cards (user called the edge lines "AI slop"). Surfaces float on the background with soft elevation (a soft shadow), not hairline borders or a colored left bar. Keep theme CSS clean: fill plus shadow, no busy edges.
- The NATIVE macOS app chrome (menu-bar popover, settings window, any sheets) must MATCH Sync Bar and Meeting Notifier, including their themes. Reuse their SwiftUI design system rather than inventing one: port the token enums AppRadius/AppSpacing (meeting-notifier/.../Views/Theme.swift), the ThemePalette struct + AppTheme enum (system + named themes) + ThemeStore (sync-bar/Source/Models/ThemeStore.swift), and the component styling from sync-bar/Source/Views/Design/DesignComponents.swift, MenuBarPopover.swift, and SettingsView.swift. Put the ported design system in the CommandCenter app target (do NOT modify the other apps). This applies ONLY to the native app UI; the dashboard (web new-tab page) keeps its own pluggable web themes (Aurora, etc.) — do not cross-apply.

## Architecture invariants to never violate

- Providers declare, themes render. No provider ships HTML, CSS, JS, or pixels. No theme fetches data or holds a token.
- No OAuth token or client secret ever crosses an app boundary or enters the shared container or the endpoint.
- All feed text is rendered as text, never as HTML. No innerHTML with provider content.
- Every action URL is validated before opening, defense in depth: the dashboard enforces the scheme allowlist (dangerous schemes blocked, feed image URLs https-only), and the native app enforces the host allowlist (a commandcenter://join target must be a known meeting host). The dangerous-scheme list and the meeting-host list are security-critical; the meeting hosts live in one Swift source (MeetingHosts), and the dangerous-scheme lists in TS and Swift must be kept in sync by hand (cannot share a literal across languages).
- Every feed carries a required glance line.

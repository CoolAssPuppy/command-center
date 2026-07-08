# Can Command Center run in Safari?

Short answer: yes, the start page itself works in Safari, but shipping it there
costs more than Chrome and one feature (Google sign-in) has to be rebuilt. This
doc explains what ports for free, what breaks, and the two ways to close the gap.

A prior attempt already explored this and is preserved on the tag
`archive/safari-platform-2026-06-23`. It confirmed several unknowns and left
reusable Swift code. This analysis draws on that work and on the current
`dashboard/` codebase.

## Verdict

- The new tab page override works in Safari. This was the make-or-break question
  and the answer is positive.
- The rendering shell, storage, themes, weather, and every key-based integration
  (Notion, Linear, GitHub, Todoist, Finnhub) port with little or no change.
- Google Calendar and Google Tasks break. Safari has no `browser.identity`
  API, so the current sign-in flow cannot run. This is the only hard code
  blocker.
- Distribution is the real tax. A Safari extension must ship inside a signed,
  notarized native macOS app, and the user must switch it on in Safari settings.
  There is no "load unpacked" and no drag-and-drop zip.

## What ports cleanly

The dashboard was built browser-agnostic, which helps a lot.

- **New tab override.** Safari honors `chrome_url_overrides.newtab`. The prior
  attempt verified this against Apple's developer forums and rendered the real
  dashboard inside a Safari new tab.
- **Storage.** `src/config/store.ts:141` detects a `chrome` global and adapts
  `chrome.storage.sync` / `chrome.storage.local` behind a small `KeyValueArea`
  interface. Safari exposes the same `chrome`/`browser` storage namespace, so the
  store works as-is. Sync semantics differ (Safari syncs through iCloud rather
  than a Google account), which changes behavior but not code.
- **Rendering and security.** Everything under `src/shell`, `src/streams`,
  `src/render`, and `src/security` is plain DOM and TypeScript. The text-only
  render path (`src/security/dom.ts`), the URL allowlist (`src/security/url.ts`),
  and the strict CSP (`src/security/csp.ts`) are all standard web platform and
  behave the same in Safari.
- **Key-based integrations.** Notion, Linear, GitHub, Todoist, and Finnhub all
  authenticate with a user-pasted token or API key kept in `chrome.storage.local`
  (see `src/config/schema.ts:291`). None of them use browser OAuth, so none of
  them depend on anything Safari lacks. They keep working.
- **Manifest V3 and CSP.** Safari supports MV3 and the `content_security_policy`
  block in `public/manifest.json`. No change needed there.

## The one hard blocker: Google sign-in

The Google integrations are the exception. `src/integrations/googleOAuth.ts`
signs in with `chrome.identity.launchWebAuthFlow` and
`chrome.identity.getRedirectURL` (`src/integrations/googleOAuth.ts:16`). Safari
does not implement `browser.identity` at all, and the `chromiumapp.org` redirect
that Google is registered against (`src/integrations/googleOAuthConfig.ts:12`) is
Chrome-specific. The old `webRequest`-based workaround that some extensions used
is not available from an MV3 service worker, so there is no drop-in fix.

Consequences:

- Google Calendar (`src/integrations/googleCalendar.ts`) and Google Tasks
  (`src/integrations/googleTasks.ts`) cannot obtain a token in Safari.
- The code already fails soft here. `isGoogleOAuthAvailable()` returns false when
  `chrome.identity` is missing (`src/integrations/googleOAuth.ts:38`), so the
  connect button is hidden rather than broken. On Safari the user would simply see
  no Google option, not a crash.

The good news is that the seam for a replacement already exists. The token getter
is injected, not hardcoded: `RunDeps.getAuthToken` (`src/app/run.ts:106`) and the
integration `ctx.getAuthToken` (`src/integrations/types.ts:90`) are both dependency
injection points. A Safari build can supply a different token source without
touching the integrations.

Three ways to restore Google on Safari, cheapest first:

1. **Do without it.** Ship Safari with the key-based integrations only and hide
   Google. Zero new infrastructure. Weakest product, but a real option for a first
   release.
2. **Hosted redirect helper.** Stand up a tiny web page you control that completes
   Google's OAuth redirect and hands the token back to the extension (via a tab
   message or a copy-paste code). Registers one new redirect URI with Google. No
   native code, but you now run a small piece of hosted infrastructure.
3. **Native loopback flow.** The wrapper macOS app runs the OAuth flow with a
   loopback redirect, stores the token in the Keychain, and passes it to the
   extension over native messaging. Most secure (no token in the browser), most
   work. This is the path the archived attempt designed.

## The unavoidable tax: native wrapper and distribution

This is not a code problem, it is a platform rule, and it is the biggest change
from Chrome.

- A Safari Web Extension cannot be distributed on its own. It must be embedded in
  a native macOS app. Apple's `xcrun safari-web-extension-converter dist-extension`
  scaffolds that wrapper from the existing build in one command.
- The app has to be signed with a paid Apple Developer account ($99/year) and
  notarized before anyone else can run it. Development testing needs the
  "Allow unsigned extensions" toggle in Safari's Develop menu.
- After install, the user must open Safari settings and switch the extension on.
  Onboarding has to walk them there.

For a project you expect thousands of developers to clone, this matters. Cloning
and running the Chrome build is a two-minute "load unpacked." The Safari build
needs Xcode, an Apple Developer account, and a signing identity before it runs
outside your own machine. That barrier should be stated plainly in the README so
Safari is understood as an advanced target, not a peer of Chrome.

## Secondary changes

- **Host permission prompts.** Chrome grants the `host_permissions` in the
  manifest at install time. Safari asks the user per site, and the extension reads
  from many hosts (weather, several RSS feeds, each API). Expect a run of "allow
  on this website" prompts, or guide the user to "allow on every website." UX
  friction, not a blocker.
- **Manifest cleanup.** The Chrome-only `key` field
  (`public/manifest.json`) and the `identity` permission become meaningless in
  Safari. A Safari-specific manifest should drop them. The extension id is derived
  from the app bundle, not the `key`.
- **RSS over CORS.** The news feeds are fetched directly from publisher hosts.
  Confirm each still responds to a Safari extension request; Safari's cross-origin
  handling from the extension context is stricter than Chrome's in some cases.

## Two implementation paths

**Path A: wrap the current extension (recommended first step).**
Run `safari-web-extension-converter` over `dist-extension`, sign it, and ship the
key-based integrations. Hide Google, or add it later with option 2 or 3 above. The
dashboard, storage, and themes carry over unchanged. This is days of work plus the
Apple Developer setup, and it produces a working Safari new tab quickly. The main
open risk is verifying storage.sync and the RSS fetches on real Safari.

**Path B: native-host, provider-feed model (already prototyped).**
The archived branch built a menu-bar macOS app that fetches all data with its own
credentials and writes finished, token-free display feeds into a shared App Group
container. The extension only reads display data over native messaging, so no
secret ever enters the browser. This is more secure and sidesteps
`chrome.identity` entirely, but it is a large amount of Swift (a full app, a
provider SDK, a Keychain token store, a loopback OAuth flow) and it was parked
before it shipped. Reusable pieces still on the tag: the Safari extension manifest
and `SafariWebExtensionHandler.swift`, `KeychainTokenStore.swift`,
`LoopbackSocketClient.swift`, and the wrapper app scaffolding.

Note that Path B assumes a different data model than the current `dashboard/`,
which fetches client-side with tokens in the extension. Adopting Path B means
moving data fetching out of the browser, which is a rearchitecture, not a port.

## Why the earlier attempt was parked

Worth stating clearly, because it is easy to misread as "Safari didn't work." It
did work. The attempt stopped because the remaining tasks all needed you
personally: registering iCloud and App Group capabilities on the Apple Developer
account (a signed build failed without them), running the signed build in real
Safari, building feed publishers into the sibling apps, and running the release
pipeline. The Safari-specific unknowns (new tab override, service-worker
cold-start, native messaging) were resolved or engineered around, never hit a
wall. See `tasks/todo.md` on the archived tag for the iteration log.

## Recommendation

If Safari support is a goal, take Path A. Wrap the current extension, ship the
five key-based integrations, and hide Google Calendar and Tasks behind the
existing capability check. Add Google back later through a hosted redirect helper
if there is demand. Keep Path B in mind only if a token-free, native-grade version
becomes a priority; most of its value is security, and most of its cost is Swift.

Set expectations in the README: Chrome is the primary, clone-and-run target.
Safari is possible and the new tab works, but it requires a signed native wrapper
and gives up Google sign-in until that flow is rebuilt.

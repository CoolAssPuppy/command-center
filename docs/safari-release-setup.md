# Safari build and release setup

Command Center runs in Safari as a signed macOS app that hosts a Safari web
extension. The new tab page is the same dashboard as the Chrome build. The only
real difference is Google sign-in: Safari has no `chrome.identity`, so the app
runs the Google OAuth flow itself and hands the extension a short-lived token.

This document is the single source of truth for the Safari target: how it is put
together, the one-time setup that needs your Apple and Google accounts, how to
build and run it locally, and how to cut a release.

## What ships, and how much is shared

One codebase. The dashboard, storage, themes, and every integration are shared
with Chrome byte for byte. The Safari target adds a thin, isolated layer:

- A build flag. `pnpm build:safari` sets `VITE_TARGET=safari`, which compiles in
  the native Google bridge and compiles out the Chrome `chrome.identity` path.
  The flag is replaced at build time, so each browser ships only its own path.
- A generated Safari manifest. `dashboard/scripts/safariManifest.mjs` derives the
  Safari `manifest.json` from the Chrome one: it drops the Chrome `key` and the
  `identity` permission and adds `nativeMessaging`. There is no second manifest
  to maintain.
- A native container app under `native/`, built with XcodeGen.

Google sign-in is abstracted behind `GoogleAuthProvider`
(`dashboard/src/integrations/googleAuth.ts`), chosen at startup: `chrome.identity`
on Chrome, the native bridge on Safari. The calendar and tasks integrations never
change.

## How Google sign-in works on Safari

The container app is the only place a refresh token or client secret ever lives.
The browser only ever receives a short-lived access token.

1. The new tab page sends one native message to the extension:
   `{ type: "google-authorize", interactive, loginHint? }`.
2. The extension handler (`SafariWebExtensionHandler`) launches the app if needed
   and forwards the request over a loopback socket on `127.0.0.1:4849`.
3. The app runs the flow. Interactive sign-in opens
   `ASWebAuthenticationSession` with an authorization-code plus PKCE flow, then
   stores the refresh token in the Keychain. A silent request trades a stored
   refresh token for a fresh access token with no window.
4. The app returns `{ ok: true, token: { accessToken, expiresAt, email } }` (or
   `{ ok: false, error }`). The TypeScript side validates the token against the
   real schema before use.

### Security note on the loopback

The loopback listener answers any local caller. Another process on the same Mac
could ask for an access token for an already-connected account. The refresh
token itself never leaves the Keychain, and the app owns it, so the blast radius
is a short-lived read-only token. This is acceptable for the first release. A
later hardening step is a shared-secret handshake between the extension and the
app before the app answers.

## One-time setup

These steps need your accounts and cannot be done in the repo. Each is called out
in code with a `REPLACE_WITH_...` placeholder or a default that you override with
your own credentials.

### 1. Apple Developer signing

- A paid Apple Developer account, Team ID `955GSY56UT`.
- A `Developer ID Application` certificate and its private key in your login
  Keychain. The app is distributed directly (Developer ID), not through the App
  Store.
- The project already sets `DEVELOPMENT_TEAM`, hardened runtime, and no sandbox
  in `native/project.yml`.

### 2. Google Desktop OAuth client

Safari sign-in needs a Google OAuth client of type "Desktop app", separate from
the Chrome build's Web client. A desktop client has no usable secret and relies
on PKCE.

- In Google Cloud Console, create an OAuth 2.0 Client ID of type "Desktop app".
- Put its client id in `native/CommandCenter/AppConfig.swift`, replacing
  `REPLACE_WITH_DESKTOP_CLIENT_ID`.
- The app uses the reversed-client-id custom scheme as the redirect
  (`com.googleusercontent.apps.<id>:/oauth2redirect`). Google generates this
  redirect for a desktop client automatically; no extra registration is needed.
- On the OAuth consent screen, publish the app or add each Google account you
  want to connect as a test user.

### 3. Sparkle update keys

The app auto-updates with Sparkle. It has its own signing key, separate from the
other apps, and the key material lives in Doppler like the sibling apps
(sync-bar and friends), not the login Keychain.

- Install the Sparkle tools (`generate_keys`, `sign_update`) into
  `~/bin/sparkle/` (or set `SPARKLE_SIGN_UPDATE` to their location).
- The public key is already set in `native/CommandCenter/Info.plist`
  (`SUPublicEDKey`). The matching private key must be stored in Doppler project
  `command-center` config `prd` as `SPARKLE_PRIVATE_KEY`; `build-dmg.sh` pulls it
  at sign time, writes it to a short-lived 0600 file, and signs with
  `sign_update --ed-key-file`. Nothing is left on disk.
- To rotate or regenerate: `generate_keys --account command-center` creates a
  key under a dedicated Keychain account (so it never collides with the shared
  key), `generate_keys --account command-center -p` prints its public key for
  Info.plist, and `generate_keys --account command-center -x <file>` exports the
  private key to load into Doppler.
- `SUFeedURL` already points at the R2 appcast URL below. Change it only if you
  host the feed elsewhere.

### 4. Notarization and distribution credentials

- Notarization: the Apple app-specific password is shared across the fleet.
  `release.sh` pulls it from Doppler (`SPARKLE_APP_SPECIFIC_PASSWORD`) and
  notarizes as `prashant_sridharan@hotmail.com` / team `955GSY56UT`. Override with
  `NOTARY_APPLE_ID`, `NOTARY_TEAM_ID`, `NOTARY_PASSWORD`, or a `NOTARY_PROFILE`
  keychain profile if you prefer.
- Distribution: the release uploads to Cloudflare R2, bucket
  `strategic-nerds-downloads`, public base `https://downloads.strategicnerds.com`,
  under `apps/command-center/`. The script reads R2 credentials from Doppler
  project `command-center` config `prd`, or from `CLOUDFLARE_*` env vars if set.

## Build and run locally (unsigned)

You can run the whole thing on your own Mac without notarization.

```
brew install xcodegen create-dmg        # once, if missing
cd native
xcodegen generate                       # writes CommandCenter.xcodeproj from project.yml
open CommandCenter.xcodeproj            # or use xcodebuild
```

Build and launch the app from Xcode. The build runs `pnpm build:safari` and
embeds the dashboard into the extension automatically. Then, in Safari:

1. Enable Settings → Advanced → "Show features for web developers".
2. In the Develop menu, turn on "Allow unsigned extensions" (resets each Safari
   launch).
3. In Settings → Extensions, switch on Command Center.
4. Open a new tab. The dashboard appears. Connect a Google account to exercise
   the native OAuth round trip.

The app's menu-bar popover walks a first-run user through steps 3 and 4.

## Cut a release

One command, run on your Mac because it needs the signing cert and Sparkle key:

```
scripts/release.sh <version> "<release notes HTML>"
# e.g. scripts/release.sh 0.4.0 "<li>Safari support.</li>"
```

It bumps the version in `native/project.yml`, generates the project, archives and
exports a Developer ID app, notarizes and staples it, builds a signed and
notarized DMG, Sparkle-signs it, uploads the DMG (and a stable
`CommandCenter-latest.dmg`) to R2, prepends an item to `dist/appcast.xml`, and
uploads the appcast. Afterward, commit `native/project.yml` and
`dist/appcast.xml`.

`scripts/build-dmg.sh` does the DMG, signing, notarization, and Sparkle signing
on its own if you need to run just that step.

The installer window art lives in `native/dmg-assets/`. `background.png` is the
2640x1600 master, exported from the "Command Center — DMG Installer" artboard in
the Paper file. After re-exporting it, run `native/dmg-assets/make-background.sh`
to rebuild the multi-resolution `background.tiff` (a 660x400 @1x page and a
1320x800 @2x page) that `build-dmg.sh` passes to `create-dmg`. The app icon and
the Applications drop link are positioned at x355 and x555 in the 660x400 window
to land inside the two framed targets in the art.

The app icon is the "Day & Night" mark, exported from Paper to
`native/CommandCenter/Assets.xcassets/AppIcon.appiconset/icon_1024.png`. After
re-exporting that master, run `native/scripts/make-appicon.sh` to resample every
size the macOS icon slot needs and rewrite the catalog. Xcode compiles it via
`ASSETCATALOG_COMPILER_APPICON_NAME` in `project.yml`.

## Verify on real Safari

These checks need the signed build on your machine and are the last mile before
shipping:

- The new tab override renders after a full quit and relaunch of Safari (the
  known cold-start path).
- `chrome.storage.sync` and `.local` read and write. Sync goes through iCloud.
- Each RSS feed and API loads. Safari's cross-origin handling from the extension
  is stricter than Chrome's, so confirm the news feeds in particular.
- A Google account connects, calendar and tasks populate, and an expired token
  renews silently with no window.

## Repository layout

```
dashboard/                         Shared web app (Chrome + Safari)
  src/integrations/googleAuth.ts   Provider selection (chrome.identity vs native)
  src/bridge/native.ts             Safari native-messaging Google bridge
  scripts/safariManifest.mjs       Chrome -> Safari manifest transform
  scripts/finish-safari.mjs        build:safari finisher
native/
  CommandCenterAuth/               Shared, unit-tested OAuth core (PKCE, token
                                   endpoint, JWT email, Keychain, loopback wire)
  CommandCenter/                   Menu-bar app: OAuth service, loopback endpoint,
                                   Sparkle, onboarding
  CommandCenterExtension/          Safari appex: the native-messaging handler
  project.yml                      XcodeGen source of truth (project is generated)
  scripts/embed-dashboard.sh       Builds and embeds the dashboard into the appex
scripts/                           Release pipeline (release.sh, build-dmg.sh)
dist/appcast.xml                   Sparkle update feed (committed)
```

## Tests

- Dashboard: the Vitest suite covers the shared code, the native bridge
  (`src/bridge/native.test.ts`), provider selection
  (`src/integrations/googleAuth.test.ts`), and the manifest transform
  (`scripts/safariManifest.test.mjs`). Run `pnpm test`.
- OAuth core: `cd native/CommandCenterAuth && swift test` covers PKCE against the
  RFC 7636 vector, the authorization URL, token response decoding, the epoch-ms
  expiry math, JWT email decoding, and the wire framing and contract codecs.

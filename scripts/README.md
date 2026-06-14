# Release scripts

One-shot Developer ID release automation for Command Center, modeled on the
SyncBar release system. Sparkle (auto-update) is intentionally left out for now,
so there is no appcast and no update signature. This produces a notarized,
stapled DMG and uploads it to R2 for manual download.

## Files

- `release.sh` — the whole pipeline: bump version, regenerate, archive, export
  Developer ID, notarize + staple, build DMG, upload to R2, verify.
- `build-dmg.sh` — builds, codesigns, notarizes, and staples the DMG. Called by
  `release.sh`, or run on its own against an exported `.app`.
- `export-options.plist` — Developer ID export options (team `955GSY56UT`).

## Prerequisites

- `brew install create-dmg xcodegen`
- A `notarytool` keychain profile (default name `agent-server`):
  `xcrun notarytool store-credentials agent-server --apple-id <id> --team-id 955GSY56UT --password <app-specific-password>`
- `doppler` logged in with access to the `command-center/prd` config, providing
  `CLOUDFLARE_API_TOKEN`, `CLOUDFLARE_ACCOUNT_ID`, `R2_BUCKET_NAME`,
  `R2_PUBLIC_BASE_URL`.
- `wrangler` (`npm i -g wrangler`) or `npx` on PATH.
- The App ID provisioned for App Groups and iCloud Key-Value storage. The
  archive step uses `-allowProvisioningUpdates` to register the capabilities.

## Usage

```bash
./scripts/release.sh 0.2.0
```

The Release archive runs the extension's pre-build phase with the native bridge,
so the shipped new tab page talks to the app instead of the demo fixtures.

## Notes

- The version lives in `native/project.yml` (`MARKETING_VERSION` /
  `CURRENT_PROJECT_VERSION`); `release.sh` bumps both. Commit it afterward.
- To add auto-update later, reintroduce Sparkle: a signing key in Doppler, an
  appcast.xml, and the `sign_update` step in `build-dmg.sh`.

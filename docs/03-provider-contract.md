# Provider contract

This is the heart of the platform. Any app that follows this contract becomes a provider that Command Center can render. Get this right and everything else is rendering.

## The shared container

All apps in the suite share one App Group container:

```text
group.com.strategicnerds.suite
```

On disk, macOS places it at:

```text
~/Library/Group Containers/group.com.strategicnerds.suite/
```

To use it, every participating app must:

1. Be signed by the same Apple Team. All Strategic Nerds apps already are.
2. Declare the App Group entitlement `com.apple.security.application-groups` with the value `group.com.strategicnerds.suite`.
3. Read the container path at runtime with `FileManager.default.containerURL(forSecurityApplicationGroupIdentifier:)`.

App Groups work for Developer ID apps distributed outside the Mac App Store, which is how Linear Bar and Meeting Notifier ship today.

## Container layout

```text
group.com.strategicnerds.suite/
  Providers/
    <provider-id>/
      manifest.json
      <feed files, in any subpath the manifest names>
  CommandCenter/
    settings.json        # written by the Command Center app, read by the extension
```

`<provider-id>` is a stable, lowercase, hyphenated string the provider picks once and never changes. Examples: `linear-bar`, `meeting-notifier`, `command-center-apple`.

Each provider only ever writes inside its own `Providers/<provider-id>/` folder. It never writes another provider's folder, and never the `CommandCenter/` folder. Command Center only writes `CommandCenter/`.

## The manifest

Every provider writes one `manifest.json`. It describes the provider, the feeds it offers, and the actions its rows support.

```json
{
  "schemaVersion": 1,
  "providerId": "linear-bar",
  "displayName": "Linear",
  "bundleId": "com.strategicnerds.LinearBarApp",
  "appVersion": "1.4.2",
  "icon": "linear",
  "accentColorHex": "#5E6AD2",
  "updatedAt": "2026-06-14T15:04:05Z",
  "feeds": [
    {
      "kind": "linear.inbox",
      "path": "linear/inbox.json",
      "refreshIntervalSeconds": 120,
      "title": "Linear inbox"
    }
  ],
  "actions": [
    {
      "id": "open",
      "title": "Open in Linear",
      "urlTemplate": "linearbar://open?url={url}"
    }
  ]
}
```

Field notes:

- `schemaVersion` is the contract version, not the provider's app version. It is `1` for everything in this spec.
- `icon` is a name the dashboard maps to a bundled glyph. If unknown, the dashboard falls back to the first letter of `displayName`.
- `accentColorHex` lets the provider tint its card to match its brand.
- `feeds[].kind` must be one of the kinds in [04-feed-schemas.md](04-feed-schemas.md). Unknown kinds are ignored, not an error.
- `actions[].urlTemplate` is an app-specific URL the dashboard fills in and navigates to when the user clicks the action. `{url}` and other tokens are replaced from the feed item. This is how a Linear row opens in the Linear Bar app rather than in a browser.

## The feed envelope

Every feed file shares the same envelope. Only `data` changes shape per kind. The `data` for a convenience kind is defined in [04-feed-schemas.md](04-feed-schemas.md). A provider that wants full control over how it looks publishes widgets directly using the vocabulary in [13-representation-model.md](13-representation-model.md), and how the bytes arrive, file drop or local endpoint, is defined in [12-transports-and-ingest.md](12-transports-and-ingest.md).

```json
{
  "schemaVersion": 1,
  "providerId": "linear-bar",
  "kind": "linear.inbox",
  "producedBy": { "bundleId": "com.strategicnerds.LinearBarApp", "appVersion": "1.4.2" },
  "updatedAt": "2026-06-14T15:04:05Z",
  "ttlSeconds": 300,
  "status": "ok",
  "glance": { "value": "3", "label": "unread", "tone": "urgent", "trend": "up" },
  "data": { }
}
```

- `glance` is required on every feed. It is the single line the platform can always show, even when the card is collapsed, demoted by the attention model, or shown in a dense layout. It is a small metric: a `value`, a `label`, an optional `tone` of `neutral`, `positive`, or `urgent`, and an optional `trend` of `up`, `down`, or `flat`. The glance is the unit of value on the surface, so a feed without one is incomplete. See [00-vision.md](00-vision.md).

- `updatedAt` is when the feed was last written, in ISO 8601 UTC.
- `ttlSeconds` is how long the data should be considered fresh. After `updatedAt + ttlSeconds`, the dashboard shows a subtle "updated N minutes ago" note but still renders the data.
- `status` is one of:
  - `ok`: data is present and current.
  - `stale`: the app could not refresh but is serving the last good data.
  - `needs_auth`: the user must re-authorize in the satellite app. The dashboard shows a "Reconnect in Linear" prompt that triggers the provider's `open` action or launches the app.
  - `error`: a transient failure. The dashboard shows a quiet error state and keeps the last good data if any.
  - `disabled`: the user turned this provider off inside the satellite app. The dashboard hides the card.

## Writing feeds safely

Feeds are read by other processes while the owner writes them. Writes must be atomic so a reader never sees a half-written file.

- Write to a temporary file in the same folder, then rename it over the target with `FileManager.replaceItemAt` or `Data.write(to:options:.atomic)`. The atomic option does the temp-and-rename for you.
- Never hold a feed open for streaming writes.
- Keep feeds small. Cap lists at a sensible item count, for example 25 events or 50 inbox items, and let the dashboard show "and N more".

## Discovery

Command Center discovers providers by scanning the container, not by hardcoding a list.

1. List `Providers/*/manifest.json`.
2. For each manifest, confirm the owning app is actually installed using `NSWorkspace.shared.urlForApplication(withBundleIdentifier:)` against `manifest.bundleId`. Both satellite apps already use this exact call, so the pattern is proven. If the app is not installed, ignore the provider. This handles the case where an app was removed but left files behind.
3. For each feed in the manifest, read the feed file. If missing or unparseable, treat that feed as `status: error` and move on.
4. Render whatever remains.

This loop means a new provider needs zero changes in Command Center. Drop a manifest and a feed in the container, install the app, and it appears.

## Change detection

The extension handler reads feeds on demand when the dashboard asks. The dashboard also polls on an interval, default 60 seconds, and refreshes when the tab becomes visible. That is enough for a new tab page, which is short-lived by nature.

If lower latency is ever needed, providers may post a Darwin notification named `group.com.strategicnerds.suite.feeds-changed` after writing. The dashboard does not depend on it for the MVP.

## Versioning rules

- Adding a new feed `kind` is backward compatible. Old dashboards ignore unknown kinds.
- Adding an optional field to an existing kind is backward compatible.
- Removing or renaming a field, or changing its meaning, requires bumping `schemaVersion`. The dashboard refuses to render a feed whose `schemaVersion` it does not understand and shows "update Command Center to see this".
- The dashboard must tolerate missing optional fields everywhere. Never assume a field is present unless this spec marks it required.

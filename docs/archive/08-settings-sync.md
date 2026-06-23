# Settings and sync

## Two stores, one writer

Settings live in two places, and the Command Center app is the only writer to both.

1. iCloud key-value store, `NSUbiquitousKeyValueStore`. The source of truth. Syncs across the user's Macs automatically. Limited to 1 MB and 1024 keys, which is ample for preferences.
2. `CommandCenter/settings.json` in the App Group container. A local mirror the extension and dashboard can read without entitlement to iCloud. The app writes this mirror whenever iCloud settings change.

The dashboard and the extension handler read settings. They never write them. When the user changes something in the dashboard, the change is sent to the app, which writes iCloud and re-mirrors the JSON. One writer means no merge conflicts.

Both Linear Bar and Meeting Notifier already use this iCloud key-value pattern, so the approach is proven in the suite.

## What syncs and what does not

| Data | Syncs via iCloud | Why |
| --- | --- | --- |
| Theme, accent, background, density, font scale | Yes | Same look on every Mac |
| World clock cities | Yes | Same cities everywhere |
| Weather location and units | Yes | Same place everywhere |
| Card order and visibility | Yes | Same layout everywhere |
| Per-platform browser routing | Yes | Preference, not a secret |
| User name and greeting | Yes | Cosmetic |
| OAuth tokens of any provider | No | Tokens stay device-local, owned by the satellite app |
| Provider feeds | No | Regenerated per device by the owning app |

Tokens never go to iCloud key-value store. Each Mac authorizes its own providers. This matches Meeting Notifier's existing stance, where API keys may sync through iCloud Keychain but OAuth tokens are kept per device.

## Settings schema

`CommandCenter/settings.json`, mirrored from iCloud:

```json
{
  "schemaVersion": 1,
  "profile": { "name": "Prashant" },
  "appearance": {
    "theme": "system",
    "accentColorHex": "#5E6AD2",
    "background": { "mode": "gradient", "imageOfDay": false },
    "density": "comfortable",
    "fontScale": 1.0
  },
  "layout": {
    "cardOrder": ["schedule", "worldclock", "linear.inbox", "reminders"],
    "hidden": []
  },
  "worldClock": {
    "cities": [
      { "label": "San Francisco", "timeZone": "America/Los_Angeles" },
      { "label": "London", "timeZone": "Europe/London" },
      { "label": "Bengaluru", "timeZone": "Asia/Kolkata" }
    ]
  },
  "weather": {
    "location": { "label": "San Francisco", "lat": 37.7749, "lon": -122.4194 },
    "units": "fahrenheit"
  },
  "browserRouting": {
    "meet": "com.google.Chrome",
    "zoom": "system",
    "teams": "com.apple.Safari",
    "other": "system"
  }
}
```

`browserRouting` values are browser bundle ids, or `system` for the default browser. The settings UI offers only installed browsers, filtered with `NSWorkspace`, reusing Meeting Notifier's `MeetAppType` list.

## iCloud key mapping

The app flattens the JSON into key-value entries, one key per top-level section, stored as JSON strings. Keep keys stable:

```text
cc.profile
cc.appearance
cc.layout
cc.worldClock
cc.weather
cc.browserRouting
cc.schemaVersion
```

On `NSUbiquitousKeyValueStoreDidChangeExternallyNotification`, the app re-reads changed keys, rebuilds `settings.json`, and posts a Darwin notification so an open dashboard can refresh its theme without a reload.

## Settings UI

The settings window lives in the Command Center app, not the dashboard, so it can write iCloud and pick browsers with native pickers. The dashboard may offer quick toggles, for example reorder cards or add a city, that it sends to the app to persist. Anything that touches a browser bundle id or iCloud goes through the app.

## Migration

`schemaVersion` guards the settings shape. If a newer app writes a higher version than an older dashboard understands, the dashboard reads what it can and ignores unknown keys. Removing or repurposing a key bumps the version and the app migrates old keys forward on first launch.

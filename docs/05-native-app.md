# Command Center macOS app

The native app does four jobs:

1. Hosts the Safari extension. The extension target lives inside this app.
2. Owns settings. It writes `CommandCenter/settings.json` and syncs settings to iCloud.
3. Opens meeting links in the browser the user chose, through a registered URL scheme.
4. Optionally acts as the Apple calendar and reminders provider through EventKit.

It is a menu bar app with a settings window, in the same family as Linear Bar and Meeting Notifier. It can be built with XcodeGen and a `project.yml`, matching the existing apps, and shipped Developer ID with Sparkle.

## Targets

- `CommandCenter` app target. Menu bar app, settings UI, link opener, EventKit provider.
- `CommandCenterExtension` Safari Web Extension target. Contains the dashboard web assets and the `SafariWebExtensionHandler`.

## Entitlements

App target `CommandCenter.entitlements`:

```xml
<key>com.apple.security.application-groups</key>
<array><string>group.com.strategicnerds.suite</string></array>
<key>com.apple.developer.ubiquity-kvstore-identifier</key>
<string>$(TeamIdentifierPrefix)com.strategicnerds.commandcenter</string>
```

If the app publishes Apple calendars and reminders, add the usage descriptions to `Info.plist`:

```xml
<key>NSCalendarsUsageDescription</key>
<string>Command Center shows your events on the new tab page.</string>
<key>NSRemindersUsageDescription</key>
<string>Command Center shows your reminders on the new tab page.</string>
```

Extension target `CommandCenterExtension.entitlements` needs the same App Group so the handler can read feeds:

```xml
<key>com.apple.security.application-groups</key>
<array><string>group.com.strategicnerds.suite</string></array>
```

## Reading the container

A single `FeedStore` type owns all container access.

```swift
final class FeedStore {
    static let groupId = "group.com.strategicnerds.suite"

    private var containerURL: URL? {
        FileManager.default.containerURL(forSecurityApplicationGroupIdentifier: Self.groupId)
    }

    func discoverProviders() -> [Provider] {
        // 1. List Providers/*/manifest.json
        // 2. Decode each manifest
        // 3. Keep only providers whose bundleId resolves via NSWorkspace
        // 4. Attach decoded feeds, marking unreadable feeds as .error
    }
}

func isInstalled(_ bundleId: String) -> Bool {
    NSWorkspace.shared.urlForApplication(withBundleIdentifier: bundleId) != nil
}
```

`FeedStore` is used by both the app and the extension handler, so it lives in a small shared Swift package or a shared file added to both targets.

## The extension bridge

The Safari extension cannot read the file system from its JavaScript. It talks to the `SafariWebExtensionHandler`, which runs in the extension's native process and can read the App Group.

The dashboard calls:

```js
const response = await browser.runtime.sendNativeMessage("application.id", {
  type: "getDashboard"
});
```

The handler composes a single payload so the dashboard makes one round trip:

```swift
class SafariWebExtensionHandler: NSObject, NSExtensionRequestHandling {
    func beginRequest(with context: NSExtensionContext) {
        let message = /* read input */
        switch message["type"] {
        case "getDashboard":
            let payload = DashboardComposer().compose()   // providers + settings
            respond(context, payload)
        case "getSettings":
            respond(context, SettingsStore.shared.currentJSON())
        default:
            respond(context, ["error": "unknown type"])
        }
    }
}
```

`DashboardComposer` calls `FeedStore.discoverProviders()`, reads `CommandCenter/settings.json`, and returns:

```json
{
  "settings": { },
  "providers": [
    { "manifest": { }, "feeds": [ { } ] }
  ],
  "generatedAt": "2026-06-14T15:05:00Z"
}
```

The dashboard renders entirely from this payload. It never reaches into the file system and never holds a token.

## The action path: opening links

The dashboard never opens browsers itself. Join buttons and provider actions navigate to a `commandcenter://` URL, which macOS routes to this app.

Register the scheme in `Info.plist`:

```xml
<key>CFBundleURLTypes</key>
<array><dict>
  <key>CFBundleURLSchemes</key>
  <array><string>commandcenter</string></array>
</dict></array>
```

Handle it in the app:

```swift
func application(_ app: NSApplication, open urls: [URL]) {
    for url in urls where url.scheme == "commandcenter" {
        Router.handle(url)   // join, openProvider, openSettings
    }
}
```

Supported actions:

- `commandcenter://join?url=<encoded>&platform=meet` opens the meeting link in the browser chosen for that platform.
- `commandcenter://openProvider?providerId=linear-bar&url=<encoded>` launches the provider app or opens its URL template.
- `commandcenter://settings` opens the settings window.

Browser routing reuses Meeting Notifier's approach exactly. A platform-to-browser map lives in settings, and the app opens the URL with `NSWorkspace.shared.open(_:withApplicationAt:)` for the chosen browser bundle id, falling back to the system default.

```text
Default routing, user-editable in settings:
  Google Meet -> Chrome
  Zoom        -> System default
  Teams       -> Safari
  Other       -> System default
```

The browser picker should reuse the same `MeetAppType` list Meeting Notifier already has, filtered to installed browsers with `NSWorkspace`.

## Apple calendar and reminders provider

If enabled, the app reads Apple calendars and reminders with EventKit and writes them as `calendar.today` and `reminders.today` feeds under provider id `command-center-apple`. This makes Apple events appear through the same contract as Google and Microsoft, so the dashboard has one rendering path. Refresh on a timer and on `EKEventStoreChanged` notifications, and write atomically.

## Settings ownership

The app is the only writer of `CommandCenter/settings.json` and the only writer to iCloud key-value store. The extension and dashboard read settings, they do not write them. When the user changes a setting in the dashboard, the dashboard sends a `commandcenter://settings` deep link or a native message that the app turns into a settings write. Keeping one writer avoids conflicts. Details in [08-settings-sync.md](08-settings-sync.md).

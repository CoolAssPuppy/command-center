# Satellite integration

This is the work required inside the existing apps so they "slot in". It is small and additive. Neither app changes how it authorizes or fetches. Each gains an App Group entitlement and a publish step that writes the data it already has.

## Shared work for any satellite

1. Add the App Group entitlement.

   ```xml
   <key>com.apple.security.application-groups</key>
   <array><string>group.com.strategicnerds.suite</string></array>
   ```

   For XcodeGen apps, add it to the target's entitlements file referenced in `project.yml`. This requires a provisioning profile that includes the App Group, which is a one-time Developer portal step.

2. Add a tiny `FeedPublisher` that writes the manifest once and a feed on each refresh. It uses the shared container path and atomic writes.

   ```swift
   struct FeedPublisher {
       static let groupId = "group.com.strategicnerds.suite"
       let providerId: String

       private var providerDir: URL? {
           FileManager.default
               .containerURL(forSecurityApplicationGroupIdentifier: Self.groupId)?
               .appendingPathComponent("Providers/\(providerId)", isDirectory: true)
       }

       func writeManifest(_ manifest: Manifest) throws { /* atomic write manifest.json */ }
       func writeFeed(_ envelope: FeedEnvelope, to relativePath: String) throws { /* atomic */ }
   }
   ```

3. Call `writeManifest` at launch and `writeFeed` at the end of every successful data refresh, and also on auth state changes so `status` reflects reality. Writing a feed is cheap, so reuse the app's existing refresh timer.

4. Set `status` honestly. On a refresh failure that still has cached data, write `stale`. When the account needs re-auth, write `needs_auth`. When the user disables the integration, write `disabled`.

## Linear Bar

Provider id: `linear-bar`. Feed kind: `linear.inbox`.

Linear Bar already builds `LinearNotification` rows with `reasonPhrase`, `isUrgent`, actor, and target. The publish step maps those into the feed item shape from [04-feed-schemas.md](04-feed-schemas.md).

Where to hook: `UnreadInboxStore` and the notifications API path already produce the inbox. After it refreshes the unread set, call the publisher.

Mapping:

| Feed field | Source in Linear Bar |
| --- | --- |
| `id` | `LinearNotification.id` |
| `reason` | `reasonPhrase` |
| `urgent` | `isUrgent` |
| `createdAt` | `createdAt` |
| `read` | `readAt != nil` |
| `actorName` | `actor.label` |
| `actorAvatarUrl` | `actor.avatarUrl` |
| `targetType` | which target is non-nil |
| `targetTitle` | target `title` |
| `targetIdentifier` | issue `identifier` when present |
| `url` | `targetURL` |

Manifest action so rows open in Linear Bar:

```json
{ "id": "open", "title": "Open in Linear", "urlTemplate": "linearbar://open?url={url}" }
```

If Linear Bar does not already register a `linearbar://` scheme, add one that opens the given Linear URL. Otherwise the dashboard falls back to opening `url` through the system browser.

Tokens stay exactly where they are. Linear Bar keeps using its Keychain and its Cloudflare token-exchange worker. None of that is shared.

## Meeting Notifier

Provider id: `meeting-notifier`. Feed kinds: `calendar.today`, and optionally `reminders.today` if it grows reminders later.

Meeting Notifier already builds `CalendarEvent` with detected `conferenceLink`, `videoPlatform`, attendees, calendar color, and account email. The publish step is close to a direct serialization.

Where to hook: after the calendar managers refresh today's events, call the publisher with the merged, sorted list filtered to today.

Mapping:

| Feed field | Source in Meeting Notifier |
| --- | --- |
| `id` | `CalendarEvent.id` |
| `title` | `title` |
| `start` / `end` | `startDate` / `endDate` |
| `allDay` | derive, or add a flag |
| `location` | `location` |
| `calendarName` | `calendarName` |
| `calendarColorHex` | `calendarColorHex` |
| `accountEmail` | `accountEmail` |
| `attendeeCount` | `attendeeCount` |
| `attendeeNames` | `attendeeNames` |
| `meeting.url` | `conferenceLink` |
| `meeting.platform` | `videoPlatform` rawValue, or `other` |

Meeting Notifier already owns the browser routing logic and the `MeetAppType` list. There are two clean options for Join behavior:

- Option 1, recommended for consistency: the dashboard routes Join through Command Center's `commandcenter://join` so all link opening goes through one place and one settings panel.
- Option 2: add a `meetingnotifier://join?url=...` action and let Meeting Notifier open the link with its existing routing. This reuses code already shipped but splits routing settings across two apps.

Pick Option 1 unless you want Meeting Notifier to remain fully self-contained. Either way, the detection work is reused, not rebuilt.

## Apple calendar and reminders

The Command Center app itself can be a provider, id `command-center-apple`, publishing `calendar.today` and `reminders.today` from EventKit. This is described in [05-native-app.md](05-native-app.md). It uses the same `FeedPublisher`, so Apple events render through the identical path.

## Testing a provider in isolation

Because discovery is file-based, you can develop the dashboard against a provider with no app at all. Hand-write a `manifest.json` and a feed file into the container under a test provider id whose `bundleId` points at any installed app, and the dashboard will render it. Remove the files to simulate the provider being absent. This makes the contract testable without building all three apps at once.

# Architecture

## Components

```text
+-------------------------------------------------------------+
|  Safari                                                     |
|                                                             |
|   New tab  ->  chrome_url_overrides: newtab                 |
|                  |                                          |
|                  v                                          |
|        +---------------------------+                        |
|        |  Dashboard (static web)   |  HTML, CSS, JS         |
|        |  schedule, timezones,     |                        |
|        |  weather, provider cards  |                        |
|        +-------------+-------------+                        |
|                      | browser.runtime.sendNativeMessage    |
|                      v                                       |
|        +---------------------------+                        |
|        |  Extension handler        |  SafariWebExtension-   |
|        |  (reads App Group)        |  Handler, Swift        |
|        +-------------+-------------+                        |
+----------------------|--------------------------------------+
                       | reads
                       v
        +-------------------------------------+
        |  App Group container                |
        |  group.com.strategicnerds.suite     |
        |                                     |
        |  Providers/                         |
        |    linear-bar/manifest.json + feeds |
        |    meeting-notifier/...             |
        |  CommandCenter/settings.json        |
        +----+-------------------------+------+
             ^ writes feeds            ^ writes settings
             |                         |
   +---------+--------+      +---------+-----------+
   | Satellite apps   |      | Command Center app  |
   | Linear Bar       |      | settings UI         |
   | Meeting Notifier |      | link opener         |
   | own OAuth tokens |      | commandcenter:// URL |
   +------------------+      +---------------------+
                                       ^
                                       | commandcenter://join?...
                                       | (Join button navigation)
                                       |
                              Dashboard action links
```

## The two data paths

Command Center has a read path and an action path. Keeping them separate is what makes the security model simple.

### Read path: feeds in, never tokens

Satellite apps write JSON feeds into the App Group container on their own schedule. The Safari extension handler reads those files and returns a composed payload to the dashboard. The dashboard renders cards.

No tokens move. The satellite app already fetched the data using its own credentials and wrote the result. Command Center reads a finished result, the same way it would read a cached file.

### Action path: links out through the main app

When the user clicks Join on an event, the dashboard navigates to a `commandcenter://join?...` URL. macOS routes that to the Command Center app, which opens the meeting link in the browser the user chose. The Safari extension handler is sandboxed and cannot launch other browsers, so link opening lives in the main app, which is exactly where Meeting Notifier already does it today.

## Why the provider-feed model, not shared tokens

There were two ways to make installed apps "slot in".

Option A, shared Keychain. All apps adopt one shared Keychain access group. Command Center reads the raw tokens and calls Linear, Google, and Microsoft itself.

Option B, provider feed. Each app keeps its tokens and publishes finished data into a shared container. Command Center only reads the data.

We chose Option B. Reasons:

1. No secret sprawl. Command Center would otherwise need every provider's client secret, refresh logic, and in Linear Bar's case its token-exchange proxy. With feeds, none of that leaves the owning app.
2. No refresh races. If two processes hold the same refresh token and both try to refresh, one invalidates the other. With a single owner per provider, refresh is owned in one place.
3. Clean failure. A satellite app can mark its feed `needs_auth` or `error`, and the dashboard shows a precise state instead of guessing.
4. Easy to extend. A future app becomes a provider by writing a manifest and a feed. No change to Command Center.

The cost is that each satellite app ships a small update to publish its feed. That work is described in [09-satellite-integration.md](09-satellite-integration.md).

## What Command Center fetches itself

Two widgets need no provider and no native permission, so the dashboard fetches them directly in JavaScript:

- Time zones. Pure computation with `Intl.DateTimeFormat` plus a bundled city table.
- Weather. A request to Open-Meteo by latitude and longitude for the city the user picked. No API key. No geolocation prompt.

Calendar and reminders that come from Apple, rather than from Google or Microsoft, are read by the Command Center app through EventKit and published as a feed using the same contract, so the dashboard treats Apple and third-party calendars identically.

## Process and trust boundaries

| Boundary | Who is on each side | What crosses |
| --- | --- | --- |
| Dashboard to extension handler | Web page, native handler | A request name and a JSON payload of finished data |
| Extension handler to container | Native handler, disk | File reads only |
| Satellite app to container | Native app, disk | File writes of its own feeds |
| Dashboard to main app | Web page, native app | A `commandcenter://` action URL, no data |
| Main app to iCloud | Native app, Apple | Settings and look-and-feel only |

No boundary carries an OAuth token. That is the property we are protecting.

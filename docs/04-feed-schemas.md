# Feed schemas

Every feed uses the envelope from [03-provider-contract.md](03-provider-contract.md). This file defines the `data` shape for each `kind`. All times are ISO 8601 with an explicit offset or trailing `Z`. All fields are optional unless marked required.

The schemas below are grounded in the real models these apps already have. Calendar fields mirror Meeting Notifier's `CalendarEvent`. Inbox fields mirror Linear Bar's `LinearNotification`.

Every example here carries the envelope's required `glance` line, defined in [03-provider-contract.md](03-provider-contract.md). It is shown once below and omitted from later examples for brevity, but it is required on all of them. These convenience kinds are mapped by the platform to default cards and widgets from [13-representation-model.md](13-representation-model.md). A provider that wants to choose its own representation, a chart or a table, publishes widgets directly instead of a convenience kind.

## kind: calendar.today

Today's events from one calendar source. A provider may publish events from several accounts in one feed.

```json
{
  "schemaVersion": 1,
  "kind": "calendar.today",
  "status": "ok",
  "updatedAt": "2026-06-14T15:04:05Z",
  "ttlSeconds": 120,
  "glance": { "value": "9:30", "label": "Design review", "tone": "neutral" },
  "data": {
    "day": "2026-06-14",
    "timeZone": "America/Los_Angeles",
    "events": [
      {
        "id": "abc123",
        "title": "Design review",
        "start": "2026-06-14T16:00:00-07:00",
        "end": "2026-06-14T16:30:00-07:00",
        "allDay": false,
        "location": "1 Market St, San Francisco",
        "calendarName": "Work",
        "calendarColorHex": "#4285F4",
        "accountEmail": "you@example.com",
        "attendeeCount": 4,
        "attendeeNames": ["Ada", "Grace", "Alan"],
        "meeting": {
          "url": "https://meet.google.com/abc-defg-hij",
          "platform": "meet"
        }
      }
    ]
  }
}
```

Required per event: `id`, `title`, `start`, `end`.

`meeting.platform` is one of `meet`, `zoom`, `teams`, `webex`, or `other`. The provider detects it; the dashboard does not re-parse the URL. Detection should scan the event URL field, location, notes or description, and any conferencing metadata, which is what Meeting Notifier already does.

If an event has no detected link, omit the `meeting` object. The dashboard shows no Join button for it.

## kind: reminders.today

Today's reminders and optionally overdue items.

```json
{
  "schemaVersion": 1,
  "kind": "reminders.today",
  "status": "ok",
  "updatedAt": "2026-06-14T15:04:05Z",
  "ttlSeconds": 300,
  "data": {
    "items": [
      {
        "id": "rem-1",
        "title": "Send the offsite agenda",
        "due": "2026-06-14T17:00:00-07:00",
        "overdue": false,
        "listName": "Work",
        "priority": "high",
        "completed": false
      }
    ]
  }
}
```

Required per item: `id`, `title`. `priority` is one of `none`, `low`, `medium`, `high`.

## kind: linear.inbox

The user's Linear inbox. Fields mirror Linear Bar's notification model, flattened for display.

```json
{
  "schemaVersion": 1,
  "kind": "linear.inbox",
  "status": "ok",
  "updatedAt": "2026-06-14T15:04:05Z",
  "ttlSeconds": 120,
  "data": {
    "unreadCount": 3,
    "items": [
      {
        "id": "ntf-1",
        "reason": "assigned to you",
        "urgent": false,
        "createdAt": "2026-06-14T14:50:00Z",
        "read": false,
        "actorName": "Grace Hopper",
        "actorAvatarUrl": "https://...",
        "targetType": "issue",
        "targetTitle": "Crash on cold start",
        "targetIdentifier": "ENG-412",
        "url": "https://linear.app/acme/issue/ENG-412"
      }
    ]
  }
}
```

Required per item: `id`, `reason`, `url`. `targetType` is one of `issue`, `project`, `document`. `reason` is the human phrase the provider already computes, for example "mentioned you" or "SLA breached on".

The dashboard opens `url` through the provider's `open` action from the manifest, so the click lands in the Linear Bar app rather than a browser tab.

## kind: docs.recent

Recently updated documents, for a future Notion provider or any document source.

```json
{
  "schemaVersion": 1,
  "kind": "docs.recent",
  "status": "ok",
  "updatedAt": "2026-06-14T15:04:05Z",
  "ttlSeconds": 600,
  "data": {
    "items": [
      {
        "id": "doc-1",
        "title": "Q3 planning",
        "editedAt": "2026-06-14T13:00:00Z",
        "workspaceName": "Acme",
        "iconEmoji": "📄",
        "url": "https://notion.so/..."
      }
    ]
  }
}
```

Required per item: `id`, `title`, `url`.

## Widgets Command Center owns directly

These are not provider feeds. The dashboard computes or fetches them. They are documented here so the data shapes are consistent with feeds and easy to cache in `CommandCenter/settings.json`.

### Time zones

Driven entirely by settings. The user's chosen cities live in settings as a list of IANA time zone ids plus labels. The dashboard computes current time, date offset, and day or night state with `Intl.DateTimeFormat`.

```json
{
  "cities": [
    { "label": "San Francisco", "timeZone": "America/Los_Angeles" },
    { "label": "London", "timeZone": "Europe/London" },
    { "label": "Bengaluru", "timeZone": "Asia/Kolkata" }
  ]
}
```

Day or night is computed from local hour bands, refined later with sunrise and sunset from the weather source if desired.

### Weather

Fetched client-side from Open-Meteo by latitude and longitude. The chosen location lives in settings. No API key, no geolocation prompt.

```json
{
  "location": { "label": "San Francisco", "lat": 37.7749, "lon": -122.4194 },
  "units": "fahrenheit"
}
```

The dashboard requests current conditions and a short daily forecast and renders temperature, condition, and a sunrise and sunset pair that can feed the day or night indicator for the matching city.

## Empty and error rendering

For every kind, the dashboard must handle three cases without layout jumps:

1. Provider present, `status: ok`, zero items. Show a calm empty state, for example "No events today".
2. Provider present, `status: needs_auth`. Show a reconnect prompt that runs the provider's action or launches its app.
3. Provider absent. Hide the card entirely. Do not show a placeholder.

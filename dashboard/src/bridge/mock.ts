import type { DashboardPayload } from "../dashboard/payload";
import type { DashboardBridge } from "./types";

/**
 * A realistic dashboard fixture for local dev and the demo. It exercises the
 * variety the renderer must handle: list cards (calendar, inbox), a generic
 * card with a chart, an urgent glance, a needs_auth provider, and join/open
 * actions. No secrets, no tokens: this is display data only.
 */

const UPDATED = "2026-06-14T15:04:00Z";

export function mockDashboardPayload(): DashboardPayload {
  return {
    generatedAt: "2026-06-14T15:05:00Z",
    settings: {
      schemaVersion: 1,
      profile: { name: "Prashant" },
      layout: {
        cardOrder: ["calendar.today", "reminders.today", "docs.recent", "linear.inbox"],
      },
      worldClock: {
        baseTimeZone: "America/Los_Angeles",
        cities: [
          { label: "San Francisco", timeZone: "America/Los_Angeles" },
          { label: "London", timeZone: "Europe/London" },
          { label: "Bengaluru", timeZone: "Asia/Kolkata" },
        ],
      },
      weather: {
        location: { label: "San Francisco", lat: 37.7749, lon: -122.4194 },
        units: "fahrenheit",
      },
    },
    providers: [
      {
        manifest: {
          schemaVersion: 1,
          providerId: "meeting-notifier",
          displayName: "Calendar",
          bundleId: "com.strategicnerds.meetingnotifier",
          icon: "calendar",
          accentColorHex: "#34C759",
          feeds: [{ kind: "calendar.today", path: "calendar/today.json" }],
          actions: [{ id: "join", route: "commandcenter://join" }],
        },
        feeds: [
          {
            schemaVersion: 1,
            providerId: "meeting-notifier",
            kind: "calendar.today",
            updatedAt: UPDATED,
            ttlSeconds: 120,
            status: "ok",
            glance: { value: "9:30", label: "Design review", tone: "neutral" },
            data: {
              day: "2026-06-14",
              timeZone: "America/Los_Angeles",
              events: [
                {
                  id: "e1",
                  title: "Design review",
                  start: "2026-06-14T09:30:00-07:00",
                  end: "2026-06-14T10:00:00-07:00",
                  location: "1 Market St",
                  calendarName: "Work",
                  calendarColorHex: "#4285F4",
                  meeting: { url: "https://meet.google.com/abc-defg-hij", platform: "meet" },
                },
                {
                  id: "e2",
                  title: "1:1 with Grace",
                  start: "2026-06-14T11:00:00-07:00",
                  end: "2026-06-14T11:30:00-07:00",
                  calendarColorHex: "#4285F4",
                  meeting: { url: "https://zoom.us/j/123456", platform: "zoom" },
                },
              ],
            },
          },
        ],
      },
      {
        manifest: {
          schemaVersion: 1,
          providerId: "linear-bar",
          displayName: "Linear",
          bundleId: "com.strategicnerds.LinearBarApp",
          icon: "linear",
          accentColorHex: "#5E6AD2",
          feeds: [{ kind: "linear.inbox", path: "linear/inbox.json" }],
          actions: [{ id: "open", urlTemplate: "linearbar://open?url={url}" }],
        },
        feeds: [
          {
            schemaVersion: 1,
            providerId: "linear-bar",
            kind: "linear.inbox",
            updatedAt: UPDATED,
            ttlSeconds: 120,
            status: "ok",
            glance: { value: "3", label: "unread", tone: "urgent", trend: "up" },
            data: {
              unreadCount: 3,
              items: [
                {
                  id: "n1",
                  reason: "assigned to you",
                  actorName: "Grace Hopper",
                  targetType: "issue",
                  targetTitle: "Crash on cold start",
                  targetIdentifier: "ENG-412",
                  url: "https://linear.app/acme/issue/ENG-412",
                },
                {
                  id: "n2",
                  reason: "SLA at risk on",
                  urgent: true,
                  actorName: "System",
                  targetType: "issue",
                  targetTitle: "Checkout latency",
                  targetIdentifier: "ENG-388",
                  url: "https://linear.app/acme/issue/ENG-388",
                },
              ],
            },
          },
        ],
      },
      {
        manifest: {
          schemaVersion: 1,
          providerId: "apple-reminders",
          displayName: "Reminders",
          bundleId: "com.apple.reminders",
          icon: "checklist",
          accentColorHex: "#FF9F0A",
          feeds: [{ kind: "reminders.today", path: "reminders/today.json" }],
          actions: [],
        },
        feeds: [
          {
            schemaVersion: 1,
            providerId: "apple-reminders",
            kind: "reminders.today",
            updatedAt: UPDATED,
            ttlSeconds: 300,
            status: "ok",
            glance: { value: "4", label: "due today", tone: "neutral" },
            data: {
              items: [
                {
                  id: "r1",
                  title: "Review Q3 board deck",
                  listName: "Work",
                  due: "2026-06-14T17:00:00-07:00",
                },
                { id: "r2", title: "Reply to investor email", listName: "Work", overdue: true },
                {
                  id: "r3",
                  title: "Book flights to Lisbon",
                  listName: "Personal",
                  due: "2026-06-14T20:00:00-07:00",
                },
                { id: "r4", title: "Renew domain", listName: "Personal", overdue: true },
              ],
            },
          },
        ],
      },
      {
        manifest: {
          schemaVersion: 1,
          providerId: "notion",
          displayName: "Notion",
          bundleId: "com.acme.notion",
          icon: "doc",
          feeds: [{ kind: "docs.recent" }],
          actions: [{ id: "open", route: "commandcenter://open" }],
        },
        feeds: [
          {
            schemaVersion: 1,
            providerId: "notion",
            kind: "docs.recent",
            updatedAt: UPDATED,
            ttlSeconds: 300,
            status: "ok",
            glance: { value: "5", label: "recent", tone: "neutral" },
            data: {
              items: [
                {
                  id: "d1",
                  title: "Q3 board deck",
                  workspaceName: "Strategic Nerds",
                  iconEmoji: "📊",
                  editedAt: "2026-06-14T14:10:00-07:00",
                  url: "https://notion.so/q3-board-deck",
                },
                {
                  id: "d2",
                  title: "Command Center spec",
                  workspaceName: "Strategic Nerds",
                  iconEmoji: "🛰️",
                  editedAt: "2026-06-14T11:42:00-07:00",
                  url: "https://notion.so/command-center-spec",
                },
                {
                  id: "d3",
                  title: "Hiring: staff engineer",
                  workspaceName: "Strategic Nerds",
                  iconEmoji: "🧑‍💻",
                  editedAt: "2026-06-13T18:05:00-07:00",
                  url: "https://notion.so/hiring-staff-engineer",
                },
                {
                  id: "d4",
                  title: "Lisbon offsite plan",
                  workspaceName: "Strategic Nerds",
                  iconEmoji: "🌅",
                  editedAt: "2026-06-13T09:20:00-07:00",
                  url: "https://notion.so/lisbon-offsite",
                },
              ],
            },
          },
        ],
      },
    ],
  };
}

export function createMockBridge(
  payload: unknown = mockDashboardPayload(),
): DashboardBridge {
  return {
    getDashboard: () => Promise.resolve(payload),
  };
}

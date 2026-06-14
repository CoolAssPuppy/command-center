import type {
  CalendarToday,
  CalendarEvent,
  DocsRecent,
  LinearInbox,
  RemindersToday,
} from "../domain/kinds";

/**
 * Factory functions for convenience-kind feed data. Each returns a complete,
 * valid object and accepts a partial override.
 */

export function makeCalendarEvent(
  overrides: Partial<CalendarEvent> = {},
): CalendarEvent {
  return {
    id: "evt-1",
    title: "Design review",
    start: "2026-06-14T16:00:00-07:00",
    end: "2026-06-14T16:30:00-07:00",
    location: "1 Market St, San Francisco",
    calendarName: "Work",
    calendarColorHex: "#4285F4",
    accountEmail: "you@example.com",
    attendeeCount: 4,
    attendeeNames: ["Ada", "Grace"],
    meeting: { url: "https://meet.google.com/abc-defg-hij", platform: "meet" },
    ...overrides,
  };
}

export function makeCalendarToday(
  overrides: Partial<CalendarToday> = {},
): CalendarToday {
  return {
    day: "2026-06-14",
    timeZone: "America/Los_Angeles",
    events: [makeCalendarEvent()],
    ...overrides,
  };
}

export function makeRemindersToday(
  overrides: Partial<RemindersToday> = {},
): RemindersToday {
  return {
    items: [
      {
        id: "rem-1",
        title: "Send the offsite agenda",
        due: "2026-06-14T17:00:00-07:00",
        overdue: false,
        listName: "Work",
        priority: "high",
        completed: false,
      },
    ],
    ...overrides,
  };
}

export function makeLinearInbox(overrides: Partial<LinearInbox> = {}): LinearInbox {
  return {
    unreadCount: 3,
    items: [
      {
        id: "ntf-1",
        reason: "assigned to you",
        urgent: false,
        createdAt: "2026-06-14T14:50:00Z",
        read: false,
        actorName: "Grace Hopper",
        actorAvatarUrl: "https://example.com/grace.png",
        targetType: "issue",
        targetTitle: "Crash on cold start",
        targetIdentifier: "ENG-412",
        url: "https://linear.app/acme/issue/ENG-412",
      },
    ],
    ...overrides,
  };
}

export function makeDocsRecent(overrides: Partial<DocsRecent> = {}): DocsRecent {
  return {
    items: [
      {
        id: "doc-1",
        title: "Q3 planning",
        editedAt: "2026-06-14T13:00:00Z",
        workspaceName: "Acme",
        iconEmoji: "📄",
        url: "https://notion.so/q3",
      },
    ],
    ...overrides,
  };
}

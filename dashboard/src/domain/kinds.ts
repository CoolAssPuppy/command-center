import { z } from "zod";

import { IsoInstantSchema } from "./primitives";
import { CardSchema, type Card, type ListItem, type Widget } from "./widgets";
import { firstIssue, type FeedEnvelope, type ParseResult } from "./feed";

/**
 * Convenience kinds are a layer over the representation model. A provider that
 * just has events publishes `calendar.today` and lets the platform choose a
 * default representation. See docs/04-feed-schemas.md and
 * docs/13-representation-model.md. Each kind has a data schema and a mapper to a
 * Card. A provider that wants full control publishes a `card` feed instead.
 */

// data schemas -------------------------------------------------------------

const MeetingSchema = z.object({
  url: z.string().min(1),
  platform: z.enum(["meet", "zoom", "teams", "webex", "other"]),
});

const CalendarEventSchema = z.object({
  id: z.string().min(1),
  title: z.string(),
  start: IsoInstantSchema,
  end: IsoInstantSchema,
  allDay: z.boolean().optional(),
  location: z.string().optional(),
  calendarName: z.string().optional(),
  calendarColorHex: z.string().optional(),
  accountEmail: z.string().optional(),
  attendeeCount: z.number().int().nonnegative().optional(),
  attendeeNames: z.array(z.string()).optional(),
  meeting: MeetingSchema.optional(),
});
export type CalendarEvent = z.infer<typeof CalendarEventSchema>;

export const CalendarTodaySchema = z.object({
  day: z.string().optional(),
  timeZone: z.string().optional(),
  events: z.array(CalendarEventSchema),
});
export type CalendarToday = z.infer<typeof CalendarTodaySchema>;

const ReminderSchema = z.object({
  id: z.string().min(1),
  title: z.string(),
  due: IsoInstantSchema.optional(),
  overdue: z.boolean().optional(),
  listName: z.string().optional(),
  priority: z.enum(["none", "low", "medium", "high"]).optional(),
  completed: z.boolean().optional(),
});

export const RemindersTodaySchema = z.object({
  items: z.array(ReminderSchema),
});
export type RemindersToday = z.infer<typeof RemindersTodaySchema>;

const InboxItemSchema = z.object({
  id: z.string().min(1),
  reason: z.string(),
  urgent: z.boolean().optional(),
  createdAt: IsoInstantSchema.optional(),
  read: z.boolean().optional(),
  actorName: z.string().optional(),
  actorAvatarUrl: z.string().optional(),
  targetType: z.enum(["issue", "project", "document"]).optional(),
  targetTitle: z.string().optional(),
  targetIdentifier: z.string().optional(),
  url: z.string().min(1),
});

export const LinearInboxSchema = z.object({
  unreadCount: z.number().int().nonnegative().optional(),
  items: z.array(InboxItemSchema),
});
export type LinearInbox = z.infer<typeof LinearInboxSchema>;

const DocSchema = z.object({
  id: z.string().min(1),
  title: z.string(),
  editedAt: IsoInstantSchema.optional(),
  workspaceName: z.string().optional(),
  iconEmoji: z.string().optional(),
  url: z.string().min(1),
});

export const DocsRecentSchema = z.object({
  items: z.array(DocSchema),
});
export type DocsRecent = z.infer<typeof DocsRecentSchema>;

const CardFeedSchema = z.object({ card: CardSchema });

/** The convenience kinds the platform maps to default cards. */
export const CONVENIENCE_KINDS = [
  "calendar.today",
  "reminders.today",
  "linear.inbox",
  "docs.recent",
] as const;

// item builders ------------------------------------------------------------

function eventToItem(event: CalendarEvent): ListItem {
  const item: ListItem = {
    title: event.title,
    trailing: { kind: "time", iso: event.start },
  };
  if (event.calendarColorHex) {
    item.leading = { kind: "colorDot", colorHex: event.calendarColorHex };
  }
  if (event.location) item.subtitle = event.location;
  if (event.meeting) {
    item.action = {
      ref: "join",
      params: { url: event.meeting.url, platform: event.meeting.platform },
    };
  }
  return item;
}

function reminderToItem(reminder: z.infer<typeof ReminderSchema>): ListItem {
  const item: ListItem = { title: reminder.title };
  if (reminder.listName) item.subtitle = reminder.listName;
  if (reminder.overdue) {
    item.trailing = { kind: "badge", text: "overdue", tone: "urgent" };
  } else if (reminder.due) {
    item.trailing = { kind: "time", iso: reminder.due };
  }
  return item;
}

function inboxToItem(note: z.infer<typeof InboxItemSchema>): ListItem {
  const item: ListItem = {
    title: note.targetTitle ?? note.reason,
    subtitle: note.actorName ? `${note.actorName} ${note.reason}` : note.reason,
    leading: note.actorAvatarUrl
      ? { kind: "avatar", url: note.actorAvatarUrl }
      : { kind: "icon", name: "linear" },
    action: { ref: "open", params: { url: note.url } },
  };
  if (note.urgent) {
    item.trailing = { kind: "badge", text: "urgent", tone: "urgent" };
  } else if (note.targetIdentifier) {
    item.trailing = { kind: "text", text: note.targetIdentifier };
  } else if (note.createdAt) {
    item.trailing = { kind: "time", iso: note.createdAt };
  }
  return item;
}

function docToItem(doc: z.infer<typeof DocSchema>): ListItem {
  const item: ListItem = {
    title: doc.title,
    leading: { kind: "icon", name: "doc" },
    action: { ref: "open", params: { url: doc.url } },
  };
  if (doc.workspaceName) item.subtitle = doc.workspaceName;
  if (doc.editedAt) item.trailing = { kind: "time", iso: doc.editedAt };
  return item;
}

// mapping ------------------------------------------------------------------

function listCard(
  title: string,
  icon: string,
  items: ListItem[],
  envelope: FeedEnvelope,
): Card {
  const widgets: Widget[] =
    items.length > 0 ? [{ type: "list", data: { items } }] : [];
  return { title, icon, glance: envelope.glance, widgets };
}

function mapWith<T>(
  schema: z.ZodType<T>,
  envelope: FeedEnvelope,
  build: (data: T) => Card,
): ParseResult<Card> {
  const parsed = schema.safeParse(envelope.data);
  if (!parsed.success) {
    return { ok: false, error: firstIssue(parsed.error, "invalid data") };
  }
  return { ok: true, value: build(parsed.data) };
}

/**
 * Turn a feed envelope into a renderable Card. Convenience kinds are mapped to
 * a default card. A `card` kind is validated and passed through. An unknown
 * kind returns an error so the composition layer can skip it without failing
 * the whole dashboard.
 */
export function cardFromFeed(envelope: FeedEnvelope): ParseResult<Card> {
  switch (envelope.kind) {
    case "calendar.today":
      return mapWith(CalendarTodaySchema, envelope, (data) =>
        listCard("Today", "calendar", data.events.map(eventToItem), envelope),
      );
    case "reminders.today":
      return mapWith(RemindersTodaySchema, envelope, (data) =>
        listCard("Reminders", "checklist", data.items.map(reminderToItem), envelope),
      );
    case "linear.inbox":
      return mapWith(LinearInboxSchema, envelope, (data) =>
        listCard("Inbox", "linear", data.items.map(inboxToItem), envelope),
      );
    case "docs.recent":
      return mapWith(DocsRecentSchema, envelope, (data) =>
        listCard("Recent", "doc", data.items.map(docToItem), envelope),
      );
    case "card": {
      const parsed = CardFeedSchema.safeParse(envelope.data);
      if (!parsed.success) {
        return { ok: false, error: firstIssue(parsed.error, "invalid card") };
      }
      return { ok: true, value: parsed.data.card };
    }
    default:
      return { ok: false, error: `unknown kind ${envelope.kind}` };
  }
}

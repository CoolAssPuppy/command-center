import { z } from "zod";

import type { Connection } from "../config/schema";
import { firstIssue, type ParseResult } from "../domain/result";
import { formatTaskDue } from "./task";
import {
  NEEDS_AUTH,
  type Integration,
  type IntegrationContext,
  type NormalizedItem,
} from "./types";

/**
 * The Linear integration. Uses the connection's personal API key (a secret) in
 * the Authorization header. The default "assigned" view lists open issues you
 * created or are assigned (deduped, soonest deadline first); "inbox" view reads
 * the viewer's notifications (unread and unsnoozed). Each is normalized into a
 * text-only item linking to Linear.
 */
const ENDPOINT = "https://api.linear.app/graphql";

export const ASSIGNED_QUERY = `query CommandCenterAssigned($first: Int!) {
  issues(
    first: $first
    filter: {
      completedAt: { null: true }
      or: [{ creator: { isMe: { eq: true } } }, { assignee: { isMe: { eq: true } } }]
    }
  ) {
    nodes { identifier title url priority dueDate state { name } }
  }
}`;

export const INBOX_QUERY = `query CommandCenterInbox($first: Int!) {
  notifications(first: $first) {
    nodes {
      __typename
      ... on IssueNotification {
        id
        readAt
        snoozedUntilAt
        issue { identifier title url }
      }
    }
  }
}`;

const AssignedSchema = z.object({
  data: z
    .object({
      issues: z.object({
        nodes: z.array(
          z.object({
            identifier: z.string(),
            title: z.string(),
            url: z.string().optional(),
            // Linear priority: 0 none, 1 urgent, 2 high, 3 medium, 4 low.
            priority: z.number().optional(),
            dueDate: z.string().nullable().optional(),
            state: z.object({ name: z.string() }).optional(),
          }),
        ),
      }),
    })
    .optional(),
  errors: z.array(z.object({ message: z.string() })).optional(),
});

const InboxSchema = z.object({
  data: z
    .object({
      notifications: z.object({
        nodes: z.array(
          z.object({
            id: z.string().optional(),
            readAt: z.string().nullable().optional(),
            snoozedUntilAt: z.string().nullable().optional(),
            issue: z
              .object({
                identifier: z.string(),
                title: z.string(),
                url: z.string().optional(),
              })
              .optional(),
          }),
        ),
      }),
    })
    .optional(),
  errors: z.array(z.object({ message: z.string() })).optional(),
});

/** The connection's chosen Linear view; assigned is the default. */
export function linearViewOf(connection: Connection): "assigned" | "inbox" {
  return connection.linearView === "inbox" ? "inbox" : "assigned";
}

function parseAssigned(payload: unknown): ParseResult<NormalizedItem[]> {
  const result = AssignedSchema.safeParse(payload);
  if (!result.success) {
    return { ok: false, error: firstIssue(result.error, "invalid Linear response") };
  }
  if (result.data.errors !== undefined && result.data.errors.length > 0) {
    return { ok: false, error: result.data.errors[0]?.message ?? "Linear error" };
  }
  if (result.data.data === undefined) return { ok: false, error: "Linear returned no data" };

  // Soonest deadline first; issues with no due date sort to the end.
  const nodes = [...result.data.data.issues.nodes].sort((a, b) =>
    (a.dueDate ?? "9999-99-99").localeCompare(b.dueDate ?? "9999-99-99"),
  );

  const items = nodes.map((issue) => {
    const item: NormalizedItem = { id: issue.identifier, title: issue.title };
    if (issue.url !== undefined) item.url = issue.url;
    item.meta = issue.identifier;

    // Subtitle shows the status, with the due date tucked beside it when set:
    // "Backlog" or "Backlog, Jun 26".
    const status = issue.state?.name;
    const due =
      issue.dueDate !== undefined && issue.dueDate !== null
        ? formatTaskDue(issue.dueDate)
        : undefined;
    if (status !== undefined && due !== undefined) item.subtitle = `${status}, ${due}`;
    else if (status !== undefined) item.subtitle = status;
    else if (due !== undefined) item.subtitle = due;
    if (issue.dueDate !== undefined && issue.dueDate !== null) item.sortKey = issue.dueDate;

    if (issue.priority !== undefined && issue.priority >= 1 && issue.priority <= 2) {
      item.tone = "urgent";
    }
    return item;
  });
  return { ok: true, value: items };
}

/**
 * Parse a notifications response into items: keep unread, unsnoozed issue
 * notifications, dedupe by issue (one issue can ping many times), newest first.
 */
export function parseLinearInbox(payload: unknown): ParseResult<NormalizedItem[]> {
  const result = InboxSchema.safeParse(payload);
  if (!result.success) {
    return { ok: false, error: firstIssue(result.error, "invalid Linear response") };
  }
  if (result.data.errors !== undefined && result.data.errors.length > 0) {
    return { ok: false, error: result.data.errors[0]?.message ?? "Linear error" };
  }
  if (result.data.data === undefined) return { ok: false, error: "Linear returned no data" };

  const items: NormalizedItem[] = [];
  const seen = new Set<string>();
  for (const node of result.data.data.notifications.nodes) {
    if (node.issue === undefined) continue;
    if (node.readAt !== undefined && node.readAt !== null) continue;
    if (node.snoozedUntilAt !== undefined && node.snoozedUntilAt !== null) continue;
    if (seen.has(node.issue.identifier)) continue;
    seen.add(node.issue.identifier);
    const item: NormalizedItem = { id: node.issue.identifier, title: node.issue.title };
    if (node.issue.url !== undefined) item.url = node.issue.url;
    item.meta = node.issue.identifier;
    items.push(item);
  }
  return { ok: true, value: items };
}

export const linearIntegration: Integration = {
  id: "linear",
  displayName: "Linear",

  async fetch(
    connection: Connection,
    secret: string | undefined,
    ctx: IntegrationContext,
  ): Promise<ParseResult<NormalizedItem[]>> {
    if (secret === undefined || secret.trim().length === 0) {
      return { ok: false, error: NEEDS_AUTH };
    }

    const view = linearViewOf(connection);
    let payload: unknown;
    try {
      const response = await ctx.fetch({
        url: ENDPOINT,
        method: "POST",
        headers: { Authorization: secret, "Content-Type": "application/json" },
        body: JSON.stringify({
          query: view === "inbox" ? INBOX_QUERY : ASSIGNED_QUERY,
          variables: { first: connection.count ?? 6 },
        }),
      });
      if (response.status === 401 || response.status === 400) {
        return { ok: false, error: NEEDS_AUTH };
      }
      if (!response.ok) {
        return { ok: false, error: `Linear request failed (${response.status})` };
      }
      payload = await response.json();
    } catch (cause) {
      const message = cause instanceof Error ? cause.message : "Linear request failed";
      return { ok: false, error: message };
    }

    return view === "inbox" ? parseLinearInbox(payload) : parseAssigned(payload);
  },
};

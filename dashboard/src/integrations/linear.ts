import { z } from "zod";

import type { IntegrationSource } from "../config/schema";
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
 * the Authorization header and reads one of several viewer-scoped pre-defined
 * views: open issue lists (assigned, created, in progress, due soon, recently
 * updated), the notification inbox, the viewer's projects, or initiatives. Each
 * is normalized into text-only items linking to Linear, tagged with a type icon.
 */
const ENDPOINT = "https://api.linear.app/graphql";

/** The card's chosen Linear view; assigned is the default. */
export type LinearView = NonNullable<IntegrationSource["linearView"]>;

export function linearViewOf(connection: IntegrationSource): LinearView {
  return connection.linearView ?? "assigned";
}

const ISSUE_FIELDS = "identifier title url priority dueDate updatedAt state { name }";
const CREATOR_OR_ASSIGNEE =
  "or: [{ creator: { isMe: { eq: true } } }, { assignee: { isMe: { eq: true } } }]";

export const ASSIGNED_QUERY = `query CommandCenterAssigned($first: Int!) {
  issues(first: $first, filter: { completedAt: { null: true }, ${CREATOR_OR_ASSIGNEE} }) {
    nodes { ${ISSUE_FIELDS} }
  }
}`;

export const CREATED_QUERY = `query CommandCenterCreated($first: Int!) {
  issues(first: $first, filter: { completedAt: { null: true }, creator: { isMe: { eq: true } } }) {
    nodes { ${ISSUE_FIELDS} }
  }
}`;

export const IN_PROGRESS_QUERY = `query CommandCenterInProgress($first: Int!) {
  issues(first: $first, filter: { completedAt: { null: true }, assignee: { isMe: { eq: true } }, state: { type: { eq: "started" } } }) {
    nodes { ${ISSUE_FIELDS} }
  }
}`;

export const DUE_QUERY = `query CommandCenterDue($first: Int!) {
  issues(first: $first, filter: { completedAt: { null: true }, dueDate: { null: false }, ${CREATOR_OR_ASSIGNEE} }) {
    nodes { ${ISSUE_FIELDS} }
  }
}`;

export const RECENT_QUERY = `query CommandCenterRecent($first: Int!) {
  issues(first: $first, orderBy: updatedAt, filter: { ${CREATOR_OR_ASSIGNEE} }) {
    nodes { ${ISSUE_FIELDS} }
  }
}`;

export const PROJECTS_QUERY = `query CommandCenterProjects($first: Int!) {
  projects(first: $first) {
    nodes { id name url targetDate }
  }
}`;

export const INITIATIVES_QUERY = `query CommandCenterInitiatives($first: Int!) {
  initiatives(first: $first) {
    nodes { id name url targetDate }
  }
}`;

/**
 * How many notifications to pull for the inbox. Linear returns the newest
 * notifications regardless of read state, so over-fetch and filter to unread
 * client-side rather than asking for only a handful.
 */
const INBOX_FETCH = 100;

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

const IssueNode = z.object({
  identifier: z.string(),
  title: z.string(),
  url: z.string().optional(),
  // Linear priority: 0 none, 1 urgent, 2 high, 3 medium, 4 low.
  priority: z.number().optional(),
  dueDate: z.string().nullable().optional(),
  updatedAt: z.string().nullable().optional(),
  state: z.object({ name: z.string() }).optional(),
});

const IssuesSchema = z.object({
  data: z.object({ issues: z.object({ nodes: z.array(IssueNode) }) }).optional(),
  errors: z.array(z.object({ message: z.string() })).optional(),
});

const NamedNode = z.object({
  id: z.string(),
  name: z.string(),
  url: z.string().optional(),
  targetDate: z.string().nullable().optional(),
});

const ProjectsSchema = z.object({
  data: z.object({ projects: z.object({ nodes: z.array(NamedNode) }) }).optional(),
  errors: z.array(z.object({ message: z.string() })).optional(),
});

const InitiativesSchema = z.object({
  data: z.object({ initiatives: z.object({ nodes: z.array(NamedNode) }) }).optional(),
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

/** The first GraphQL error message, if the response carries any. */
function graphqlError(errors: { message: string }[] | undefined): string | undefined {
  return errors !== undefined && errors.length > 0
    ? errors[0]?.message ?? "Linear error"
    : undefined;
}

function issueToItem(issue: z.infer<typeof IssueNode>): NormalizedItem {
  const item: NormalizedItem = { id: issue.identifier, title: issue.title, icon: "linear-issue" };
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
}

interface IssueParseOptions {
  /** Order issues by soonest due date or by most-recently updated. */
  sort: "due" | "updated";
  /** Drop issues that have no due date (the "due soon" view). */
  dropUndated?: boolean;
}

export function parseIssues(
  payload: unknown,
  options: IssueParseOptions,
): ParseResult<NormalizedItem[]> {
  const result = IssuesSchema.safeParse(payload);
  if (!result.success) {
    return { ok: false, error: firstIssue(result.error, "invalid Linear response") };
  }
  const error = graphqlError(result.data.errors);
  if (error !== undefined) return { ok: false, error };
  if (result.data.data === undefined) return { ok: false, error: "Linear returned no data" };

  let nodes = [...result.data.data.issues.nodes];
  if (options.dropUndated === true) {
    nodes = nodes.filter((node) => node.dueDate !== undefined && node.dueDate !== null);
  }
  if (options.sort === "due") {
    // Soonest deadline first; issues with no due date sort to the end.
    nodes.sort((a, b) => (a.dueDate ?? "9999-99-99").localeCompare(b.dueDate ?? "9999-99-99"));
  } else {
    // Most recently updated first; missing timestamps sort to the end.
    nodes.sort((a, b) => (b.updatedAt ?? "").localeCompare(a.updatedAt ?? ""));
  }
  return { ok: true, value: nodes.map(issueToItem) };
}

function namedToItem(
  node: z.infer<typeof NamedNode>,
  icon: "linear-project" | "linear-initiative",
): NormalizedItem {
  const item: NormalizedItem = { id: node.id, title: node.name, icon };
  if (node.url !== undefined) item.url = node.url;
  const target =
    node.targetDate !== undefined && node.targetDate !== null
      ? formatTaskDue(node.targetDate)
      : undefined;
  if (target !== undefined) item.subtitle = target;
  return item;
}

export function parseProjects(payload: unknown): ParseResult<NormalizedItem[]> {
  const result = ProjectsSchema.safeParse(payload);
  if (!result.success) {
    return { ok: false, error: firstIssue(result.error, "invalid Linear response") };
  }
  const error = graphqlError(result.data.errors);
  if (error !== undefined) return { ok: false, error };
  if (result.data.data === undefined) return { ok: false, error: "Linear returned no data" };
  return {
    ok: true,
    value: result.data.data.projects.nodes.map((node) => namedToItem(node, "linear-project")),
  };
}

export function parseInitiatives(payload: unknown): ParseResult<NormalizedItem[]> {
  const result = InitiativesSchema.safeParse(payload);
  if (!result.success) {
    return { ok: false, error: firstIssue(result.error, "invalid Linear response") };
  }
  const error = graphqlError(result.data.errors);
  if (error !== undefined) return { ok: false, error };
  if (result.data.data === undefined) return { ok: false, error: "Linear returned no data" };
  return {
    ok: true,
    value: result.data.data.initiatives.nodes.map((node) =>
      namedToItem(node, "linear-initiative"),
    ),
  };
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
  const error = graphqlError(result.data.errors);
  if (error !== undefined) return { ok: false, error };
  if (result.data.data === undefined) return { ok: false, error: "Linear returned no data" };

  const items: NormalizedItem[] = [];
  const seen = new Set<string>();
  for (const node of result.data.data.notifications.nodes) {
    if (node.issue === undefined) continue;
    if (node.readAt !== undefined && node.readAt !== null) continue;
    if (node.snoozedUntilAt !== undefined && node.snoozedUntilAt !== null) continue;
    if (seen.has(node.issue.identifier)) continue;
    seen.add(node.issue.identifier);
    const item: NormalizedItem = {
      id: node.issue.identifier,
      title: node.issue.title,
      icon: "linear-issue",
    };
    if (node.issue.url !== undefined) item.url = node.issue.url;
    item.meta = node.issue.identifier;
    items.push(item);
  }
  return { ok: true, value: items };
}

/** The GraphQL query and fetch count for a view. */
function queryFor(view: LinearView, count: number): { query: string; first: number } {
  switch (view) {
    case "inbox":
      return { query: INBOX_QUERY, first: INBOX_FETCH };
    case "projects":
      return { query: PROJECTS_QUERY, first: count };
    case "initiatives":
      return { query: INITIATIVES_QUERY, first: count };
    case "created":
      return { query: CREATED_QUERY, first: count };
    case "in-progress":
      return { query: IN_PROGRESS_QUERY, first: count };
    case "due":
      return { query: DUE_QUERY, first: count };
    case "recent":
      return { query: RECENT_QUERY, first: count };
    case "assigned":
      return { query: ASSIGNED_QUERY, first: count };
  }
}

function parseFor(
  view: LinearView,
  payload: unknown,
  count: number,
): ParseResult<NormalizedItem[]> {
  switch (view) {
    case "inbox": {
      const parsed = parseLinearInbox(payload);
      // Filtered to unread already; cap to the display count after the wide fetch.
      return parsed.ok ? { ok: true, value: parsed.value.slice(0, count) } : parsed;
    }
    case "projects":
      return parseProjects(payload);
    case "initiatives":
      return parseInitiatives(payload);
    case "due":
      return parseIssues(payload, { sort: "due", dropUndated: true });
    case "recent":
      return parseIssues(payload, { sort: "updated" });
    case "assigned":
    case "created":
    case "in-progress":
      return parseIssues(payload, { sort: "due" });
  }
}

export const linearIntegration: Integration = {
  id: "linear",
  displayName: "Linear",

  async fetch(
    connection: IntegrationSource,
    secret: string | undefined,
    ctx: IntegrationContext,
  ): Promise<ParseResult<NormalizedItem[]>> {
    if (secret === undefined || secret.trim().length === 0) {
      return { ok: false, error: NEEDS_AUTH };
    }

    const view = linearViewOf(connection);
    const count = connection.count ?? 6;
    const { query, first } = queryFor(view, count);

    let payload: unknown;
    try {
      const response = await ctx.fetch({
        url: ENDPOINT,
        method: "POST",
        headers: { Authorization: secret, "Content-Type": "application/json" },
        body: JSON.stringify({ query, variables: { first } }),
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

    return parseFor(view, payload, count);
  },
};

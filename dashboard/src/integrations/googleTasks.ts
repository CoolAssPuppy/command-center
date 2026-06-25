import { z } from "zod";

import type { IntegrationSource } from "../config/schema";
import type { ParseResult } from "../domain/result";
import { formatTaskDue, taskTone } from "./task";
import {
  NEEDS_AUTH,
  type Integration,
  type IntegrationContext,
  type NormalizedItem,
  type TaskFields,
} from "./types";

/**
 * The Google Tasks integration. Like Google Calendar it has no secret of its
 * own; the platform supplies a per-connection token through
 * ctx.getAuthToken("google", connection.id), so each connection can be a
 * different Google account. It reads incomplete tasks across the account's lists
 * and normalizes them with their due date, for the "needs you" lane.
 */
const LISTS_URL = "https://www.googleapis.com/tasks/v1/users/@me/lists";
const TASKS_HOME = "https://tasks.google.com/";

function tasksUrl(listId: string): string {
  return `https://www.googleapis.com/tasks/v1/lists/${encodeURIComponent(listId)}/tasks?showCompleted=false&maxResults=100`;
}

const ListsSchema = z.object({
  items: z.array(z.object({ id: z.string() })).optional(),
});

const TaskSchema = z.object({
  id: z.string(),
  title: z.string().optional(),
  status: z.string().optional(),
  due: z.string().optional(),
});

const TasksSchema = z.object({ items: z.array(TaskSchema).optional() });

/**
 * Parse one task list's response into items, dropping completed and untitled.
 * Google Tasks has no native priority or category, so those stay blank; an
 * overdue task is toned urgent against now.
 */
export function parseGoogleTasks(payload: unknown, now: Date): NormalizedItem[] {
  const result = TasksSchema.safeParse(payload);
  if (!result.success) return [];
  return (result.data.items ?? [])
    .filter((task) => task.status !== "completed" && (task.title ?? "").trim().length > 0)
    .map((task) => {
      const item: NormalizedItem = {
        id: task.id,
        title: task.title ?? "Untitled",
        url: TASKS_HOME,
      };
      const fields: TaskFields = { status: "To do" };
      if (task.due !== undefined) {
        const when = formatTaskDue(task.due);
        if (when !== undefined) fields.due = when;
        item.sortKey = task.due;
      }
      item.task = fields;
      const tone = taskTone(
        task.due !== undefined ? { dueIso: task.due } : {},
        now,
      );
      if (tone !== undefined) item.tone = tone;
      return item;
    });
}

export const googleTasksIntegration: Integration = {
  id: "google-tasks",
  displayName: "Google Tasks",

  async fetch(
    connection: IntegrationSource,
    _secret: string | undefined,
    ctx: IntegrationContext,
  ): Promise<ParseResult<NormalizedItem[]>> {
    const token = await ctx.getAuthToken?.("google", connection.id);
    if (token === undefined || token.length === 0) {
      return { ok: false, error: NEEDS_AUTH };
    }
    const headers = { Authorization: `Bearer ${token}` };

    let listIds: string[];
    try {
      const response = await ctx.fetch({ url: LISTS_URL, headers });
      if (response.status === 401 || response.status === 403) {
        return { ok: false, error: NEEDS_AUTH };
      }
      if (!response.ok) {
        return { ok: false, error: `Google Tasks request failed (${String(response.status)})` };
      }
      const parsed = ListsSchema.safeParse(await response.json());
      listIds = parsed.success ? (parsed.data.items ?? []).map((list) => list.id) : [];
    } catch (cause) {
      const message = cause instanceof Error ? cause.message : "Google Tasks request failed";
      return { ok: false, error: message };
    }
    if (listIds.length === 0) return { ok: true, value: [] };

    const perList = await Promise.all(
      listIds.map(async (listId): Promise<NormalizedItem[]> => {
        try {
          const response = await ctx.fetch({ url: tasksUrl(listId), headers });
          if (!response.ok) return [];
          return parseGoogleTasks(await response.json(), ctx.now);
        } catch {
          return [];
        }
      }),
    );

    const all = perList.flat();
    // Soonest due first; tasks without a due date sort to the end.
    all.sort((a, b) => (a.sortKey ?? "9999").localeCompare(b.sortKey ?? "9999"));
    return { ok: true, value: all.slice(0, connection.count ?? 6) };
  },
};

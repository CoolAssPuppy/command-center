import { z } from "zod";

import type { Connection } from "../config/schema";
import { firstIssue, type ParseResult } from "../domain/result";
import {
  NEEDS_AUTH,
  type Integration,
  type IntegrationContext,
  type NormalizedItem,
} from "./types";

/**
 * The Todoist integration. Uses the connection's API token (a secret) as a
 * bearer credential and lists active tasks via REST v2, normalizing each into a
 * text-only item with its due date as the subtitle. Tasks surface in the "needs
 * you" lane alongside other task sources.
 */
const ENDPOINT = "https://api.todoist.com/rest/v2/tasks";

const TaskSchema = z.object({
  id: z.string(),
  content: z.string(),
  url: z.string().optional(),
  due: z
    .object({
      date: z.string().optional(),
      datetime: z.string().optional(),
      string: z.string().optional(),
    })
    .nullable()
    .optional(),
});

const ResponseSchema = z.array(TaskSchema);

export const todoistIntegration: Integration = {
  id: "todoist",
  displayName: "Todoist",

  async fetch(
    connection: Connection,
    secret: string | undefined,
    ctx: IntegrationContext,
  ): Promise<ParseResult<NormalizedItem[]>> {
    if (secret === undefined || secret.trim().length === 0) {
      return { ok: false, error: NEEDS_AUTH };
    }

    let payload: unknown;
    try {
      const response = await ctx.fetch({
        url: ENDPOINT,
        headers: { Authorization: `Bearer ${secret}` },
      });
      if (response.status === 401 || response.status === 403) {
        return { ok: false, error: NEEDS_AUTH };
      }
      if (!response.ok) {
        return { ok: false, error: `Todoist request failed (${response.status})` };
      }
      payload = await response.json();
    } catch (cause) {
      const message = cause instanceof Error ? cause.message : "Todoist request failed";
      return { ok: false, error: message };
    }

    const result = ResponseSchema.safeParse(payload);
    if (!result.success) {
      return { ok: false, error: firstIssue(result.error, "invalid Todoist response") };
    }

    const items: NormalizedItem[] = result.data.slice(0, connection.count ?? 6).map((task) => {
      const item: NormalizedItem = { id: task.id, title: task.content };
      if (task.url !== undefined) item.url = task.url;
      const due = task.due?.string ?? task.due?.date;
      if (due !== undefined) item.subtitle = due;
      const sortKey = task.due?.datetime ?? task.due?.date;
      if (sortKey !== undefined) item.sortKey = sortKey;
      return item;
    });
    return { ok: true, value: items };
  },
};

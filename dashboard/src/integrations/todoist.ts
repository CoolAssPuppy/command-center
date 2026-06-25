import { z } from "zod";

import type { IntegrationSource } from "../config/schema";
import { firstIssue, type ParseResult } from "../domain/result";
import { formatTaskDue, taskTone } from "./task";
import {
  NEEDS_AUTH,
  type Integration,
  type IntegrationContext,
  type NormalizedItem,
  type TaskFields,
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
  // Todoist priority: 4 is p1 (highest) down to 1 (no priority).
  priority: z.number().optional(),
  labels: z.array(z.string()).optional(),
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

/** Todoist priority 4..2 maps to P1..P3; 1 is "no priority" and is omitted. */
const PRIORITY_LABEL: Record<number, string> = { 4: "P1", 3: "P2", 2: "P3" };

export const todoistIntegration: Integration = {
  id: "todoist",
  displayName: "Todoist",

  async fetch(
    connection: IntegrationSource,
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

      const dueIso = task.due?.datetime ?? task.due?.date;
      const fields: TaskFields = {};
      const dueText =
        dueIso !== undefined ? (formatTaskDue(dueIso) ?? task.due?.string) : task.due?.string;
      if (dueText !== undefined) fields.due = dueText;
      if (dueIso !== undefined) item.sortKey = dueIso;
      const priorityLabel = task.priority !== undefined ? PRIORITY_LABEL[task.priority] : undefined;
      if (priorityLabel !== undefined) fields.priority = priorityLabel;
      if (task.labels !== undefined && task.labels.length > 0) {
        fields.category = task.labels.join(", ");
      }
      item.task = fields;

      const tone = taskTone(
        { highPriority: task.priority === 4, ...(dueIso !== undefined ? { dueIso } : {}) },
        ctx.now,
      );
      if (tone !== undefined) item.tone = tone;
      return item;
    });
    return { ok: true, value: items };
  },
};

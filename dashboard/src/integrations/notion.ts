import { z } from "zod";

import type { Connection } from "../config/schema";
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
 * The Notion integration. It queries the connection's database with the
 * connection's token (a secret) and a stable API version, applies the optional
 * filter, and normalizes each page into a text-only item linking to Notion.
 * Property shapes are dynamic, so the title is extracted defensively.
 */
const NOTION_VERSION = "2022-06-28";
const QUERY_BASE = "https://api.notion.com/v1/databases";

const ResultSchema = z.object({
  id: z.string(),
  url: z.string().optional(),
  properties: z.record(z.unknown()).optional(),
});

const QueryResponseSchema = z.object({ results: z.array(ResultSchema) });

/**
 * Accept either a raw Notion id (with or without dashes) or a pasted database
 * URL, and return the bare 32-character id. The view (?v=...) is dropped first,
 * so a "Copy link" url resolves to the database, not the view.
 */
export function normalizeNotionId(raw: string): string {
  const path = (raw.split("?")[0] ?? raw).replace(/-/g, "");
  const ids = path.match(/[0-9a-f]{32}/gi);
  return ids !== null && ids.length > 0 ? ids[ids.length - 1]! : raw.trim();
}

function asRecord(value: unknown): Record<string, unknown> | undefined {
  return typeof value === "object" && value !== null
    ? (value as Record<string, unknown>)
    : undefined;
}

function plainTextFromTitle(property: unknown): string | undefined {
  const prop = asRecord(property);
  if (prop === undefined || prop.type !== "title") return undefined;
  const segments = prop.title;
  if (!Array.isArray(segments)) return undefined;
  return segments
    .map((segment) => {
      const record = asRecord(segment);
      return record !== undefined && typeof record.plain_text === "string"
        ? record.plain_text
        : "";
    })
    .join("");
}

/**
 * Notion meeting-note pages often append the meeting's ISO date/time to the page
 * title ("Weekly Huddle2026-06-24T16:59:00.000"), which reads as garbage in a
 * compact row. Drop a trailing ISO datetime (even a truncated one) so the title
 * is just the name.
 */
export function stripTrailingTimestamp(title: string): string {
  return title
    .replace(
      /\s*\d{4}-\d{2}-\d{2}(T\d{2}(:\d{2}(:\d{2})?(\.\d+)?)?(Z|[+-]\d{2}:?\d{2})?)?\s*$/,
      "",
    )
    .trim();
}

/** Raw task properties pulled from a Notion page, before display formatting. */
export interface NotionTaskRaw {
  dueIso?: string;
  priority?: string;
  status?: string;
  category?: string;
}

function propType(prop: unknown): string | undefined {
  const record = asRecord(prop);
  return record !== undefined && typeof record.type === "string" ? record.type : undefined;
}

function dateStart(prop: unknown): string | undefined {
  const date = asRecord(asRecord(prop)?.date);
  return date !== undefined && typeof date.start === "string" ? date.start : undefined;
}

function selectName(prop: unknown): string | undefined {
  const select = asRecord(asRecord(prop)?.select);
  return select !== undefined && typeof select.name === "string" ? select.name : undefined;
}

function statusName(prop: unknown): string | undefined {
  const status = asRecord(asRecord(prop)?.status);
  return status !== undefined && typeof status.name === "string" ? status.name : undefined;
}

function multiSelectNames(prop: unknown): string | undefined {
  const list = asRecord(prop)?.multi_select;
  if (!Array.isArray(list)) return undefined;
  const names = list
    .map((entry) => asRecord(entry)?.name)
    .filter((name): name is string => typeof name === "string");
  return names.length > 0 ? names.join(", ") : undefined;
}

/**
 * Pull the task fields off a Notion page's properties, defensively. Due matches a
 * "Due" or "Due date" date property (else the first date property); Priority and
 * Status and Category match by name across their respective property shapes.
 */
export function extractNotionTaskFields(properties: Record<string, unknown>): NotionTaskRaw {
  const entries = Object.entries(properties);
  const result: NotionTaskRaw = {};

  let due: string | undefined;
  for (const [name, prop] of entries) {
    if (/^due(\s?date)?$/i.test(name.trim()) && propType(prop) === "date") {
      due = dateStart(prop);
      if (due !== undefined) break;
    }
  }
  if (due === undefined) {
    for (const [, prop] of entries) {
      if (propType(prop) === "date") {
        due = dateStart(prop);
        if (due !== undefined) break;
      }
    }
  }
  if (due !== undefined) result.dueIso = due;

  for (const [name, prop] of entries) {
    const key = name.trim().toLowerCase();
    if (key === "priority" && result.priority === undefined) {
      const value = selectName(prop);
      if (value !== undefined) result.priority = value;
    } else if (key === "status" && result.status === undefined) {
      const value = statusName(prop) ?? selectName(prop);
      if (value !== undefined) result.status = value;
    } else if (key === "category" && result.category === undefined) {
      const value = multiSelectNames(prop) ?? selectName(prop);
      if (value !== undefined) result.category = value;
    }
  }

  return result;
}

/** Build the shared task fields and tone for a Notion page in tasks mode. */
function applyNotionTask(
  item: NormalizedItem,
  properties: Record<string, unknown>,
  now: Date,
): void {
  const raw = extractNotionTaskFields(properties);
  const task: TaskFields = {};
  if (raw.dueIso !== undefined) {
    const due = formatTaskDue(raw.dueIso);
    if (due !== undefined) task.due = due;
    item.sortKey = raw.dueIso;
  }
  if (raw.priority !== undefined) task.priority = raw.priority;
  if (raw.status !== undefined) task.status = raw.status;
  if (raw.category !== undefined) task.category = raw.category;
  item.task = task;

  const highPriority = raw.priority !== undefined && /^(high|urgent)$/i.test(raw.priority);
  const tone = taskTone(
    { highPriority, ...(raw.dueIso !== undefined ? { dueIso: raw.dueIso } : {}) },
    now,
  );
  if (tone !== undefined) item.tone = tone;
}

function extractTitle(
  properties: Record<string, unknown> | undefined,
  titleProperty: string | undefined,
): string {
  if (properties === undefined) return "Untitled";
  if (titleProperty !== undefined) {
    const named = plainTextFromTitle(properties[titleProperty]);
    if (named !== undefined && named.length > 0) return stripTrailingTimestamp(named);
  }
  for (const value of Object.values(properties)) {
    const text = plainTextFromTitle(value);
    if (text !== undefined && text.length > 0) return stripTrailingTimestamp(text);
  }
  return "Untitled";
}

export const notionIntegration: Integration = {
  id: "notion",
  displayName: "Notion",

  async fetch(
    connection: Connection,
    secret: string | undefined,
    ctx: IntegrationContext,
  ): Promise<ParseResult<NormalizedItem[]>> {
    if (secret === undefined || secret.trim().length === 0) {
      return { ok: false, error: NEEDS_AUTH };
    }
    const rawDatabaseId = connection.databaseId?.trim() ?? "";
    if (rawDatabaseId.length === 0) {
      return { ok: false, error: NEEDS_AUTH };
    }
    const databaseId = normalizeNotionId(rawDatabaseId);

    const body: Record<string, unknown> = { page_size: connection.count ?? 6 };
    if (connection.filter !== undefined) body.filter = connection.filter;

    let payload: unknown;
    try {
      const response = await ctx.fetch({
        url: `${QUERY_BASE}/${encodeURIComponent(databaseId)}/query`,
        method: "POST",
        headers: {
          Authorization: `Bearer ${secret}`,
          "Notion-Version": NOTION_VERSION,
          "Content-Type": "application/json",
        },
        body: JSON.stringify(body),
      });
      if (response.status === 401) return { ok: false, error: NEEDS_AUTH };
      if (!response.ok) {
        // Notion's error body carries a precise message; surface it verbatim
        // instead of a bare status, so the real cause is visible.
        const detail = asRecord(await response.json().catch(() => undefined));
        const apiMessage =
          detail !== undefined && typeof detail.message === "string"
            ? detail.message
            : undefined;
        if (response.status === 404) {
          return {
            ok: false,
            error:
              apiMessage ??
              "Not found. Share the database with your integration, and check its id.",
          };
        }
        return { ok: false, error: apiMessage ?? `Notion request failed (${response.status})` };
      }
      payload = await response.json();
    } catch (cause) {
      const message = cause instanceof Error ? cause.message : "Notion request failed";
      return { ok: false, error: message };
    }

    const result = QueryResponseSchema.safeParse(payload);
    if (!result.success) {
      return { ok: false, error: firstIssue(result.error, "invalid Notion response") };
    }

    const asTasks = connection.role === "tasks";
    const items: NormalizedItem[] = result.data.results.map((page) => {
      const item: NormalizedItem = {
        id: page.id,
        title: extractTitle(page.properties, connection.titleProperty),
      };
      if (page.url !== undefined) item.url = page.url;
      if (asTasks && page.properties !== undefined) {
        applyNotionTask(item, page.properties, ctx.now);
      }
      return item;
    });
    return { ok: true, value: items };
  },
};

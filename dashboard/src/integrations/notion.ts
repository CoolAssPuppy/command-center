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

function extractTitle(
  properties: Record<string, unknown> | undefined,
  titleProperty: string | undefined,
): string {
  if (properties === undefined) return "Untitled";
  if (titleProperty !== undefined) {
    const named = plainTextFromTitle(properties[titleProperty]);
    if (named !== undefined && named.length > 0) return named;
  }
  for (const value of Object.values(properties)) {
    const text = plainTextFromTitle(value);
    if (text !== undefined && text.length > 0) return text;
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

    const items: NormalizedItem[] = result.data.results.map((page) => {
      const item: NormalizedItem = {
        id: page.id,
        title: extractTitle(page.properties, connection.titleProperty),
      };
      if (page.url !== undefined) item.url = page.url;
      return item;
    });
    return { ok: true, value: items };
  },
};

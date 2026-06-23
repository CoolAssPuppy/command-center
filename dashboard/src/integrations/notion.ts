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
    const databaseId = connection.databaseId?.trim() ?? "";
    if (databaseId.length === 0) {
      return { ok: false, error: NEEDS_AUTH };
    }

    const body: Record<string, unknown> = { page_size: connection.count ?? 10 };
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
        return { ok: false, error: `Notion request failed (${response.status})` };
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

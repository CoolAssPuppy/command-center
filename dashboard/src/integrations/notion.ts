import { z } from "zod";

import { firstIssue, type ParseResult } from "../domain/result";
import {
  NEEDS_AUTH,
  type Integration,
  type IntegrationContext,
  type NormalizedItem,
} from "./types";

/**
 * The Notion integration. It queries a database with the user's integration
 * token (kept in local secrets) and a stable API version, applies the optional
 * filter and sorts from the stream config, and normalizes each page into a
 * text-only item that links back to Notion. Property shapes in Notion are
 * dynamic, so the title is extracted defensively without trusting the schema.
 */
const NOTION_VERSION = "2022-06-28";
const QUERY_BASE = "https://api.notion.com/v1/databases";

export const NotionConfigSchema = z.object({
  databaseId: z.string().min(1),
  /** Which property holds the title; defaults to the title-typed property. */
  titleProperty: z.string().optional(),
  /** A raw Notion filter object, passed through verbatim. */
  filter: z.unknown().optional(),
  /** Raw Notion sorts, passed through verbatim. */
  sorts: z.array(z.unknown()).optional(),
  pageSize: z.number().int().positive().max(50).default(10),
});
export type NotionConfig = z.infer<typeof NotionConfigSchema>;

const ResultSchema = z.object({
  id: z.string(),
  url: z.string().optional(),
  properties: z.record(z.unknown()).optional(),
});

const QueryResponseSchema = z.object({
  results: z.array(ResultSchema),
});

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
  const text = segments
    .map((segment) => {
      const record = asRecord(segment);
      return record !== undefined && typeof record.plain_text === "string"
        ? record.plain_text
        : "";
    })
    .join("");
  return text;
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
    rawConfig: unknown,
    ctx: IntegrationContext,
  ): Promise<ParseResult<NormalizedItem[]>> {
    const parsed = NotionConfigSchema.safeParse(rawConfig);
    if (!parsed.success) {
      return { ok: false, error: firstIssue(parsed.error, "Set a Notion database") };
    }
    const token = ctx.secrets.notionToken;
    if (token === undefined || token.trim().length === 0) {
      return { ok: false, error: NEEDS_AUTH };
    }

    const config = parsed.data;
    const body: Record<string, unknown> = { page_size: config.pageSize };
    if (config.filter !== undefined) body.filter = config.filter;
    if (config.sorts !== undefined) body.sorts = config.sorts;

    let payload: unknown;
    try {
      const response = await ctx.fetch({
        url: `${QUERY_BASE}/${encodeURIComponent(config.databaseId)}/query`,
        method: "POST",
        headers: {
          Authorization: `Bearer ${token}`,
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
        title: extractTitle(page.properties, config.titleProperty),
      };
      if (page.url !== undefined) item.url = page.url;
      return item;
    });
    return { ok: true, value: items };
  },
};

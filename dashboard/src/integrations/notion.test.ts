import { describe, expect, it } from "vitest";

import { notionIntegration } from "./notion";
import {
  NEEDS_AUTH,
  type HttpRequest,
  type HttpResponseLike,
  type IntegrationContext,
} from "./types";

const page = (id: string, title: string, url?: string): Record<string, unknown> => ({
  id,
  url,
  properties: { Name: { type: "title", title: [{ plain_text: title }] } },
});

const jsonResponse = (body: unknown): HttpResponseLike => ({
  ok: true,
  status: 200,
  json: () => Promise.resolve(body),
});

function context(overrides: Partial<IntegrationContext> = {}): IntegrationContext {
  return {
    secrets: { notionToken: "secret_x" },
    now: new Date("2026-06-23T00:00:00Z"),
    fetch: () => Promise.resolve(jsonResponse({ results: [] })),
    ...overrides,
  };
}

describe("notionIntegration", () => {
  it("returns needs-auth without a token", async () => {
    const result = await notionIntegration.fetch(
      { databaseId: "db1" },
      context({ secrets: {} }),
    );
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error).toBe(NEEDS_AUTH);
  });

  it("requires a database id", async () => {
    const result = await notionIntegration.fetch({}, context());
    expect(result.ok).toBe(false);
  });

  it("queries with token, version, and filter, then normalizes pages", async () => {
    let captured: HttpRequest | undefined;
    const fetch = (request: HttpRequest): Promise<HttpResponseLike> => {
      captured = request;
      return Promise.resolve(
        jsonResponse({ results: [page("p1", "Ship it", "https://notion.so/p1")] }),
      );
    };
    const result = await notionIntegration.fetch(
      {
        databaseId: "db1",
        pageSize: 5,
        filter: { property: "Done", checkbox: { equals: false } },
      },
      context({ fetch }),
    );

    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.value).toEqual([
      { id: "p1", title: "Ship it", url: "https://notion.so/p1" },
    ]);
    expect(captured?.url).toContain("/databases/db1/query");
    expect(captured?.headers?.Authorization).toBe("Bearer secret_x");
    expect(captured?.headers?.["Notion-Version"]).toBeTruthy();
    const body = JSON.parse(captured?.body ?? "{}") as {
      page_size?: number;
      filter?: unknown;
    };
    expect(body.page_size).toBe(5);
    expect(body.filter).toEqual({ property: "Done", checkbox: { equals: false } });
  });

  it("treats a 401 as needs-auth", async () => {
    const result = await notionIntegration.fetch(
      { databaseId: "db1" },
      context({
        fetch: () =>
          Promise.resolve({ ok: false, status: 401, json: () => Promise.resolve({}) }),
      }),
    );
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error).toBe(NEEDS_AUTH);
  });

  it("falls back to Untitled when a page has no title", async () => {
    const result = await notionIntegration.fetch(
      { databaseId: "db1" },
      context({ fetch: () => Promise.resolve(jsonResponse({ results: [{ id: "p2" }] })) }),
    );
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.value[0]?.title).toBe("Untitled");
  });
});

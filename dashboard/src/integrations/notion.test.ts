import { describe, expect, it } from "vitest";

import type { Connection } from "../config/schema";
import { notionIntegration, stripTrailingTimestamp } from "./notion";
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

const ctx = (
  fetch: (request: HttpRequest) => Promise<HttpResponseLike>,
): IntegrationContext => ({ fetch, now: new Date("2026-06-23T00:00:00Z") });

const connection = (overrides: Partial<Connection> = {}): Connection => ({
  id: "c1",
  name: "Docs",
  service: "notion",
  databaseId: "db1",
  ...overrides,
});

describe("notionIntegration", () => {
  it("returns needs-auth without a token", async () => {
    const result = await notionIntegration.fetch(
      connection(),
      undefined,
      ctx(() => Promise.resolve(jsonResponse({ results: [] }))),
    );
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error).toBe(NEEDS_AUTH);
  });

  it("returns needs-auth without a database id", async () => {
    const result = await notionIntegration.fetch(
      connection({ databaseId: undefined }),
      "tok",
      ctx(() => Promise.resolve(jsonResponse({ results: [] }))),
    );
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error).toBe(NEEDS_AUTH);
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
      connection({ count: 5, filter: { property: "Done", checkbox: { equals: false } } }),
      "secret_x",
      ctx(fetch),
    );

    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.value[0]).toMatchObject({
      id: "p1",
      title: "Ship it",
      url: "https://notion.so/p1",
    });
    expect(captured?.url).toContain("/databases/db1/query");
    expect(captured?.headers?.Authorization).toBe("Bearer secret_x");
    const body = JSON.parse(captured?.body ?? "{}") as {
      page_size?: number;
      filter?: unknown;
    };
    expect(body.page_size).toBe(5);
    expect(body.filter).toEqual({ property: "Done", checkbox: { equals: false } });
  });

  it("accepts a pasted database URL and queries the bare id", async () => {
    let captured: HttpRequest | undefined;
    const result = await notionIntegration.fetch(
      connection({
        databaseId:
          "https://www.notion.so/ws/My-Tasks-228be0491f0c4e3da9b1b2c3d4e5f607?v=99998888777766665555444433332222",
      }),
      "tok",
      ctx((request) => {
        captured = request;
        return Promise.resolve(jsonResponse({ results: [] }));
      }),
    );
    expect(result.ok).toBe(true);
    expect(captured?.url).toContain("/databases/228be0491f0c4e3da9b1b2c3d4e5f607/query");
    expect(captured?.url).not.toContain("9999");
  });

  it("explains a 404 as a sharing or id problem", async () => {
    const result = await notionIntegration.fetch(
      connection(),
      "tok",
      ctx(() => Promise.resolve({ ok: false, status: 404, json: () => Promise.resolve({}) })),
    );
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error).toContain("Share the database");
  });

  it("surfaces Notion's own error message when present", async () => {
    const result = await notionIntegration.fetch(
      connection(),
      "tok",
      ctx(() =>
        Promise.resolve({
          ok: false,
          status: 404,
          json: () =>
            Promise.resolve({
              object: "error",
              code: "object_not_found",
              message: "Could not find data_source with ID: abc. Make sure it is shared.",
            }),
        }),
      ),
    );
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error).toContain("Could not find data_source");
  });

  it("treats a 401 as needs-auth", async () => {
    const result = await notionIntegration.fetch(
      connection(),
      "tok",
      ctx(() => Promise.resolve({ ok: false, status: 401, json: () => Promise.resolve({}) })),
    );
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error).toBe(NEEDS_AUTH);
  });

  it("falls back to Untitled when a page has no title", async () => {
    const result = await notionIntegration.fetch(
      connection(),
      "tok",
      ctx(() => Promise.resolve(jsonResponse({ results: [{ id: "p2" }] }))),
    );
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.value[0]?.title).toBe("Untitled");
  });
});

describe("stripTrailingTimestamp", () => {
  it("drops a trailing ISO datetime appended to a title", () => {
    expect(stripTrailingTimestamp("Marketing Catchup2026-06-24T16:59:00.000")).toBe(
      "Marketing Catchup",
    );
    expect(stripTrailingTimestamp("Weekly Events Huddle 2026-06-24T16:59")).toBe(
      "Weekly Events Huddle",
    );
    expect(stripTrailingTimestamp("Shane 1:12026-06-24T16:59:00.0")).toBe("Shane 1:1");
  });

  it("drops a trailing bare date too", () => {
    expect(stripTrailingTimestamp("Roadmap 2026-06-24")).toBe("Roadmap");
  });

  it("leaves a clean title untouched", () => {
    expect(stripTrailingTimestamp("Select Demand Gen")).toBe("Select Demand Gen");
  });
});

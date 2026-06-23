import { describe, expect, it } from "vitest";

import type { Connection } from "../config/schema";
import { linearIntegration } from "./linear";
import {
  NEEDS_AUTH,
  type HttpRequest,
  type HttpResponseLike,
  type IntegrationContext,
} from "./types";

const json = (body: unknown): HttpResponseLike => ({
  ok: true,
  status: 200,
  json: () => Promise.resolve(body),
});

const issuesBody = (nodes: unknown[]): unknown => ({
  data: { viewer: { assignedIssues: { nodes } } },
});

const ctx = (
  fetch: (request: HttpRequest) => Promise<HttpResponseLike>,
): IntegrationContext => ({ fetch, now: new Date("2026-06-23T00:00:00Z") });

const connection = (overrides: Partial<Connection> = {}): Connection => ({
  id: "c1",
  name: "Inbox",
  service: "linear",
  ...overrides,
});

describe("linearIntegration", () => {
  it("returns needs-auth without a key", async () => {
    const result = await linearIntegration.fetch(
      connection(),
      undefined,
      ctx(() => Promise.resolve(json(issuesBody([])))),
    );
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error).toBe(NEEDS_AUTH);
  });

  it("queries with the key and normalizes issues", async () => {
    let captured: HttpRequest | undefined;
    const fetch = (request: HttpRequest): Promise<HttpResponseLike> => {
      captured = request;
      return Promise.resolve(
        json(
          issuesBody([
            {
              identifier: "ENG-412",
              title: "Crash on cold start",
              url: "https://linear.app/x",
              state: { name: "In Progress" },
            },
          ]),
        ),
      );
    };
    const result = await linearIntegration.fetch(
      connection({ count: 5 }),
      "lin_key",
      ctx(fetch),
    );

    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.value[0]).toMatchObject({
      id: "ENG-412",
      title: "Crash on cold start",
      subtitle: "In Progress",
      url: "https://linear.app/x",
      meta: "ENG-412",
    });
    expect(captured?.headers?.Authorization).toBe("lin_key");
    const body = JSON.parse(captured?.body ?? "{}") as { variables?: { first?: number } };
    expect(body.variables?.first).toBe(5);
  });

  it("maps 401 to needs-auth", async () => {
    const result = await linearIntegration.fetch(
      connection(),
      "lin_key",
      ctx(() => Promise.resolve({ ok: false, status: 401, json: () => Promise.resolve({}) })),
    );
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error).toBe(NEEDS_AUTH);
  });

  it("surfaces a GraphQL error", async () => {
    const result = await linearIntegration.fetch(
      connection(),
      "lin_key",
      ctx(() => Promise.resolve(json({ errors: [{ message: "Bad query" }] }))),
    );
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error).toBe("Bad query");
  });
});

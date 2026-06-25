import { describe, expect, it } from "vitest";

import type { Connection } from "../config/schema";
import { todoistIntegration } from "./todoist";
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

const ctx = (
  fetch: (request: HttpRequest) => Promise<HttpResponseLike>,
): IntegrationContext => ({ fetch, now: new Date("2026-06-25T08:00:00Z") });

const connection = (overrides: Partial<Connection> = {}): Connection => ({
  id: "c1",
  name: "Tasks",
  service: "todoist",
  ...overrides,
});

describe("todoistIntegration", () => {
  it("returns needs-auth without a token", async () => {
    const result = await todoistIntegration.fetch(
      connection(),
      undefined,
      ctx(() => Promise.resolve(json([]))),
    );
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error).toBe(NEEDS_AUTH);
  });

  it("lists tasks with the bearer token and a due-date subtitle", async () => {
    let captured: HttpRequest | undefined;
    const fetch = (request: HttpRequest): Promise<HttpResponseLike> => {
      captured = request;
      return Promise.resolve(
        json([
          {
            id: "9",
            content: "Ship the redesign",
            url: "https://todoist.com/showTask?id=9",
            due: { date: "2026-06-26", string: "tomorrow" },
          },
        ]),
      );
    };
    const result = await todoistIntegration.fetch(connection(), "td_token", ctx(fetch));

    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.value[0]).toMatchObject({
      id: "9",
      title: "Ship the redesign",
      url: "https://todoist.com/showTask?id=9",
      sortKey: "2026-06-26",
    });
    expect(result.value[0]?.task?.due).toBeDefined();
    expect(captured?.headers?.Authorization).toBe("Bearer td_token");
  });

  it("maps 401 to needs-auth", async () => {
    const result = await todoistIntegration.fetch(
      connection(),
      "td_token",
      ctx(() => Promise.resolve({ ok: false, status: 401, json: () => Promise.resolve({}) })),
    );
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error).toBe(NEEDS_AUTH);
  });
});

describe("todoist task fields", () => {
  it("maps p1 priority, labels, and due, and tones p1 urgent", async () => {
    const result = await todoistIntegration.fetch(
      connection(),
      "td_token",
      ctx(() =>
        Promise.resolve(
          json([
            {
              id: "9",
              content: "Ship it",
              priority: 4,
              labels: ["work", "release"],
              due: { date: "2026-06-26", datetime: "2026-06-26T17:00:00Z" },
            },
          ]),
        ),
      ),
    );
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.value[0]?.task).toMatchObject({ priority: "P1", category: "work, release" });
    expect(result.value[0]?.task?.due).toBeDefined();
    expect(result.value[0]?.tone).toBe("urgent");
  });

  it("omits priority for the default p4 (no priority)", async () => {
    const result = await todoistIntegration.fetch(
      connection(),
      "td_token",
      ctx(() => Promise.resolve(json([{ id: "1", content: "Plain", priority: 1 }]))),
    );
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.value[0]?.task?.priority).toBeUndefined();
  });
});

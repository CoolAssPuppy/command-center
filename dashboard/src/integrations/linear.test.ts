import { describe, expect, it } from "vitest";

import type { Connection } from "../config/schema";
import {
  ASSIGNED_QUERY,
  INBOX_QUERY,
  linearIntegration,
  linearViewOf,
  parseLinearInbox,
} from "./linear";
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

const issuesBody = (nodes: unknown[]): unknown => ({ data: { issues: { nodes } } });

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

const inboxBody = (nodes: unknown[]): unknown => ({ data: { notifications: { nodes } } });

describe("linear inbox view", () => {
  it("defaults to assigned and reads inbox when chosen", () => {
    expect(linearViewOf(connection())).toBe("assigned");
    expect(linearViewOf(connection({ linearView: "inbox" }))).toBe("inbox");
  });

  it("queries notifications in inbox mode", async () => {
    let captured: HttpRequest | undefined;
    await linearIntegration.fetch(
      connection({ linearView: "inbox" }),
      "lin_key",
      ctx((request) => {
        captured = request;
        return Promise.resolve(json(inboxBody([])));
      }),
    );
    const body = JSON.parse(captured?.body ?? "{}") as { query?: string };
    expect(body.query).toBe(INBOX_QUERY);
    expect(body.query).toContain("notifications");
    expect(body.query).toContain("IssueNotification");
  });

  it("keeps unread, unsnoozed issue notifications and dedupes by issue", () => {
    const result = parseLinearInbox(
      inboxBody([
        { id: "a", readAt: null, snoozedUntilAt: null, issue: { identifier: "ENG-1", title: "Fix", url: "https://l/1" } },
        { id: "b", readAt: "2026-06-23T00:00:00Z", issue: { identifier: "ENG-2", title: "Read", url: "https://l/2" } },
        { id: "c", snoozedUntilAt: "2026-06-30T00:00:00Z", issue: { identifier: "ENG-3", title: "Snoozed" } },
        { id: "d", readAt: null, snoozedUntilAt: null, issue: { identifier: "ENG-1", title: "Fix dup" } },
        { id: "e", readAt: null }, // no issue
      ]),
    );
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.value.map((item) => item.id)).toEqual(["ENG-1"]);
    expect(result.value[0]).toMatchObject({ title: "Fix", url: "https://l/1", meta: "ENG-1" });
  });
});

describe("linear assigned view (Change 4)", () => {
  it("queries open issues created-by-me or assigned-to-me", () => {
    expect(ASSIGNED_QUERY).toContain("creator: { isMe: { eq: true } }");
    expect(ASSIGNED_QUERY).toContain("assignee: { isMe: { eq: true } }");
    expect(ASSIGNED_QUERY).toContain("completedAt: { null: true }");
    expect(ASSIGNED_QUERY).toContain("dueDate");
  });

  it("orders by nearest due date, with undated issues last", async () => {
    const result = await linearIntegration.fetch(
      connection(),
      "lin_key",
      ctx(() =>
        Promise.resolve(
          json(
            issuesBody([
              { identifier: "ENG-1", title: "No due", state: { name: "Todo" } },
              { identifier: "ENG-2", title: "Later", dueDate: "2026-07-10", state: { name: "Todo" } },
              { identifier: "ENG-3", title: "Soon", dueDate: "2026-06-26", state: { name: "Backlog" } },
            ]),
          ),
        ),
      ),
    );
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.value.map((item) => item.id)).toEqual(["ENG-3", "ENG-2", "ENG-1"]);
  });

  it("shows the due date beside the status in the subtitle", async () => {
    const result = await linearIntegration.fetch(
      connection(),
      "lin_key",
      ctx(() =>
        Promise.resolve(
          json(
            issuesBody([
              { identifier: "ENG-9", title: "Has due", dueDate: "2026-06-26", state: { name: "Backlog" } },
              { identifier: "ENG-8", title: "No due", state: { name: "Todo" } },
            ]),
          ),
        ),
      ),
    );
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    const dated = result.value.find((item) => item.id === "ENG-9");
    const undated = result.value.find((item) => item.id === "ENG-8");
    expect(dated?.subtitle).toMatch(/^Backlog, /);
    expect(undated?.subtitle).toBe("Todo");
  });
});

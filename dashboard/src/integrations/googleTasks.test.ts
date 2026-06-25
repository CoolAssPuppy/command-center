import { describe, expect, it } from "vitest";

import { googleTasksIntegration, parseGoogleTasks } from "./googleTasks";
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

const taskNow = new Date("2026-06-25T08:00:00Z");

describe("parseGoogleTasks", () => {
  it("keeps incomplete, titled tasks with a due and 'To do' status", () => {
    const items = parseGoogleTasks(
      {
        items: [
          { id: "1", title: "Write report", status: "needsAction", due: "2026-06-26T00:00:00.000Z" },
          { id: "2", title: "Done thing", status: "completed" },
          { id: "3", title: "  ", status: "needsAction" },
          { id: "4", title: "No due", status: "needsAction" },
        ],
      },
      taskNow,
    );
    expect(items.map((item) => item.id)).toEqual(["1", "4"]);
    expect(items[0]).toMatchObject({ title: "Write report", sortKey: "2026-06-26T00:00:00.000Z" });
    expect(items[0]?.task?.due).toBeDefined();
    expect(items[0]?.task?.status).toBe("To do");
    expect(items[0]?.task?.priority).toBeUndefined();
  });

  it("tones an overdue task urgent", () => {
    const items = parseGoogleTasks(
      { items: [{ id: "x", title: "Late", status: "needsAction", due: "2026-06-20" }] },
      taskNow,
    );
    expect(items[0]?.tone).toBe("urgent");
  });

  it("returns nothing for a malformed payload", () => {
    expect(parseGoogleTasks({ nope: true }, taskNow)).toEqual([]);
  });
});

describe("googleTasksIntegration", () => {
  const ctx = (
    fetch: (request: HttpRequest) => Promise<HttpResponseLike>,
    token: string | undefined,
  ): IntegrationContext => ({
    fetch,
    now: new Date("2026-06-25T08:00:00Z"),
    getAuthToken: () => Promise.resolve(token),
  });

  const connection = { id: "c1", name: "Tasks", service: "google-tasks" as const };

  it("returns needs-auth without a token", async () => {
    const result = await googleTasksIntegration.fetch(
      connection,
      undefined,
      ctx(() => Promise.resolve(json({})), undefined),
    );
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error).toBe(NEEDS_AUTH);
  });

  it("reads lists then tasks, soonest due first", async () => {
    const fetch = (request: HttpRequest): Promise<HttpResponseLike> => {
      if (request.url.includes("/users/@me/lists")) {
        return Promise.resolve(json({ items: [{ id: "L1" }] }));
      }
      return Promise.resolve(
        json({
          items: [
            { id: "late", title: "Late", status: "needsAction", due: "2026-06-28T00:00:00Z" },
            { id: "soon", title: "Soon", status: "needsAction", due: "2026-06-26T00:00:00Z" },
          ],
        }),
      );
    };
    const result = await googleTasksIntegration.fetch(connection, undefined, ctx(fetch, "tok"));
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.value.map((item) => item.id)).toEqual(["soon", "late"]);
  });
});

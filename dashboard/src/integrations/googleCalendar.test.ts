import { describe, expect, it } from "vitest";

import { googleCalendarIntegration } from "./googleCalendar";
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

function context(overrides: Partial<IntegrationContext> = {}): IntegrationContext {
  return {
    secrets: {},
    now: new Date("2026-06-23T09:00:00Z"),
    fetch: () => Promise.resolve(json({ items: [] })),
    getAuthToken: () => Promise.resolve("tok"),
    ...overrides,
  };
}

describe("googleCalendarIntegration", () => {
  it("returns needs-auth without a token", async () => {
    const result = await googleCalendarIntegration.fetch(
      {},
      context({ getAuthToken: () => Promise.resolve(undefined) }),
    );
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error).toBe(NEEDS_AUTH);
  });

  it("lists events with the bearer token and normalizes them", async () => {
    let captured: HttpRequest | undefined;
    const fetch = (request: HttpRequest): Promise<HttpResponseLike> => {
      captured = request;
      return Promise.resolve(
        json({
          items: [
            {
              id: "e1",
              summary: "Design review",
              htmlLink: "https://cal/e1",
              location: "Room 1",
              start: { dateTime: "2026-06-23T09:30:00Z" },
            },
          ],
        }),
      );
    };
    const result = await googleCalendarIntegration.fetch(
      { maxResults: 5 },
      context({ fetch }),
    );

    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.value[0]).toMatchObject({
      id: "e1",
      title: "Design review",
      url: "https://cal/e1",
      meta: "Room 1",
    });
    expect(captured?.url).toContain("/calendars/primary/events");
    expect(captured?.url).toContain("singleEvents=true");
    expect(captured?.headers?.Authorization).toBe("Bearer tok");
  });

  it("falls back to (no title) and labels all-day events", async () => {
    const result = await googleCalendarIntegration.fetch(
      {},
      context({
        fetch: () => Promise.resolve(json({ items: [{ id: "e2", start: { date: "2026-06-24" } }] })),
      }),
    );
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.value[0]?.title).toBe("(no title)");
    expect(result.value[0]?.subtitle).toBe("All day");
  });

  it("maps 401 to needs-auth", async () => {
    const result = await googleCalendarIntegration.fetch(
      {},
      context({
        fetch: () =>
          Promise.resolve({ ok: false, status: 401, json: () => Promise.resolve({}) }),
      }),
    );
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error).toBe(NEEDS_AUTH);
  });
});

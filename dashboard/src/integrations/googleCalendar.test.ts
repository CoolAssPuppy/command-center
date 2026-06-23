import { describe, expect, it } from "vitest";

import type { Connection } from "../config/schema";
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

const ctx = (overrides: Partial<IntegrationContext> = {}): IntegrationContext => ({
  fetch: () => Promise.resolve(json({ items: [] })),
  now: new Date("2026-06-23T09:00:00Z"),
  getAuthToken: () => Promise.resolve("tok"),
  ...overrides,
});

const connection = (overrides: Partial<Connection> = {}): Connection => ({
  id: "c1",
  name: "Today",
  service: "google-calendar",
  ...overrides,
});

describe("googleCalendarIntegration", () => {
  it("returns needs-auth without a token", async () => {
    const result = await googleCalendarIntegration.fetch(
      connection(),
      undefined,
      ctx({ getAuthToken: () => Promise.resolve(undefined) }),
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
      connection({ count: 5 }),
      undefined,
      ctx({ fetch }),
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
      connection(),
      undefined,
      ctx({
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
      connection(),
      undefined,
      ctx({
        fetch: () => Promise.resolve({ ok: false, status: 401, json: () => Promise.resolve({}) }),
      }),
    );
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error).toBe(NEEDS_AUTH);
  });
});

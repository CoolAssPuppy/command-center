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

  const capturedWindow = async (now: Date): Promise<{ min: Date; max: Date }> => {
    let captured: HttpRequest | undefined;
    await googleCalendarIntegration.fetch(
      connection(),
      undefined,
      ctx({
        now,
        fetch: (request) => {
          captured = request;
          return Promise.resolve(json({ items: [] }));
        },
      }),
    );
    const params = new URL(captured?.url ?? "").searchParams;
    return {
      min: new Date(params.get("timeMin") ?? ""),
      max: new Date(params.get("timeMax") ?? ""),
    };
  };

  it("queries from the start of the local day, not the current moment", async () => {
    // Local 9am, built so getHours() is 9 regardless of the test machine's zone.
    const { min } = await capturedWindow(new Date(2026, 5, 23, 9, 0, 0));
    expect(min.getHours()).toBe(0);
    expect(min.getMinutes()).toBe(0);
    expect(min.getDate()).toBe(23);
  });

  it("ends the window at tomorrow's midnight before 5pm", async () => {
    const { max } = await capturedWindow(new Date(2026, 5, 23, 9, 0, 0));
    expect(max.getHours()).toBe(0);
    expect(max.getDate()).toBe(24);
  });

  it("extends the window through tomorrow after 5pm", async () => {
    const { max } = await capturedWindow(new Date(2026, 5, 23, 18, 0, 0));
    expect(max.getHours()).toBe(0);
    expect(max.getDate()).toBe(25);
  });

  it("labels tomorrow's events as Tomorrow", async () => {
    const result = await googleCalendarIntegration.fetch(
      connection(),
      undefined,
      ctx({
        fetch: () => Promise.resolve(json({ items: [{ id: "e5", start: { date: "2026-06-24" } }] })),
      }),
    );
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.value[0]?.subtitle).toBe("Tomorrow, all day");
  });

  it("shows only the time for events today", async () => {
    const result = await googleCalendarIntegration.fetch(
      connection(),
      undefined,
      ctx({
        fetch: () =>
          Promise.resolve(
            json({ items: [{ id: "e3", summary: "Standup", start: { dateTime: "2026-06-23T12:00:00Z" } }] }),
          ),
      }),
    );
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    // No day prefix, just the time, so it reads as today.
    expect(result.value[0]?.subtitle).not.toContain(",");
  });

  it("prefixes events on a later day so they are not mistaken for today", async () => {
    const result = await googleCalendarIntegration.fetch(
      connection(),
      undefined,
      ctx({
        fetch: () =>
          Promise.resolve(
            json({ items: [{ id: "e4", summary: "Offsite", start: { dateTime: "2026-07-08T16:30:00Z" } }] }),
          ),
      }),
    );
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.value[0]?.subtitle).toMatch(/Jul 8,/);
  });

  it("falls back to (no title) and labels all-day events", async () => {
    const result = await googleCalendarIntegration.fetch(
      connection(),
      undefined,
      ctx({
        fetch: () => Promise.resolve(json({ items: [{ id: "e2", start: { date: "2026-06-23" } }] })),
      }),
    );
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.value[0]?.title).toBe("(no title)");
    expect(result.value[0]?.subtitle).toBe("All day");
  });

  it("merges events from extra calendars, sorted by start time", async () => {
    const fetch = (request: HttpRequest): Promise<HttpResponseLike> => {
      const onPrimary = request.url.includes("/calendars/primary/");
      return Promise.resolve(
        json({
          items: onPrimary
            ? [{ id: "p1", summary: "Primary", start: { dateTime: "2026-06-23T15:00:00Z" } }]
            : [{ id: "w1", summary: "Work", start: { dateTime: "2026-06-23T09:00:00Z" } }],
        }),
      );
    };
    const result = await googleCalendarIntegration.fetch(
      connection({ calendarIds: ["work@group.calendar.google.com"] }),
      undefined,
      ctx({ fetch }),
    );
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    // 09:00 (work) sorts before 15:00 (primary).
    expect(result.value.map((item) => item.id)).toEqual(["w1", "p1"]);
  });

  it("keeps the card alive when a merged calendar cannot be read", async () => {
    const fetch = (request: HttpRequest): Promise<HttpResponseLike> =>
      request.url.includes("/calendars/primary/")
        ? Promise.resolve(
            json({ items: [{ id: "p1", summary: "Primary", start: { dateTime: "2026-06-23T15:00:00Z" } }] }),
          )
        : Promise.resolve({ ok: false, status: 404, json: () => Promise.resolve({}) });
    const result = await googleCalendarIntegration.fetch(
      connection({ calendarIds: ["missing@group.calendar.google.com"] }),
      undefined,
      ctx({ fetch }),
    );
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.value.map((item) => item.id)).toEqual(["p1"]);
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

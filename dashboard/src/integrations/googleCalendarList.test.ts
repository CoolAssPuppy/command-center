import { describe, expect, it } from "vitest";

import { fetchGoogleCalendarList } from "./googleCalendarList";
import type { HttpFetch, HttpResponseLike } from "./types";

const ok = (body: unknown): HttpResponseLike => ({
  ok: true,
  status: 200,
  json: () => Promise.resolve(body),
});

const fetchReturning = (response: HttpResponseLike | Error): HttpFetch => {
  return (request) => {
    expect(request.headers?.Authorization).toBe("Bearer tok");
    return response instanceof Error ? Promise.reject(response) : Promise.resolve(response);
  };
};

describe("fetchGoogleCalendarList", () => {
  it("returns each calendar's id and summary", async () => {
    const list = await fetchGoogleCalendarList(
      fetchReturning(ok({ items: [{ id: "primary", summary: "Personal" }, { id: "team@x" }] })),
      "tok",
    );
    expect(list).toEqual([{ id: "primary", summary: "Personal" }, { id: "team@x" }]);
  });

  it("skips entries without a string id", async () => {
    const list = await fetchGoogleCalendarList(
      fetchReturning(ok({ items: [{ summary: "no id" }, { id: "real" }, null, 7] })),
      "tok",
    );
    expect(list).toEqual([{ id: "real" }]);
  });

  it("returns undefined on a failed request", async () => {
    const list = await fetchGoogleCalendarList(
      fetchReturning({ ok: false, status: 401, json: () => Promise.resolve({}) }),
      "tok",
    );
    expect(list).toBeUndefined();
  });

  it("returns undefined when the fetch throws", async () => {
    const list = await fetchGoogleCalendarList(fetchReturning(new Error("offline")), "tok");
    expect(list).toBeUndefined();
  });
});

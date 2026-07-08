import { describe, expect, it } from "vitest";

import { fetchJson } from "./http";
import type { HttpFetch, HttpResponseLike } from "./types";

const response = (over: Partial<HttpResponseLike>): HttpResponseLike => ({
  ok: true,
  status: 200,
  json: () => Promise.resolve({}),
  ...over,
});

describe("fetchJson", () => {
  it("returns the status, ok flag, and parsed body on success", async () => {
    const fetch: HttpFetch = () =>
      Promise.resolve(response({ status: 200, ok: true, json: () => Promise.resolve({ a: 1 }) }));
    const outcome = await fetchJson(fetch, { url: "https://x" }, "Test");
    expect(outcome).toEqual({ status: 200, ok: true, body: { a: 1 } });
  });

  it("keeps the error body readable on a non-2xx status", async () => {
    const fetch: HttpFetch = () =>
      Promise.resolve(
        response({ status: 404, ok: false, json: () => Promise.resolve({ message: "nope" }) }),
      );
    const outcome = await fetchJson(fetch, { url: "https://x" }, "Test");
    expect(outcome.ok).toBe(false);
    expect(outcome.status).toBe(404);
    expect(outcome.body).toEqual({ message: "nope" });
  });

  it("tolerates an unreadable body without throwing", async () => {
    const fetch: HttpFetch = () =>
      Promise.resolve(response({ status: 204, ok: true, json: () => Promise.reject(new Error("no body")) }));
    const outcome = await fetchJson(fetch, { url: "https://x" }, "Test");
    expect(outcome.ok).toBe(true);
    expect(outcome.body).toBeUndefined();
  });

  it("captures a transport-level throw as transportError with status 0", async () => {
    const fetch: HttpFetch = () => Promise.reject(new Error("network down"));
    const outcome = await fetchJson(fetch, { url: "https://x" }, "Test");
    expect(outcome.status).toBe(0);
    expect(outcome.ok).toBe(false);
    expect(outcome.transportError).toBe("network down");
  });
});

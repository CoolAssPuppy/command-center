import { describe, expect, it } from "vitest";

import { fetchNews } from "./news";
import type { HttpRequest, HttpResponseLike } from "./types";

const json = (body: unknown): HttpResponseLike => ({
  ok: true,
  status: 200,
  json: () => Promise.resolve(body),
});

const respond = (request: HttpRequest): Promise<HttpResponseLike> => {
  if (request.url.endsWith("topstories.json")) return Promise.resolve(json([1, 2]));
  if (request.url.includes("/item/1.json")) {
    return Promise.resolve(json({ title: "A breakthrough", url: "https://example.com/a" }));
  }
  if (request.url.includes("/item/2.json")) return Promise.resolve(json({ title: "Ask HN" }));
  return Promise.resolve({ ok: false, status: 404, json: () => Promise.resolve({}) });
};

describe("fetchNews", () => {
  it("reads top stories and resolves each headline", async () => {
    const items = await fetchNews(respond, 2);
    expect(items).toEqual([
      { title: "A breakthrough", url: "https://example.com/a", source: "Hacker News" },
      { title: "Ask HN", url: "https://news.ycombinator.com/item?id=2", source: "Hacker News" },
    ]);
  });

  it("returns nothing when the top-stories list fails", async () => {
    const items = await fetchNews(
      () => Promise.resolve({ ok: false, status: 500, json: () => Promise.resolve({}) }),
    );
    expect(items).toEqual([]);
  });
});

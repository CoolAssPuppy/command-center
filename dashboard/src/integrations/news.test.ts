import { describe, expect, it } from "vitest";

import { fetchNews, parseFeed } from "./news";
import type { HttpRequest, HttpResponseLike } from "./types";

const json = (body: unknown): HttpResponseLike => ({
  ok: true,
  status: 200,
  json: () => Promise.resolve(body),
});

const xml = (body: string): HttpResponseLike => ({
  ok: true,
  status: 200,
  json: () => Promise.resolve(undefined),
  text: () => Promise.resolve(body),
});

const RSS = `<?xml version="1.0"?>
<rss version="2.0"><channel>
  <title>Feed</title>
  <item><title>RSS newer</title><link>https://ex.com/2</link><pubDate>Wed, 24 Jun 2026 10:00:00 GMT</pubDate></item>
  <item><title>RSS older</title><link>https://ex.com/1</link><pubDate>Mon, 22 Jun 2026 10:00:00 GMT</pubDate></item>
  <item><title>No link</title></item>
</channel></rss>`;

const ATOM = `<?xml version="1.0"?>
<feed xmlns="http://www.w3.org/2005/Atom">
  <title>Atom Feed</title>
  <entry><title>Atom A</title><link rel="alternate" href="https://ex.com/a1"/><updated>2026-06-24T10:00:00Z</updated></entry>
  <entry><title>Atom B</title><link href="https://ex.com/a2"/><updated>2026-06-23T10:00:00Z</updated></entry>
</feed>`;

describe("parseFeed", () => {
  it("parses RSS 2.0, dropping items missing a title or link", () => {
    const items = parseFeed(RSS, "Test", "test.com");
    expect(items.map((item) => item.title)).toEqual(["RSS newer", "RSS older"]);
    expect(items[0]).toMatchObject({ url: "https://ex.com/2", source: "Test", iconHost: "test.com" });
    expect(items[0]?.publishedMs).toBeGreaterThan(items[1]?.publishedMs ?? 0);
  });

  it("parses Atom, using the alternate link href and updated date", () => {
    const items = parseFeed(ATOM, "Atom Src");
    expect(items.map((item) => item.url)).toEqual(["https://ex.com/a1", "https://ex.com/a2"]);
    expect(items[0]?.title).toBe("Atom A");
    expect(items[0]?.publishedMs).toBeDefined();
  });

  it("drops a malformed feed without throwing", () => {
    expect(parseFeed("<<<not xml", "X")).toEqual([]);
    expect(parseFeed("", "X")).toEqual([]);
    expect(parseFeed("<html><body>nope</body></html>", "X")).toEqual([]);
  });

  it("drops an item whose link is an unsafe scheme", () => {
    const feed = `<?xml version="1.0"?>
<rss version="2.0"><channel>
  <item><title>Safe</title><link>https://ex.com/ok</link></item>
  <item><title>Evil</title><link>javascript:alert(1)</link></item>
</channel></rss>`;
    const items = parseFeed(feed, "Test");
    expect(items.map((item) => item.title)).toEqual(["Safe"]);
  });
});

describe("fetchNews", () => {
  it("reads Hacker News with favicon host and publish time", async () => {
    const respond = (request: HttpRequest): Promise<HttpResponseLike> => {
      if (request.url.endsWith("topstories.json")) return Promise.resolve(json([1]));
      return Promise.resolve(json({ title: "HN story", url: "https://hn/1", time: 1_750_000_000 }));
    };
    const items = await fetchNews(respond, ["hacker-news"]);
    expect(items[0]).toMatchObject({
      title: "HN story",
      url: "https://hn/1",
      source: "Hacker News",
      iconHost: "news.ycombinator.com",
    });
    expect(items[0]?.publishedMs).toBe(1_750_000_000 * 1000);
  });

  it("merges sources newest-first and caps the list", async () => {
    const respond = (request: HttpRequest): Promise<HttpResponseLike> => {
      if (request.url.endsWith("topstories.json")) return Promise.resolve(json([1]));
      if (request.url.includes("/item/1.json")) {
        // ~23 Jun 2026, between the 22 Jun and 24 Jun RSS items.
        return Promise.resolve(json({ title: "HN mid", url: "https://hn/1", time: 1_782_200_000 }));
      }
      if (request.url.includes("techcrunch")) return Promise.resolve(xml(RSS));
      return Promise.resolve({ ok: false, status: 404, json: () => Promise.resolve({}) });
    };
    const items = await fetchNews(respond, ["hacker-news", "techcrunch"], 10);
    // RSS newer (24 Jun) > HN mid (~23 Jun) > RSS older (22 Jun).
    expect(items.map((item) => item.title)).toEqual(["RSS newer", "HN mid", "RSS older"]);
  });

  it("survives one source failing, keeping the other", async () => {
    const respond = (request: HttpRequest): Promise<HttpResponseLike> => {
      if (request.url.includes("techcrunch")) return Promise.resolve(xml(RSS));
      // Hacker News all fail.
      return Promise.resolve({ ok: false, status: 500, json: () => Promise.resolve({}) });
    };
    const items = await fetchNews(respond, ["hacker-news", "techcrunch"]);
    expect(items.map((item) => item.title)).toEqual(["RSS newer", "RSS older"]);
  });

  it("returns nothing when no sources are active", async () => {
    const items = await fetchNews(() => Promise.resolve(json([])), []);
    expect(items).toEqual([]);
  });
});

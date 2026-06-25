import { z } from "zod";

import { DEFAULT_NEWS_SOURCES, NEWS_FEEDS, type NewsFeed } from "./newsFeeds";
import type { HttpFetch } from "./types";

/**
 * Headlines for the ambient news ticker, merged from a curated set of free,
 * keyless sources: Hacker News (its JSON API) plus RSS/Atom feeds parsed client
 * side. Every fetch and parse is best-effort: a source that fails or returns junk
 * is dropped, never breaking the strip, since this is glance data.
 */
export interface NewsItem {
  title: string;
  url: string;
  source: string;
  /** Brand domain for the source favicon. */
  iconHost?: string;
  /** Publish time as epoch ms, for newest-first merging. */
  publishedMs?: number;
}

const TOP_STORIES = "https://hacker-news.firebaseio.com/v0/topstories.json";
const ITEM = (id: number): string =>
  `https://hacker-news.firebaseio.com/v0/item/${String(id)}.json`;
const HN_HOST = "news.ycombinator.com";

const IdsSchema = z.array(z.number());
const StorySchema = z.object({
  title: z.string().optional(),
  url: z.string().optional(),
  time: z.number().optional(),
});

async function fetchHackerNews(fetch: HttpFetch, limit: number): Promise<NewsItem[]> {
  let ids: number[];
  try {
    const response = await fetch({ url: TOP_STORIES });
    if (!response.ok) return [];
    const parsed = IdsSchema.safeParse(await response.json());
    if (!parsed.success) return [];
    ids = parsed.data.slice(0, Math.max(0, limit));
  } catch {
    return [];
  }

  const stories = await Promise.all(
    ids.map(async (id): Promise<NewsItem | undefined> => {
      try {
        const response = await fetch({ url: ITEM(id) });
        if (!response.ok) return undefined;
        const parsed = StorySchema.safeParse(await response.json());
        if (!parsed.success || parsed.data.title === undefined) return undefined;
        // External links go to the article; self/ask posts to the HN thread.
        const url = parsed.data.url ?? `https://news.ycombinator.com/item?id=${String(id)}`;
        const item: NewsItem = {
          title: parsed.data.title,
          url,
          source: "Hacker News",
          iconHost: HN_HOST,
        };
        if (parsed.data.time !== undefined) item.publishedMs = parsed.data.time * 1000;
        return item;
      } catch {
        return undefined;
      }
    }),
  );
  return stories.filter((story): story is NewsItem => story !== undefined);
}

// getElementsByTagName matches by qualified name, so it works for default-
// namespaced Atom feeds where querySelector type selectors can miss.
function textOf(node: Element, tag: string): string | undefined {
  const child = node.getElementsByTagName(tag)[0];
  const text = child?.textContent?.trim();
  return text !== undefined && text.length > 0 ? text : undefined;
}

/** The article link of an Atom entry: prefer rel="alternate", else any href. */
function atomLink(node: Element): string | undefined {
  const links = [...node.getElementsByTagName("link")];
  const alternate = links.find(
    (link) =>
      (link.getAttribute("rel") ?? "alternate") === "alternate" &&
      link.getAttribute("href") !== null,
  );
  const chosen = alternate ?? links.find((link) => link.getAttribute("href") !== null);
  const href = chosen?.getAttribute("href")?.trim();
  return href !== undefined && href.length > 0 ? href : undefined;
}

/**
 * Parse a feed's XML into items, handling both RSS 2.0 (item > title/link/pubDate)
 * and Atom (entry > title/link[href]/updated). Missing fields drop the item, a
 * malformed feed yields nothing, and it never throws.
 */
export function parseFeed(xml: string, sourceName: string, iconHost?: string): NewsItem[] {
  if (typeof DOMParser === "undefined") return [];
  let doc: Document;
  try {
    doc = new DOMParser().parseFromString(xml, "application/xml");
  } catch {
    return [];
  }
  if (doc.getElementsByTagName("parsererror").length > 0) return [];

  const isAtom = (doc.documentElement?.localName?.toLowerCase() ?? "") === "feed";
  const nodes = [...doc.getElementsByTagName(isAtom ? "entry" : "item")];

  const items: NewsItem[] = [];
  for (const node of nodes) {
    const title = textOf(node, "title");
    const link = isAtom ? atomLink(node) : textOf(node, "link");
    if (title === undefined || link === undefined) continue;

    const item: NewsItem = { title, url: link, source: sourceName };
    if (iconHost !== undefined) item.iconHost = iconHost;
    const dateText = isAtom
      ? (textOf(node, "updated") ?? textOf(node, "published"))
      : textOf(node, "pubDate");
    if (dateText !== undefined) {
      const ms = Date.parse(dateText);
      if (!Number.isNaN(ms)) item.publishedMs = ms;
    }
    items.push(item);
  }
  return items;
}

async function fetchRssFeed(feed: NewsFeed, fetch: HttpFetch): Promise<NewsItem[]> {
  try {
    const response = await fetch({ url: feed.url });
    if (!response.ok || response.text === undefined) return [];
    return parseFeed(await response.text(), feed.name, feed.host);
  } catch {
    return [];
  }
}

/**
 * Fetch every active source in parallel, merge into one list sorted newest-first,
 * and cap. A failing source contributes nothing rather than breaking the strip.
 */
export async function fetchNews(
  fetch: HttpFetch,
  sources: readonly string[] = DEFAULT_NEWS_SOURCES,
  limit = 14,
): Promise<NewsItem[]> {
  const active = NEWS_FEEDS.filter((feed) => sources.includes(feed.id));
  if (active.length === 0) return [];
  // Pull a few extra per source so the merged top still has fresh choices.
  const perFeed = Math.max(6, Math.ceil(limit / active.length) + 2);

  const lists = await Promise.all(
    active.map((feed) =>
      feed.kind === "hackernews" ? fetchHackerNews(fetch, perFeed) : fetchRssFeed(feed, fetch),
    ),
  );
  const merged = lists.flat();
  merged.sort((a, b) => (b.publishedMs ?? 0) - (a.publishedMs ?? 0));
  return merged.slice(0, limit);
}

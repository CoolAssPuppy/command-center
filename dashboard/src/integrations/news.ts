import { z } from "zod";

import type { HttpFetch } from "./types";

/**
 * Headlines for the ambient news ticker, from the Hacker News public API. No key
 * and CORS-enabled, so it fits the no-server design. The top-stories list gives
 * ids; each is fetched for its title and link. Anything that fails is dropped,
 * since this is a glance strip, never a hard dependency.
 */
const TOP_STORIES = "https://hacker-news.firebaseio.com/v0/topstories.json";
const ITEM = (id: number): string =>
  `https://hacker-news.firebaseio.com/v0/item/${String(id)}.json`;

export interface NewsItem {
  title: string;
  url: string;
  source: string;
}

const IdsSchema = z.array(z.number());
const StorySchema = z.object({
  title: z.string().optional(),
  url: z.string().optional(),
});

export async function fetchNews(fetch: HttpFetch, limit = 12): Promise<NewsItem[]> {
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
        return { title: parsed.data.title, url, source: "Hacker News" };
      } catch {
        return undefined;
      }
    }),
  );
  return stories.filter((story): story is NewsItem => story !== undefined);
}

/**
 * The curated set of free, keyless news sources the ticker can pull from. Each is
 * either Hacker News (its own JSON API) or a public RSS/Atom feed. `host` is the
 * brand domain used for the favicon; the fetch origin comes from `url`. Hosts are
 * wired into the manifest, CSP, and dev proxy.
 */
export interface NewsFeed {
  id: string;
  name: string;
  /** The feed URL (empty for Hacker News, which uses its JSON API path). */
  url: string;
  /** Brand domain for the source favicon. */
  host: string;
  kind: "hackernews" | "rss";
}

export const NEWS_FEEDS: readonly NewsFeed[] = [
  { id: "hacker-news", name: "Hacker News", url: "", host: "news.ycombinator.com", kind: "hackernews" },
  { id: "the-verge", name: "The Verge", url: "https://www.theverge.com/rss/index.xml", host: "theverge.com", kind: "rss" },
  { id: "techcrunch", name: "TechCrunch", url: "https://techcrunch.com/feed/", host: "techcrunch.com", kind: "rss" },
  { id: "ars-technica", name: "Ars Technica", url: "https://feeds.arstechnica.com/arstechnica/index", host: "arstechnica.com", kind: "rss" },
  { id: "bbc-news", name: "BBC News", url: "https://feeds.bbci.co.uk/news/rss.xml", host: "bbc.co.uk", kind: "rss" },
  { id: "nyt", name: "NYT", url: "https://rss.nytimes.com/services/xml/rss/nyt/HomePage.xml", host: "nytimes.com", kind: "rss" },
  { id: "npr", name: "NPR", url: "https://feeds.npr.org/1001/rss.xml", host: "npr.org", kind: "rss" },
];

/** Default active sources: Hacker News only, preserving today's behavior. */
export const DEFAULT_NEWS_SOURCES: readonly string[] = ["hacker-news"];

/**
 * The content security policy for the new tab page. Scripts and styles come
 * only from the extension itself; outbound connections are limited to the few
 * hosts the dashboard talks to (weather, Unsplash, Notion). This blocks any
 * injected string from a feed value from running or phoning home. The same
 * string is the single source of truth for both the manifest's
 * `content_security_policy.extension_pages` and the dev `index.html` meta tag;
 * a test asserts the manifest matches.
 */

/** Hosts the dashboard is allowed to open outbound connections to. */
export const CONNECT_HOSTS = [
  "https://api.open-meteo.com",
  "https://api.unsplash.com",
  "https://api.notion.com",
  "https://geocoding-api.open-meteo.com",
  "https://www.googleapis.com",
  "https://api.linear.app",
  "https://api.github.com",
  "https://finnhub.io",
  "https://hacker-news.firebaseio.com",
  "https://api.todoist.com",
  "https://api.frankfurter.dev",
  "https://www.theverge.com",
  "https://techcrunch.com",
  "https://feeds.arstechnica.com",
  "https://feeds.bbci.co.uk",
  "https://rss.nytimes.com",
  "https://feeds.npr.org",
  "https://www.techmeme.com",
] as const;

interface CspDirectives {
  connectSrc: string[];
}

function render(directives: CspDirectives): string {
  return [
    "default-src 'self'",
    `connect-src 'self' ${directives.connectSrc.join(" ")}`,
    "img-src 'self' https: data:",
    "style-src 'self' 'unsafe-inline'",
    "script-src 'self'",
  ].join("; ");
}

export interface BuildCspOptions {
  /** Extra hosts allowed for outbound connections, in addition to the defaults. */
  connectSrc?: string[];
}

export function buildCsp(options: BuildCspOptions = {}): string {
  return render({ connectSrc: [...CONNECT_HOSTS, ...(options.connectSrc ?? [])] });
}

export const DEFAULT_CSP = buildCsp();

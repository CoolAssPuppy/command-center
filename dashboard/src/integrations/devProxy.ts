import { realHttpFetch } from "./http";
import type { HttpFetch } from "./types";

/**
 * Dev-only HTTP client. In `pnpm run dev` the page is a localhost origin, so
 * Notion and Linear reject its requests with CORS, surfacing as "Failed to
 * fetch". This routes those hosts through the Vite dev proxy (see
 * vite.config.ts), which makes the calls server-side where CORS does not apply.
 *
 * The packaged extension never uses this: its host_permissions already bypass
 * CORS, and `import.meta.env.DEV` is false in the production build, so the
 * branch that selects this client is tree-shaken away.
 */
const PROXIED_HOSTS: ReadonlyArray<readonly [string, string]> = [
  ["https://api.notion.com", "/__cc-proxy/notion"],
  ["https://api.linear.app", "/__cc-proxy/linear"],
  ["https://api.github.com", "/__cc-proxy/github"],
  ["https://www.googleapis.com", "/__cc-proxy/google"],
  ["https://api.unsplash.com", "/__cc-proxy/unsplash"],
];

/** Rewrite a proxied API host to its dev path; pass anything else through. */
export function devProxyUrl(url: string): string {
  for (const [host, prefix] of PROXIED_HOSTS) {
    if (url.startsWith(host)) return prefix + url.slice(host.length);
  }
  return url;
}

export const devProxyFetch: HttpFetch = (request) =>
  realHttpFetch({ ...request, url: devProxyUrl(request.url) });

/** Dev wallpaper client: same proxy, the url-only shape Unsplash uses. */
export const devUnsplashFetch = (
  url: string,
): Promise<{ ok: boolean; status: number; json: () => Promise<unknown> }> =>
  fetch(devProxyUrl(url)).then((response) => ({
    ok: response.ok,
    status: response.status,
    json: () => response.json(),
  }));

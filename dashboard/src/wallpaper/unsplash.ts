import { z } from "zod";

import { firstIssue, type ParseResult } from "../domain/result";

/**
 * The Unsplash wallpaper client. The keyless `source.unsplash.com` endpoint was
 * retired, so this uses the official API: the user supplies an access key (kept
 * in local secrets), and we ask for one random landscape photo matching their
 * search terms. Per the Unsplash API guidelines, when a photo is shown the app
 * must ping its `download_location`; triggerDownload does that. The fetch is
 * injected so the client is fully testable without a network or a real key.
 */
const RANDOM_BASE = "https://api.unsplash.com/photos/random";

export interface WallpaperPhoto {
  imageUrl: string;
  authorName: string;
  authorUrl: string;
  /** Unsplash endpoint to ping when the photo is used (attribution compliance). */
  downloadLocation: string;
}

export interface FetchResponseLike {
  ok: boolean;
  status: number;
  json(): Promise<unknown>;
}

export type FetchLike = (url: string) => Promise<FetchResponseLike>;

const PhotoSchema = z.object({
  urls: z.object({ regular: z.string().url() }),
  user: z.object({
    name: z.string(),
    links: z.object({ html: z.string().url() }),
  }),
  links: z.object({ download_location: z.string().url() }),
});

export function buildRandomUrl(terms: string[], accessKey: string): string {
  const url = new URL(RANDOM_BASE);
  const cleaned = terms.map((term) => term.trim()).filter((term) => term.length > 0);
  // With no terms, omit the query so Unsplash returns any random landscape.
  if (cleaned.length > 0) url.searchParams.set("query", cleaned.join(","));
  url.searchParams.set("orientation", "landscape");
  url.searchParams.set("content_filter", "high");
  url.searchParams.set("client_id", accessKey);
  return url.toString();
}

export async function fetchWallpaper(
  options: { terms: string[]; accessKey: string },
  deps: { fetch: FetchLike },
): Promise<ParseResult<WallpaperPhoto>> {
  const terms = options.terms.map((term) => term.trim()).filter((term) => term.length > 0);
  if (options.accessKey.trim().length === 0) {
    return { ok: false, error: "missing Unsplash access key" };
  }

  let body: unknown;
  try {
    const response = await deps.fetch(buildRandomUrl(terms, options.accessKey));
    if (!response.ok) {
      return { ok: false, error: `Unsplash request failed (${response.status})` };
    }
    body = await response.json();
  } catch (cause) {
    const message = cause instanceof Error ? cause.message : "Unsplash request failed";
    return { ok: false, error: message };
  }

  const parsed = PhotoSchema.safeParse(body);
  if (!parsed.success) {
    return { ok: false, error: firstIssue(parsed.error, "invalid Unsplash response") };
  }

  return {
    ok: true,
    value: {
      imageUrl: parsed.data.urls.regular,
      authorName: parsed.data.user.name,
      authorUrl: parsed.data.user.links.html,
      downloadLocation: parsed.data.links.download_location,
    },
  };
}

/** Ping the photo's download endpoint, as the Unsplash API guidelines require. */
export async function triggerDownload(
  downloadLocation: string,
  accessKey: string,
  deps: { fetch: FetchLike },
): Promise<void> {
  try {
    const url = new URL(downloadLocation);
    url.searchParams.set("client_id", accessKey);
    await deps.fetch(url.toString());
  } catch {
    // Attribution ping is best-effort and never blocks rendering.
  }
}

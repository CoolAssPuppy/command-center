import {
  fetchWallpaper,
  triggerDownload,
  type FetchLike,
  type WallpaperPhoto,
} from "./unsplash";

/**
 * Wallpaper resolution with a per-day cache. A new image is fetched only when
 * the day or the search terms change, which keeps the page instant and stays
 * well under Unsplash's rate limits. On a fetch failure the last good photo is
 * reused, so a flaky network never blanks the background.
 */
const CACHE_KEY = "cc:wallpaper";

interface CacheEntry {
  dateKey: string;
  terms: string;
  photo: WallpaperPhoto;
}

function webStorage(explicit?: Storage): Storage | undefined {
  return explicit ?? (globalThis as { localStorage?: Storage }).localStorage;
}

function isPhoto(value: unknown): value is WallpaperPhoto {
  if (typeof value !== "object" || value === null) return false;
  const photo = value as Record<string, unknown>;
  return (
    typeof photo.imageUrl === "string" &&
    typeof photo.authorName === "string" &&
    typeof photo.authorUrl === "string" &&
    typeof photo.downloadLocation === "string"
  );
}

export function loadWallpaperCache(storage?: Storage): CacheEntry | undefined {
  const store = webStorage(storage);
  if (store === undefined) return undefined;
  try {
    const raw = store.getItem(CACHE_KEY);
    if (raw === null) return undefined;
    const parsed: unknown = JSON.parse(raw);
    if (typeof parsed !== "object" || parsed === null) return undefined;
    const entry = parsed as Record<string, unknown>;
    if (
      typeof entry.dateKey === "string" &&
      typeof entry.terms === "string" &&
      isPhoto(entry.photo)
    ) {
      return { dateKey: entry.dateKey, terms: entry.terms, photo: entry.photo };
    }
    return undefined;
  } catch {
    return undefined;
  }
}

export function saveWallpaperCache(entry: CacheEntry, storage?: Storage): void {
  const store = webStorage(storage);
  if (store === undefined) return;
  try {
    store.setItem(CACHE_KEY, JSON.stringify(entry));
  } catch {
    // Best-effort cache; never fail a render over it.
  }
}

export interface ResolveWallpaperOptions {
  terms: string[];
  accessKey: string;
  /** A day bucket, e.g. "2026-06-23"; a new day fetches a fresh photo. */
  dateKey: string;
}

export interface ResolveWallpaperDeps {
  fetch: FetchLike;
  storage?: Storage;
}

export async function resolveWallpaper(
  options: ResolveWallpaperOptions,
  deps: ResolveWallpaperDeps,
): Promise<WallpaperPhoto | undefined> {
  const termsKey = options.terms.join(",");
  const cached = loadWallpaperCache(deps.storage);
  if (cached !== undefined && cached.dateKey === options.dateKey && cached.terms === termsKey) {
    return cached.photo;
  }

  const result = await fetchWallpaper(
    { terms: options.terms, accessKey: options.accessKey },
    { fetch: deps.fetch },
  );
  if (!result.ok) return cached?.photo;

  saveWallpaperCache(
    { dateKey: options.dateKey, terms: termsKey, photo: result.value },
    deps.storage,
  );
  void triggerDownload(result.value.downloadLocation, options.accessKey, {
    fetch: deps.fetch,
  });
  return result.value;
}

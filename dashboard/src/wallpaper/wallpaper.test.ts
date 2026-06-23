import { describe, expect, it } from "vitest";

import type { FetchResponseLike } from "./unsplash";
import { loadWallpaperCache, resolveWallpaper, saveWallpaperCache } from "./wallpaper";

function memoryStorage(): Storage {
  const map = new Map<string, string>();
  return {
    get length(): number {
      return map.size;
    },
    clear: () => map.clear(),
    getItem: (key: string) => map.get(key) ?? null,
    key: (index: number) => [...map.keys()][index] ?? null,
    removeItem: (key: string) => map.delete(key),
    setItem: (key: string, value: string) => map.set(key, value),
  };
}

const photoBody = {
  urls: { regular: "https://images.unsplash.com/photo-1.jpg" },
  user: { name: "Ansel", links: { html: "https://unsplash.com/@ansel" } },
  links: { download_location: "https://api.unsplash.com/photos/1/download" },
};

const okResponse = (): FetchResponseLike => ({
  ok: true,
  status: 200,
  json: () => Promise.resolve(photoBody),
});

const failResponse = (): FetchResponseLike => ({
  ok: false,
  status: 500,
  json: () => Promise.resolve({}),
});

describe("resolveWallpaper", () => {
  it("fetches and caches on first run", async () => {
    const storage = memoryStorage();
    const photo = await resolveWallpaper(
      { terms: ["Lisbon"], accessKey: "k", dateKey: "2026-06-23" },
      { fetch: () => Promise.resolve(okResponse()), storage },
    );
    expect(photo?.imageUrl).toContain("photo-1");
    expect(loadWallpaperCache(storage)?.photo.imageUrl).toContain("photo-1");
  });

  it("reuses the cache for the same day and terms", async () => {
    const storage = memoryStorage();
    const randomCalls: string[] = [];
    const fetch = (url: string): Promise<FetchResponseLike> => {
      if (url.includes("/photos/random")) randomCalls.push(url);
      return Promise.resolve(okResponse());
    };
    const options = { terms: ["Lisbon"], accessKey: "k", dateKey: "2026-06-23" };
    await resolveWallpaper(options, { fetch, storage });
    await resolveWallpaper(options, { fetch, storage });
    expect(randomCalls).toHaveLength(1);
  });

  it("refetches when the day changes", async () => {
    const storage = memoryStorage();
    const randomCalls: string[] = [];
    const fetch = (url: string): Promise<FetchResponseLike> => {
      if (url.includes("/photos/random")) randomCalls.push(url);
      return Promise.resolve(okResponse());
    };
    await resolveWallpaper(
      { terms: ["Lisbon"], accessKey: "k", dateKey: "2026-06-23" },
      { fetch, storage },
    );
    await resolveWallpaper(
      { terms: ["Lisbon"], accessKey: "k", dateKey: "2026-06-24" },
      { fetch, storage },
    );
    expect(randomCalls).toHaveLength(2);
  });

  it("falls back to the cached photo when a fetch fails", async () => {
    const storage = memoryStorage();
    saveWallpaperCache(
      {
        dateKey: "2026-06-22",
        terms: "Lisbon",
        photo: {
          imageUrl: "https://images.unsplash.com/old.jpg",
          authorName: "Old",
          authorUrl: "https://unsplash.com/@old",
          downloadLocation: "https://api.unsplash.com/photos/0/download",
        },
      },
      storage,
    );
    const photo = await resolveWallpaper(
      { terms: ["Lisbon"], accessKey: "k", dateKey: "2026-06-23" },
      { fetch: () => Promise.resolve(failResponse()), storage },
    );
    expect(photo?.imageUrl).toContain("old.jpg");
  });
});

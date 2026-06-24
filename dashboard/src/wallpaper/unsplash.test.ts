import { describe, expect, it } from "vitest";

import {
  buildRandomUrl,
  fetchWallpaper,
  pickTerm,
  triggerDownload,
  type FetchResponseLike,
} from "./unsplash";

const photoBody = {
  urls: { regular: "https://images.unsplash.com/photo-1.jpg" },
  user: { name: "Ansel", links: { html: "https://unsplash.com/@ansel" } },
  links: { download_location: "https://api.unsplash.com/photos/1/download" },
};

const response = (body: unknown, ok = true): FetchResponseLike => ({
  ok,
  status: ok ? 200 : 403,
  json: () => Promise.resolve(body),
});

describe("buildRandomUrl", () => {
  it("requests a random landscape photo with one subject and the key", () => {
    const url = buildRandomUrl("San Francisco", "KEY");
    expect(url).toContain("query=San+Francisco");
    expect(url).not.toContain("%2C"); // no comma list
    expect(url).toContain("orientation=landscape");
    expect(url).toContain("client_id=KEY");
  });

  it("omits the query when there is no subject", () => {
    expect(buildRandomUrl(undefined, "KEY")).not.toContain("query=");
  });
});

describe("pickTerm", () => {
  it("picks one subject from the comma list at random, never a joined string", () => {
    const terms = ["San Francisco", "Lisbon", "Puppies"];
    expect(pickTerm(terms, () => 0)).toBe("San Francisco");
    expect(pickTerm(terms, () => 0.5)).toBe("Lisbon");
    expect(pickTerm(terms, () => 0.99)).toBe("Puppies");
  });

  it("returns undefined for no terms", () => {
    expect(pickTerm([])).toBeUndefined();
    expect(pickTerm(["  "])).toBeUndefined();
  });
});

describe("fetchWallpaper", () => {
  it("requires a key but allows empty terms (a random photo)", async () => {
    const deps = { fetch: () => Promise.resolve(response(photoBody)) };
    expect((await fetchWallpaper({ terms: [], accessKey: "k" }, deps)).ok).toBe(true);
    expect((await fetchWallpaper({ terms: ["x"], accessKey: "" }, deps)).ok).toBe(false);
  });

  it("maps a photo with attribution", async () => {
    const result = await fetchWallpaper(
      { terms: ["Lisbon"], accessKey: "k" },
      { fetch: () => Promise.resolve(response(photoBody)) },
    );
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.value).toMatchObject({
      imageUrl: "https://images.unsplash.com/photo-1.jpg",
      authorName: "Ansel",
      authorUrl: "https://unsplash.com/@ansel",
      downloadLocation: "https://api.unsplash.com/photos/1/download",
    });
  });

  it("reports a failed request", async () => {
    const result = await fetchWallpaper(
      { terms: ["x"], accessKey: "k" },
      { fetch: () => Promise.resolve(response({}, false)) },
    );
    expect(result.ok).toBe(false);
  });
});

describe("triggerDownload", () => {
  it("pings the download location with the key", async () => {
    let called = "";
    await triggerDownload("https://api.unsplash.com/photos/1/download", "KEY", {
      fetch: (url) => {
        called = url;
        return Promise.resolve(response({}));
      },
    });
    expect(called).toContain("client_id=KEY");
  });
});

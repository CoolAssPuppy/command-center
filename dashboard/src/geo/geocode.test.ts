import { describe, expect, it } from "vitest";

import { buildSearchUrl, searchCities, type FetchResponseLike } from "./geocode";

const response = (body: unknown, ok = true): FetchResponseLike => ({
  ok,
  status: ok ? 200 : 500,
  json: () => Promise.resolve(body),
});

describe("buildSearchUrl", () => {
  it("encodes the query and sets the count", () => {
    const url = buildSearchUrl("São Paulo", 3);
    expect(url).toContain("name=S%C3%A3o+Paulo");
    expect(url).toContain("count=3");
  });
});

describe("searchCities", () => {
  it("returns empty for a blank query without fetching", async () => {
    let called = false;
    const result = await searchCities("   ", {
      fetch: () => {
        called = true;
        return Promise.resolve(response({}));
      },
    });
    expect(result.ok && result.value).toEqual([]);
    expect(called).toBe(false);
  });

  it("maps geocoding hits to zones with a timezone and coordinates", async () => {
    const body = {
      results: [
        {
          id: 1,
          name: "Lisbon",
          country: "Portugal",
          admin1: "Lisboa",
          timezone: "Europe/Lisbon",
          latitude: 38.72,
          longitude: -9.14,
        },
      ],
    };
    const result = await searchCities("Lisbon", {
      fetch: () => Promise.resolve(response(body)),
    });
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.value[0]).toMatchObject({
      label: "Lisbon, Lisboa, Portugal",
      name: "Lisbon",
      timeZone: "Europe/Lisbon",
      lat: 38.72,
      lon: -9.14,
    });
  });

  it("handles a response with no results", async () => {
    const result = await searchCities("zzzzz", {
      fetch: () => Promise.resolve(response({})),
    });
    expect(result.ok && result.value).toEqual([]);
  });

  it("reports a failed request", async () => {
    const result = await searchCities("x", {
      fetch: () => Promise.resolve(response({}, false)),
    });
    expect(result.ok).toBe(false);
  });
});

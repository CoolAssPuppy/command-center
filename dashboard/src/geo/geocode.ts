import { z } from "zod";

import { firstIssue, type ParseResult } from "../domain/result";

/**
 * City search via Open-Meteo's free geocoding API (no key). The edit pane uses
 * it to add a timezone the user types: a match carries the IANA time zone and
 * coordinates, so the new zone gets a correct clock and weather. The fetch is
 * injected so the client is tested without a network.
 */
const SEARCH_BASE = "https://geocoding-api.open-meteo.com/v1/search";

export interface GeoResult {
  id: string;
  /** A disambiguated label, e.g. "Lisbon, Portugal". */
  label: string;
  name: string;
  country?: string;
  timeZone: string;
  lat: number;
  lon: number;
}

export interface FetchResponseLike {
  ok: boolean;
  status: number;
  json(): Promise<unknown>;
}

export type FetchLike = (url: string) => Promise<FetchResponseLike>;

const ResultSchema = z.object({
  id: z.number().optional(),
  name: z.string(),
  country: z.string().optional(),
  admin1: z.string().optional(),
  timezone: z.string(),
  latitude: z.number(),
  longitude: z.number(),
});

const ResponseSchema = z.object({
  results: z.array(ResultSchema).optional(),
});

export function buildSearchUrl(query: string, count = 6): string {
  const url = new URL(SEARCH_BASE);
  url.searchParams.set("name", query);
  url.searchParams.set("count", String(count));
  url.searchParams.set("language", "en");
  url.searchParams.set("format", "json");
  return url.toString();
}

export async function searchCities(
  query: string,
  deps: { fetch: FetchLike },
): Promise<ParseResult<GeoResult[]>> {
  const trimmed = query.trim();
  if (trimmed.length === 0) return { ok: true, value: [] };

  let body: unknown;
  try {
    const response = await deps.fetch(buildSearchUrl(trimmed));
    if (!response.ok) {
      return { ok: false, error: `geocoding failed (${response.status})` };
    }
    body = await response.json();
  } catch (cause) {
    const message = cause instanceof Error ? cause.message : "geocoding failed";
    return { ok: false, error: message };
  }

  const parsed = ResponseSchema.safeParse(body);
  if (!parsed.success) {
    return { ok: false, error: firstIssue(parsed.error, "invalid geocoding response") };
  }

  const results = (parsed.data.results ?? []).map((raw, index): GeoResult => {
    const label = [raw.name, raw.admin1, raw.country].filter(Boolean).join(", ");
    const result: GeoResult = {
      id: raw.id !== undefined ? String(raw.id) : `${raw.name}-${index}`,
      label,
      name: raw.name,
      timeZone: raw.timezone,
      lat: raw.latitude,
      lon: raw.longitude,
    };
    if (raw.country !== undefined) result.country = raw.country;
    return result;
  });

  return { ok: true, value: results };
}

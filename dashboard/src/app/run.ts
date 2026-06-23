import { loadCachedConfig, saveCachedConfig } from "../config/cache";
import { type Config, type Secrets } from "../config/schema";
import type { ConfigStore } from "../config/store";
import type { ParseResult } from "../domain/result";
import { openEditPane } from "../edit/editPane";
import { searchCities as geoSearch, type GeoResult } from "../geo/geocode";
import { prefersReducedMotion } from "../perf/perf";
import {
  renderDashboard,
  type DashboardDeps,
  type DashboardModel,
} from "../shell/dashboard";
import { loadStreamState, saveStreamState } from "../streams/streamState";
import type { Theme } from "../theme/tokens";
import type { FetchLike } from "../wallpaper/unsplash";
import { resolveWallpaper } from "../wallpaper/wallpaper";
import {
  fetchWeather as openMeteoFetch,
  type Weather,
  type WeatherLocation,
  type WeatherUnits,
} from "../weather/openMeteo";

/**
 * App orchestration, extracted so it is testable without a browser shell. It
 * paints instantly from the cached config, then loads the authoritative config
 * and repaints, then fetches weather for located zones and repaints again. An
 * optional ticker repaints each minute so the clock stays live. Everything async
 * or environment-bound is injectable.
 */
type WeatherFetcher = (
  location: WeatherLocation,
  units: WeatherUnits,
) => Promise<ParseResult<Weather>>;

export interface RunDeps {
  mount: HTMLElement;
  store: ConfigStore;
  now: () => Date;
  navigate: (url: string) => void;
  fetchWeather?: WeatherFetcher;
  loadCache?: () => Config | undefined;
  saveCache?: (config: Config) => void;
  /** Register a repeating callback (the minute ticker). Omitted in tests. */
  scheduleTick?: (cb: () => void) => void;
  reducedMotion?: boolean;
  theme?: Theme;
  units?: WeatherUnits;
  /** Where the edit pane mounts. Defaults to document.body. */
  editHost?: HTMLElement;
  /** City search for the edit pane. Defaults to the Open-Meteo geocoder. */
  searchCities?: (query: string) => Promise<GeoResult[]>;
  /** Fetch used for the Unsplash wallpaper. Defaults to the global fetch. */
  unsplashFetch?: FetchLike;
}

interface LocatedZone {
  id: string;
  label: string;
  lat: number;
  lon: number;
}

export async function runDashboard(deps: RunDeps): Promise<void> {
  const reducedMotion = deps.reducedMotion ?? prefersReducedMotion();
  const loadCache = deps.loadCache ?? ((): Config | undefined => loadCachedConfig());
  const saveCache = deps.saveCache ?? ((config: Config): void => saveCachedConfig(config));
  const fetchWeather =
    deps.fetchWeather ??
    ((location, units): Promise<ParseResult<Weather>> =>
      openMeteoFetch(location, units, { fetch: (url) => fetch(url) }));

  let config: Config | undefined;
  let streamExpanded = loadStreamState();
  let wallpaperPhoto:
    | { imageUrl: string; authorName: string; authorUrl: string }
    | undefined;
  const weatherByZone: Record<string, Weather> = {};

  const searchCities =
    deps.searchCities ??
    ((query: string): Promise<GeoResult[]> =>
      geoSearch(query, { fetch: (url) => fetch(url) }).then((result) =>
        result.ok ? result.value : [],
      ));

  function paint(): void {
    if (config === undefined) return;
    const model: DashboardModel = { now: deps.now(), config };
    if (Object.keys(weatherByZone).length > 0) {
      model.weatherByZone = { ...weatherByZone };
    }
    model.streamExpanded = streamExpanded;
    if (wallpaperPhoto !== undefined) model.wallpaper = wallpaperPhoto;
    const renderDeps: DashboardDeps = {
      navigate: deps.navigate,
      reducedMotion,
      onEdit: openEdit,
      onToggleStream: (streamId, open) => {
        streamExpanded = { ...streamExpanded, [streamId]: open };
        saveStreamState(streamExpanded);
      },
    };
    if (deps.theme !== undefined) renderDeps.theme = deps.theme;
    renderDashboard(deps.mount, model, renderDeps);
  }

  function openEdit(): void {
    const current = config;
    if (current === undefined) return;
    const editHost = deps.editHost ?? document.body;
    void deps.store.loadSecrets().then((secrets) => {
      openEditPane(editHost, {
        config: current,
        secrets,
        applyConfig: (next) => {
          config = next;
          void deps.store.save(next);
          saveCache(next);
          paint();
          void resolveAndPaintWallpaper();
        },
        applySecrets: (next) => {
          void deps.store.saveSecrets(next);
          void resolveAndPaintWallpaper(next);
        },
        onClose: () => {
          /* nothing to do; the dashboard already reflects the latest config */
        },
        runtime: { searchCities },
      });
    });
  }

  async function resolveAndPaintWallpaper(secretsOverride?: Secrets): Promise<void> {
    if (config === undefined) return;
    if (!config.wallpaper.enabled || config.wallpaper.terms.length === 0) {
      if (wallpaperPhoto !== undefined) {
        wallpaperPhoto = undefined;
        paint();
      }
      return;
    }
    const secrets = secretsOverride ?? (await deps.store.loadSecrets());
    const accessKey = secrets.unsplashAccessKey;
    if (accessKey === undefined || accessKey.length === 0) return;
    const dateKey = deps.now().toISOString().slice(0, 10);
    const photo = await resolveWallpaper(
      { terms: config.wallpaper.terms, accessKey, dateKey },
      { fetch: deps.unsplashFetch ?? ((url) => fetch(url)) },
    );
    if (photo !== undefined) {
      wallpaperPhoto = {
        imageUrl: photo.imageUrl,
        authorName: photo.authorName,
        authorUrl: photo.authorUrl,
      };
      paint();
    }
  }

  // 1. Instant paint from the cached config, if any (runs before the first await).
  const cached = loadCache();
  if (cached !== undefined) {
    config = cached;
    paint();
  }

  // 2. The authoritative config from storage.
  config = await deps.store.load();
  saveCache(config);
  paint();

  // 3. Keep the clock live.
  if (deps.scheduleTick !== undefined) {
    deps.scheduleTick(paint);
  }

  // 4. Wallpaper, when enabled and an Unsplash key is set.
  await resolveAndPaintWallpaper();

  // 5. Weather for zones that carry coordinates.
  const located: LocatedZone[] = config.zones.flatMap((zone) =>
    zone.lat !== undefined && zone.lon !== undefined
      ? [{ id: zone.id, label: zone.label, lat: zone.lat, lon: zone.lon }]
      : [],
  );
  if (located.length === 0) return;

  const units: WeatherUnits = deps.units ?? "fahrenheit";
  const results = await Promise.all(
    located.map(async (zone) => {
      const result = await fetchWeather(
        { label: zone.label, lat: zone.lat, lon: zone.lon },
        units,
      );
      return { id: zone.id, result };
    }),
  );

  let changed = false;
  for (const { id, result } of results) {
    if (result.ok) {
      weatherByZone[id] = result.value;
      changed = true;
    }
  }
  if (changed) paint();
}

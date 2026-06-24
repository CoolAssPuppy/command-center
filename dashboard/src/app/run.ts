import { loadCachedConfig, saveCachedConfig } from "../config/cache";
import { type Config, type Secrets } from "../config/schema";
import type { ConfigStore } from "../config/store";
import type { ParseResult } from "../domain/result";
import { openEditPane } from "../edit/editPane";
import { searchCities as geoSearch, type GeoResult } from "../geo/geocode";
import {
  connectGoogle,
  getGoogleToken,
  isGoogleAuthAvailable,
} from "../integrations/googleAuth";
import { realHttpFetch } from "../integrations/http";
import { integrationById } from "../integrations/registry";
import {
  NEEDS_AUTH,
  type HttpFetch,
  type IntegrationContext,
  type IntegrationResult,
} from "../integrations/types";
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
  /** HTTP client used by integrations. Defaults to the real one. */
  httpFetch?: HttpFetch;
  /** OAuth token getter for integrations. Defaults to chrome.identity (Google). */
  getAuthToken?: (provider: string) => Promise<string | undefined>;
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
    | { imageUrl: string; authorName?: string; authorUrl?: string }
    | undefined;
  let integrationResults: Record<string, IntegrationResult> = {};
  const weatherByZone: Record<string, Weather> = {};
  // Stable for this page load, so the "on new tab" wallpaper holds across config
  // edits within the same tab and only changes when the tab is reopened.
  const pageLoadKey = deps.now().toISOString();

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
    model.integrationResults = integrationResults;
    if (wallpaperPhoto !== undefined) model.wallpaper = wallpaperPhoto;
    const renderDeps: DashboardDeps = {
      navigate: deps.navigate,
      reducedMotion,
      onEdit: openEdit,
      onToggleStream: (streamId, open) => {
        streamExpanded = { ...streamExpanded, [streamId]: open };
        saveStreamState(streamExpanded);
      },
      onReorder: reorderConfigGroup,
    };
    if (deps.theme !== undefined) renderDeps.theme = deps.theme;
    renderDashboard(deps.mount, model, renderDeps);
  }

  function openEdit(): void {
    const current = config;
    if (current === undefined) return;
    const editHost = deps.editHost ?? document.body;
    // Don't stack panes if one is already open.
    if (editHost.querySelector(".cc-edit") !== null) return;
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
          void refreshIntegrations();
          void refreshWeather();
        },
        applySecrets: (next) => {
          void deps.store.saveSecrets(next);
          void resolveAndPaintWallpaper(next);
          void refreshIntegrations();
        },
        onClose: () => {
          /* nothing to do; the dashboard already reflects the latest config */
        },
        runtime: {
          searchCities,
          // Only offer Google sign-in where chrome.identity exists (the
          // installed extension). On the dev server the section shows a hint.
          ...(isGoogleAuthAvailable()
            ? {
                connectGoogle: async (): Promise<void> => {
                  const token = await connectGoogle();
                  if (token !== undefined) await refreshIntegrations();
                },
              }
            : {}),
        },
      });
    });
  }

  function clearWallpaper(): void {
    if (wallpaperPhoto !== undefined) {
      wallpaperPhoto = undefined;
      paint();
    }
  }

  async function resolveAndPaintWallpaper(secretsOverride?: Secrets): Promise<void> {
    if (config === undefined) return;
    const wallpaper = config.wallpaper;

    if (wallpaper.source === "custom") {
      const url = wallpaper.customUrl;
      if (url !== undefined && url.length > 0) {
        wallpaperPhoto = { imageUrl: url };
        paint();
      } else {
        clearWallpaper();
      }
      return;
    }

    if (wallpaper.source !== "unsplash") {
      clearWallpaper();
      return;
    }

    const secrets = secretsOverride ?? (await deps.store.loadSecrets());
    const accessKey = secrets.unsplashAccessKey;
    if (accessKey === undefined || accessKey.length === 0) {
      clearWallpaper();
      return;
    }
    const now = deps.now().toISOString();
    const dateKey =
      wallpaper.frequency === "never"
        ? "never"
        : wallpaper.frequency === "newtab"
          ? pageLoadKey
          : wallpaper.frequency === "hourly"
            ? now.slice(0, 13)
            : now.slice(0, 10);
    const photo = await resolveWallpaper(
      { terms: wallpaper.terms, accessKey, dateKey },
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

  async function refreshIntegrations(): Promise<void> {
    if (config === undefined) return;
    // Only fetch connections a stream actually shows. Keyed by connection id.
    const usedIds = new Set(config.streams.map((stream) => stream.connectionId));
    const connections = config.connections.filter((connection) =>
      usedIds.has(connection.id),
    );
    if (connections.length === 0) {
      if (Object.keys(integrationResults).length > 0) {
        integrationResults = {};
        paint();
      }
      return;
    }

    const secrets = await deps.store.loadSecrets();
    const getAuthToken =
      deps.getAuthToken ??
      ((provider: string): Promise<string | undefined> =>
        provider === "google" ? getGoogleToken() : Promise.resolve(undefined));
    const ctx: IntegrationContext = {
      fetch: deps.httpFetch ?? realHttpFetch,
      now: deps.now(),
      getAuthToken,
    };

    const next: Record<string, IntegrationResult> = {};
    for (const connection of connections) {
      next[connection.id] = integrationResults[connection.id] ?? { status: "loading" };
    }
    integrationResults = next;
    paint();

    await Promise.all(
      connections.map(async (connection) => {
        const integration = integrationById(connection.service);
        if (integration === undefined) {
          integrationResults[connection.id] = { status: "error", error: "Unknown service" };
          return;
        }
        const secret = secrets.connectionSecrets[connection.id];
        const result = await integration.fetch(connection, secret, ctx);
        if (result.ok) {
          integrationResults[connection.id] = { status: "ok", items: result.value };
        } else if (result.error === NEEDS_AUTH) {
          integrationResults[connection.id] = { status: "needs_auth" };
        } else {
          integrationResults[connection.id] = { status: "error", error: result.error };
        }
      }),
    );
    paint();
  }

  /**
   * Fetch weather for every located zone and repaint. Re-run whenever the zones
   * change (a new home city, an added zone), since a zone added after first
   * paint has no weather yet. A zone without coordinates is skipped.
   */
  async function refreshWeather(): Promise<void> {
    if (config === undefined) return;
    const located: LocatedZone[] = config.zones.flatMap((zone) =>
      zone.lat !== undefined && zone.lon !== undefined
        ? [{ id: zone.id, label: zone.label, lat: zone.lat, lon: zone.lon }]
        : [],
    );
    if (located.length === 0) return;

    const units: WeatherUnits = deps.units ?? config.weather.unit;
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

  /**
   * Reorder one config group by moving an item to another's position, then
   * persist and repaint. Driven by dragging items on the dashboard; the edit
   * pane reads the same arrays, so both stay in sync. Reordering is by id, so it
   * is unaffected by the home zone being excluded from the dashboard row.
   */
  function reorderConfigGroup(
    group: "zones" | "streams" | "links",
    fromId: string,
    toId: string,
  ): void {
    if (config === undefined) return;
    const move = <T extends { id: string }>(items: T[]): boolean => {
      const from = items.findIndex((item) => item.id === fromId);
      const to = items.findIndex((item) => item.id === toId);
      if (from < 0 || to < 0 || from === to) return false;
      const [moved] = items.splice(from, 1);
      if (moved === undefined) return false;
      items.splice(to, 0, moved);
      return true;
    };
    const changed =
      group === "zones"
        ? move(config.zones)
        : group === "streams"
          ? move(config.streams)
          : move(config.links);
    if (changed) {
      void deps.store.save(config);
      saveCache(config);
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

  // 5. Integration streams (Notion and friends).
  void refreshIntegrations();

  // 6. Weather for zones that carry coordinates.
  await refreshWeather();
}

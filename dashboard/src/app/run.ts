import { loadCachedConfig, saveCachedConfig } from "../config/cache";
import {
  CARD_CONFIG_KEYS,
  COMBINED_CALENDARS_ID,
  type Config,
  type Connection,
  type GoogleToken,
  type IntegrationSource,
  type Secrets,
  type SourceConfig,
  type Stream,
} from "../config/schema";
import { combineCalendars, resolveCombineTargets } from "../integrations/combine";
import { fetchGoogleCalendarList } from "../integrations/googleCalendarList";
import { moveCard } from "../shell/cardMove";
import { fetchStockQuotes, type StockQuote } from "../integrations/finnhub";
import { fetchForexQuotes, splitSymbols } from "../integrations/forex";
import { fetchNews, type NewsItem } from "../integrations/news";
import {
  loadTickerMode,
  saveTickerMode,
  type TickerMode,
} from "../shell/tickerModeState";
import {
  demoCombinedCalendars,
  demoNews,
  demoResultFor,
  demoStocks,
  demoWeatherFor,
  isDemoMode,
  setDemoMode,
} from "./demo";
import type { ConfigStore } from "../config/store";
import type { ParseResult } from "../domain/result";
import { openEditPane } from "../edit/editPane";
import { searchCities as geoSearch, type GeoResult } from "../geo/geocode";
import {
  authorizeGoogleAccount,
  isGoogleOAuthAvailable,
} from "../integrations/googleOAuth";
import { resolveGoogleTokens } from "../integrations/googleTokens";
import { realHttpFetch } from "../integrations/http";
import { integrationById } from "../integrations/registry";
import {
  NEEDS_AUTH,
  type HttpFetch,
  type IntegrationContext,
  type IntegrationResult,
} from "../integrations/types";
import { prefersReducedMotion } from "../perf/perf";
import { analyzePhotoTone } from "../wallpaper/brightness";
import {
  renderDashboard,
  type DashboardDeps,
  type DashboardModel,
} from "../shell/dashboard";
import { loadStreamState, saveStreamState } from "../streams/streamState";
import {
  loadTaskFilterState,
  saveTaskFilterState,
  type TaskFilterState,
} from "../shell/taskFilterState";
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
  /** OAuth token getter for integrations. Defaults to chrome.identity (Google).
   *  The optional connectionId selects a per-account token, matching
   *  IntegrationContext.getAuthToken so an injected getter can pick an account. */
  getAuthToken?: (provider: string, connectionId?: string) => Promise<string | undefined>;
}

interface LocatedZone {
  id: string;
  label: string;
  lat: number;
  lon: number;
}

/**
 * Fire-and-forget a persistence write, but surface a failure instead of losing
 * it silently. A rejected chrome.storage write (quota, offline, rate-limited)
 * otherwise vanishes as an unhandled rejection and the user never learns the
 * edit did not persist.
 */
function persist(write: Promise<void>, what: string): void {
  void write.catch((error: unknown) => {
    console.warn(`Command Center could not save ${what}.`, error);
  });
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
  let taskFilter: TaskFilterState = loadTaskFilterState();
  let tickerMode: TickerMode = loadTickerMode();
  let wallpaperPhoto:
    | {
        imageUrl: string;
        authorName?: string;
        authorUrl?: string;
        tone?: "light" | "dark";
      }
    | undefined;
  let integrationResults: Record<string, IntegrationResult> = {};
  // Bumped on each integration refresh so a slow in-flight run can tell it has
  // been superseded and not write stale results over a newer run's.
  let integrationsRunToken = 0;
  let tickerStocks: StockQuote[] = [];
  let tickerStocksNeedKey = false;
  let tickerNews: NewsItem[] = [];
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
    model.taskFilter = taskFilter;
    model.integrationResults = integrationResults;
    // Always thread the ticker data (even when empty) so an enabled-but-empty
    // strip can show its hint rather than vanishing. Enabled state rides on
    // model.config.tickers, which the shell reads directly.
    model.tickerStocks = tickerStocks;
    model.tickerStocksNeedKey = tickerStocksNeedKey;
    model.tickerNews = tickerNews;
    model.tickerMode = tickerMode;
    if (wallpaperPhoto !== undefined) model.wallpaper = wallpaperPhoto;
    const renderDeps: DashboardDeps = {
      navigate: deps.navigate,
      reducedMotion,
      onEdit: openEdit,
      onToggleStream: (streamId, open) => {
        streamExpanded = { ...streamExpanded, [streamId]: open };
        saveStreamState(streamExpanded);
      },
      // Persist the new filter so the next repaint keeps it. The lane updates its
      // own list in place, so no repaint is forced here (which would close the
      // popover mid-adjustment).
      onTaskFilterChange: (state) => {
        taskFilter = state;
        saveTaskFilterState(state);
      },
      // The strip updates its own deltas in place, so just persist the choice.
      onTickerModeChange: (mode) => {
        tickerMode = mode;
        saveTickerMode(mode);
      },
      onReorder: reorderConfigGroup,
      onMoveCard: moveCardOnSurface,
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
          persist(deps.store.save(next), "your settings");
          saveCache(next);
          paint();
          void resolveAndPaintWallpaper();
          void refreshIntegrations();
          void refreshWeather();
          void refreshTickers();
        },
        applySecrets: (next) => {
          persist(deps.store.saveSecrets(next), "your credentials");
          void resolveAndPaintWallpaper(next);
          void refreshIntegrations();
          void refreshTickers();
        },
        onClose: () => {
          /* nothing to do; the dashboard already reflects the latest config */
        },
        runtime: {
          searchCities,
          // Screenshot mode: flip the device-local flag, then re-run every feed
          // so the dashboard fills with (or clears back from) sample data live.
          onScreenshotMode: (on: boolean): void => {
            setDemoMode(on);
            void refreshIntegrations();
            void refreshWeather();
            void refreshTickers();
            paint();
          },
          // Only offer Google sign-in where chrome.identity exists and a client
          // id is configured. Elsewhere the connection row shows a hint. The
          // chosen account's token is returned for the section to store against
          // the connection; persisting it triggers a refresh.
          ...(isGoogleOAuthAvailable()
            ? {
                connectGoogleAccount: (
                  _connectionId: string,
                ): Promise<GoogleToken | undefined> =>
                  authorizeGoogleAccount({ interactive: true }),
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
      const resolved = {
        imageUrl: photo.imageUrl,
        authorName: photo.authorName,
        authorUrl: photo.authorUrl,
      };
      wallpaperPhoto = resolved;
      paint();
      // Strengthen the scrim over a light photo so the hero isn't washed out.
      void analyzePhotoTone(resolved.imageUrl).then((tone) => {
        if (wallpaperPhoto?.imageUrl === resolved.imageUrl) {
          wallpaperPhoto = { ...wallpaperPhoto, tone };
          paint();
        }
      });
    }
  }

  /** The per-card config a Data Card layers onto its base connection. */
  function cardConfig(stream: Stream): SourceConfig {
    const out: Record<string, unknown> = {};
    for (const key of CARD_CONFIG_KEYS) {
      if (stream[key] !== undefined) out[key] = stream[key];
    }
    return out;
  }

  async function refreshIntegrations(): Promise<void> {
    if (config === undefined) return;
    const runToken = ++integrationsRunToken;
    const isCurrent = (): boolean => runToken === integrationsRunToken;

    const connectionById = new Map<string, Connection>(
      config.connections.map((connection) => [connection.id, connection]),
    );
    // Cards that fetch on their own (everything but the combined virtual id).
    const cards = config.streams.filter(
      (stream) =>
        stream.connectionId !== COMBINED_CALENDARS_ID &&
        connectionById.has(stream.connectionId),
    );
    const usesCombine = config.streams.some(
      (stream) => stream.connectionId === COMBINED_CALENDARS_ID,
    );
    const calendarConnections = config.connections.filter(
      (connection) => connection.service === "google-calendar",
    );

    // Demo mode: serve canned data so the cards look full for a screenshot.
    if (isDemoMode()) {
      const demo: Record<string, IntegrationResult> = {};
      for (const stream of cards) {
        const connection = connectionById.get(stream.connectionId);
        if (connection !== undefined) {
          demo[stream.id] = demoResultFor(connection.service, deps.now(), stream.role);
        }
      }
      if (usesCombine) demo[COMBINED_CALENDARS_ID] = demoCombinedCalendars(deps.now());
      integrationResults = demo;
      paint();
      return;
    }

    if (cards.length === 0 && !usesCombine) {
      if (Object.keys(integrationResults).length > 0) {
        integrationResults = {};
        paint();
      }
      return;
    }

    const secrets = await deps.store.loadSecrets();
    // Google tokens are per account (connection). Resolve those backing a card,
    // plus every calendar account when the combined card is present. Injected
    // getAuthToken (tests) takes over.
    let getAuthToken = deps.getAuthToken;
    if (getAuthToken === undefined) {
      const googleConnections = usesCombine
        ? calendarConnections
        : calendarConnections.filter((connection) =>
            cards.some((stream) => stream.connectionId === connection.id),
          );
      const resolution = await resolveGoogleTokens(
        googleConnections,
        secrets,
        deps.now().getTime(),
        authorizeGoogleAccount,
      );
      if (resolution.changed) {
        persist(deps.store.saveSecrets(resolution.secrets), "your credentials");
      }
      const googleTokenByConn = resolution.tokens;
      getAuthToken = (
        provider: string,
        connectionId?: string,
      ): Promise<string | undefined> =>
        Promise.resolve(
          provider === "google" && connectionId !== undefined
            ? googleTokenByConn[connectionId]
            : undefined,
        );
    }
    const ctx: IntegrationContext = {
      fetch: deps.httpFetch ?? realHttpFetch,
      now: deps.now(),
      getAuthToken,
    };

    // Seed loading state per card (by stream id) for an instant paint.
    const next: Record<string, IntegrationResult> = {};
    for (const stream of cards) {
      next[stream.id] = integrationResults[stream.id] ?? { status: "loading" };
    }
    if (usesCombine) {
      next[COMBINED_CALENDARS_ID] =
        integrationResults[COMBINED_CALENDARS_ID] ?? { status: "loading" };
    }
    integrationResults = next;
    paint();

    const fetchSource = async (
      source: IntegrationSource,
      credentialId: string,
    ): Promise<IntegrationResult> => {
      const integration = integrationById(source.service);
      if (integration === undefined) return { status: "error", error: "Unknown service" };
      const secret = secrets.connectionSecrets[credentialId];
      const result = await integration.fetch(source, secret, ctx);
      if (result.ok) return { status: "ok", items: result.value };
      if (result.error === NEEDS_AUTH) return { status: "needs_auth" };
      return { status: "error", error: result.error };
    };

    await Promise.all(
      cards.map(async (stream) => {
        const connection = connectionById.get(stream.connectionId);
        if (connection === undefined) return;
        const source: IntegrationSource = { ...connection, ...cardConfig(stream) };
        const result = await fetchSource(source, connection.id);
        // A newer refresh may have replaced integrationResults while this fetch
        // was in flight; don't write a stale result into it.
        if (isCurrent()) integrationResults[stream.id] = result;
      }),
    );
    if (!isCurrent()) return;

    if (usesCombine) {
      const combineCard = config.streams.find(
        (stream) => stream.connectionId === COMBINED_CALENDARS_ID,
      );
      // Resolve the calendars to merge: the card's stored selection if it has one,
      // otherwise every calendar from every account (discovered per account).
      const targets = await resolveCombineTargets(
        combineCard?.combineCalendars ?? [],
        calendarConnections.map((connection) => connection.id),
        async (connectionId) => {
          const token = await ctx.getAuthToken?.("google", connectionId);
          if (token === undefined || token.length === 0) return undefined;
          const list = await fetchGoogleCalendarList(ctx.fetch, token);
          return list?.map((entry) => entry.id);
        },
      );
      // One fetch per account (its token reads every chosen calendar in one call).
      // A failing account yields a non-ok result that combineCalendars tolerates.
      const calendarResults = await Promise.all(
        targets.map((target) => {
          const connection = connectionById.get(target.connectionId);
          if (connection === undefined) return Promise.resolve(undefined);
          return fetchSource({ ...connection, calendarIds: target.calendarIds }, connection.id);
        }),
      );
      if (!isCurrent()) return;
      integrationResults[COMBINED_CALENDARS_ID] = combineCalendars(calendarResults);
    }
    paint();
  }

  /**
   * Fetch the ambient ticker data when enabled: stock quotes (needs a Finnhub
   * key) and news headlines (no key). Failures are swallowed inside the fetchers
   * and simply leave that strip empty, since the ticker is glance-only.
   */
  async function refreshTickers(): Promise<void> {
    if (config === undefined) return;
    const { stocks, news } = config.tickers;
    const httpFetch = deps.httpFetch ?? realHttpFetch;

    // Screenshot mode: serve canned quotes and headlines for the enabled strips.
    if (isDemoMode()) {
      tickerStocks = stocks.enabled ? demoStocks : [];
      tickerStocksNeedKey = false;
      tickerNews = news.enabled ? demoNews : [];
      paint();
      return;
    }

    if (stocks.enabled && stocks.symbols.length > 0) {
      // Currency pairs go to the keyless forex source; everything else to
      // Finnhub (which needs a key). Forex still works without a key.
      const { forex, stocks: stockSymbols } = splitSymbols(stocks.symbols);
      const key = (await deps.store.loadSecrets()).finnhubKey;
      // Equity symbols are configured but no key is set, so they cannot be fetched.
      tickerStocksNeedKey =
        stockSymbols.length > 0 && (key === undefined || key.trim().length === 0);
      const [equities, currencies] = await Promise.all([
        stockSymbols.length > 0 && key !== undefined && key.trim().length > 0
          ? fetchStockQuotes(stockSymbols, key, httpFetch)
          : Promise.resolve([]),
        forex.length > 0 ? fetchForexQuotes(forex, httpFetch) : Promise.resolve([]),
      ]);
      tickerStocks = [...equities, ...currencies];
    } else {
      tickerStocks = [];
      tickerStocksNeedKey = false;
    }

    tickerNews = news.enabled ? await fetchNews(httpFetch, news.sources) : [];

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

    // Screenshot mode: give every located zone canned weather, no network.
    if (isDemoMode()) {
      located.forEach((zone, index) => {
        weatherByZone[zone.id] = demoWeatherFor(index, deps.now(), units);
      });
      paint();
      return;
    }

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
      persist(deps.store.save(config), "your layout");
      saveCache(config);
      paint();
    }
  }

  /**
   * Place a data card on the surface: set its column and order from an on-surface
   * drag or keyboard move. This owns the new-tab layout (the Customize pane's list
   * reorder is cosmetic and does not reach here). A no-op returns the same array.
   */
  function moveCardOnSurface(
    cardId: string,
    column: "left" | "right",
    beforeId: string | null,
  ): void {
    if (config === undefined) return;
    const next = moveCard(config.streams, cardId, column, beforeId);
    if (next === config.streams) return;
    config.streams = next;
    persist(deps.store.save(config), "your layout");
    saveCache(config);
    paint();
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

  // 7. Ambient tickers (stocks and news), when enabled.
  void refreshTickers();
}

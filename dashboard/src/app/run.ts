import type { DashboardBridge } from "../bridge/types";
import { buildDashboardModel, type DashboardData } from "../dashboard/model";
import { prefersReducedMotion } from "../perf/perf";
import {
  loadCachedPayload,
  saveCachedPayload,
} from "../shell/cache";
import {
  renderDashboard,
  type DashboardDeps,
  type DashboardModel,
} from "../shell/dashboard";
import type { ParseResult } from "../domain/feed";
import type { Theme } from "../theme/tokens";
import {
  fetchWeather as openMeteoFetch,
  type Weather,
  type WeatherLocation,
  type WeatherUnits,
} from "../weather/openMeteo";

/**
 * The app orchestration, extracted so it is testable without a browser shell.
 * It paints instantly from cache, then renders live bridge data and caches it,
 * then fetches weather and repaints. Everything async is injectable.
 */

type WeatherFetcher = (
  location: WeatherLocation,
  units: WeatherUnits,
) => Promise<ParseResult<Weather>>;

export interface RunDeps {
  mount: HTMLElement;
  bridge: DashboardBridge;
  now: () => Date;
  navigate: (url: string) => void;
  fetchWeather?: WeatherFetcher;
  loadCache?: () => unknown;
  saveCache?: (payload: unknown) => void;
  reducedMotion?: boolean;
  timeZone?: string;
  theme?: Theme;
}

export async function runDashboard(deps: RunDeps): Promise<void> {
  const now = deps.now();
  const reducedMotion = deps.reducedMotion ?? prefersReducedMotion();
  const loadCache = deps.loadCache ?? loadCachedPayload;
  const saveCache = deps.saveCache ?? saveCachedPayload;
  const fetchWeather =
    deps.fetchWeather ??
    ((location, units) => openMeteoFetch(location, units, { fetch: (url) => fetch(url) }));

  let data: DashboardData | undefined;
  let weather: Weather | undefined;

  const paint = (): void => {
    if (data === undefined) return;
    const model: DashboardModel = {
      now,
      settings: data.settings ?? {},
      cards: data.cards,
    };
    if (weather !== undefined) model.weather = weather;

    const renderDeps: DashboardDeps = { navigate: deps.navigate, reducedMotion };
    if (deps.timeZone !== undefined) renderDeps.timeZone = deps.timeZone;
    if (deps.theme !== undefined) renderDeps.theme = deps.theme;
    renderDashboard(deps.mount, model, renderDeps);
  };

  // 1. Instant paint from the last cached payload, if any.
  const cached = loadCache();
  if (cached !== null && cached !== undefined) {
    const model = buildDashboardModel(cached, now);
    if (model.ok) {
      data = model.value;
      paint();
    }
  }

  // 2. Live data from the bridge.
  let payload: unknown = null;
  try {
    payload = await deps.bridge.getDashboard();
  } catch {
    payload = null;
  }
  if (payload !== null && payload !== undefined) {
    const model = buildDashboardModel(payload, now);
    if (model.ok) {
      saveCache(payload);
      data = model.value;
      paint();
    }
  }

  // 3. Weather, then repaint.
  const weatherConfig = data?.settings?.weather;
  if (weatherConfig !== undefined) {
    const result = await fetchWeather(weatherConfig.location, weatherConfig.units);
    if (result.ok) {
      weather = result.value;
      paint();
    }
  }
}

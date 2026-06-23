import { loadCachedConfig, saveCachedConfig } from "../config/cache";
import { type Config } from "../config/schema";
import type { ConfigStore } from "../config/store";
import type { ParseResult } from "../domain/result";
import { prefersReducedMotion } from "../perf/perf";
import {
  renderDashboard,
  type DashboardDeps,
  type DashboardModel,
} from "../shell/dashboard";
import type { Theme } from "../theme/tokens";
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
  onEdit?: () => void;
  units?: WeatherUnits;
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
  const weatherByZone: Record<string, Weather> = {};

  const paint = (): void => {
    if (config === undefined) return;
    const model: DashboardModel = { now: deps.now(), config };
    if (Object.keys(weatherByZone).length > 0) {
      model.weatherByZone = { ...weatherByZone };
    }
    const renderDeps: DashboardDeps = { navigate: deps.navigate, reducedMotion };
    if (deps.theme !== undefined) renderDeps.theme = deps.theme;
    if (deps.onEdit !== undefined) renderDeps.onEdit = deps.onEdit;
    renderDashboard(deps.mount, model, renderDeps);
  };

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

  // 4. Weather for zones that carry coordinates.
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

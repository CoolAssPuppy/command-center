import type { PlacedCard } from "../dashboard/attention";
import type { Settings } from "../dashboard/payload";
import { defaultRenderContext } from "../render/context";
import { el } from "../render/helpers";
import { aurora } from "../theme/aurora";
import { applyTokens, type Theme } from "../theme/tokens";
import type { Weather } from "../weather/openMeteo";
import { renderCard, type CardDeps } from "./card";
import { renderHeader, type HeaderModel } from "./header";
import { renderWeather } from "./weather";
import { renderWorldClock } from "./worldclock";

export interface DashboardModel {
  now: Date;
  settings: Settings;
  cards: PlacedCard[];
  weather?: Weather;
}

export interface DashboardDeps {
  navigate: (url: string) => void;
  theme?: Theme;
  timeZone?: string;
  formatTime?: (iso: string) => string;
  reducedMotion?: boolean;
  allowedSchemes?: readonly string[];
}

function localTimeZone(): string {
  try {
    return Intl.DateTimeFormat().resolvedOptions().timeZone || "UTC";
  } catch {
    return "UTC";
  }
}

export function renderDashboard(
  root: HTMLElement,
  model: DashboardModel,
  deps: DashboardDeps,
): HTMLElement {
  const theme = deps.theme ?? aurora;
  const reducedMotion = deps.reducedMotion ?? false;
  applyTokens(root, theme.tokens, { reducedMotion });
  root.replaceChildren();
  root.classList.add("cc-dashboard");

  const timeZone =
    deps.timeZone ?? model.settings.worldClock?.baseTimeZone ?? localTimeZone();
  const formatTime = deps.formatTime ?? defaultRenderContext().formatTime;

  const headerModel: HeaderModel = { now: model.now, timeZone };
  if (model.settings.profile?.name !== undefined) {
    headerModel.name = model.settings.profile.name;
  }
  renderHeader(root, headerModel);

  const rail = el("div", "cc-rail");
  renderWeather(rail, model.weather);
  renderWorldClock(rail, {
    now: model.now,
    baseTimeZone: timeZone,
    cities: model.settings.worldClock?.cities ?? [],
  });
  root.appendChild(rail);

  const cardDeps: CardDeps = {
    navigate: deps.navigate,
    formatTime,
    reducedMotion,
  };
  if (deps.allowedSchemes !== undefined) cardDeps.allowedSchemes = deps.allowedSchemes;

  const grid = el("div", "cc-grid");
  for (const card of model.cards) renderCard(grid, card, cardDeps);
  root.appendChild(grid);

  return root;
}

import { CITIES } from "../cities/cities";
import type { PlacedCard } from "../dashboard/attention";
import type { Settings } from "../dashboard/payload";
import { defaultRenderContext } from "../render/context";
import { el } from "../render/helpers";
import { themeById } from "../theme/registry";
import { applyTokens, type Theme } from "../theme/tokens";
import type { Weather } from "../weather/openMeteo";
import { renderCard, type CardDeps } from "./card";
import { renderCityRow, type CityRowModel } from "./cityRow";
import { renderHeader, type HeaderModel } from "./header";
import { renderOverlapTimeline } from "./overlapTimeline";

export interface DashboardModel {
  now: Date;
  settings: Settings;
  cards: PlacedCard[];
  /** Current weather per city id for the hero row, filled in as fetches land. */
  weatherByCity?: Record<string, Weather>;
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

/** Column 1 stacks the calendar above reminders, in that order. */
const LEFT_COLUMN_KINDS = ["calendar.today", "reminders.today"];

interface DashboardColumns {
  left: PlacedCard[];
  middle: PlacedCard[];
  right: PlacedCard[];
}

/**
 * Route cards into the three columns: calendar then reminders on the left, the
 * Linear inbox on the right, recent documents and anything else in the middle.
 */
function toColumns(cards: PlacedCard[]): DashboardColumns {
  const columns: DashboardColumns = { left: [], middle: [], right: [] };
  for (const card of cards) {
    if (card.kind === "linear.inbox") columns.right.push(card);
    else if (LEFT_COLUMN_KINDS.includes(card.kind)) columns.left.push(card);
    else columns.middle.push(card);
  }
  columns.left.sort(
    (a, b) => LEFT_COLUMN_KINDS.indexOf(a.kind) - LEFT_COLUMN_KINDS.indexOf(b.kind),
  );
  return columns;
}

export function renderDashboard(
  root: HTMLElement,
  model: DashboardModel,
  deps: DashboardDeps,
): HTMLElement {
  const theme = deps.theme ?? themeById(model.settings.appearance?.theme);
  const reducedMotion = deps.reducedMotion ?? false;
  applyTokens(root, theme.tokens, { reducedMotion });
  root.replaceChildren();
  root.classList.add("cc-dashboard");

  // The header shows the viewer's own local time. An explicit deps.timeZone
  // (tests, or a future "home zone" setting) overrides it.
  const timeZone = deps.timeZone ?? localTimeZone();
  const formatTime = deps.formatTime ?? defaultRenderContext().formatTime;

  const headerModel: HeaderModel = { now: model.now, timeZone };
  if (model.settings.profile?.name !== undefined) {
    headerModel.name = model.settings.profile.name;
  }
  renderHeader(root, headerModel);

  const cityRowModel: CityRowModel = { now: model.now, cities: CITIES };
  if (model.weatherByCity !== undefined) {
    cityRowModel.weatherByCity = model.weatherByCity;
  }
  renderCityRow(root, cityRowModel);

  renderOverlapTimeline(root, {
    now: model.now,
    cities: CITIES,
    referenceTimeZone: timeZone,
  });

  const cardDeps: CardDeps = {
    navigate: deps.navigate,
    formatTime,
    reducedMotion,
  };
  if (deps.allowedSchemes !== undefined) cardDeps.allowedSchemes = deps.allowedSchemes;
  if (theme.renderers !== undefined) cardDeps.themeRenderers = theme.renderers;

  const columns = toColumns(model.cards);
  const grid = el("div", "cc-columns");
  for (const column of [columns.left, columns.middle, columns.right]) {
    const node = el("div", "cc-column");
    for (const card of column) renderCard(node, card, cardDeps);
    grid.appendChild(node);
  }
  root.appendChild(grid);

  return root;
}

import { homeZone, otherZones, type Config } from "../config/schema";
import { renderDock } from "../dock/dock";
import { el } from "../render/helpers";
import { themeById } from "../theme/registry";
import { applyTokens, type Theme } from "../theme/tokens";
import type { Weather } from "../weather/openMeteo";
import { renderHomeClock, type HomeClockModel } from "./homeClock";
import { renderZoneRow, type ZoneRowModel } from "./zoneRow";

/**
 * The new-tab composition. Everything is driven by the config: a wallpaper layer
 * behind, then a centered stage with the home clock, the timezone row, the dock,
 * and the work streams. Phases fill the dock and stream slots; the skeleton and
 * the timezones land first.
 */
export interface DashboardModel {
  now: Date;
  config: Config;
  /** Current weather per zone id, filled in as fetches land. */
  weatherByZone?: Record<string, Weather>;
}

export interface DashboardDeps {
  navigate: (url: string) => void;
  reducedMotion?: boolean;
  theme?: Theme;
  /** Open the edit pane. */
  onEdit?: () => void;
}

export function renderDashboard(
  root: HTMLElement,
  model: DashboardModel,
  deps: DashboardDeps,
): HTMLElement {
  const theme = deps.theme ?? themeById(model.config.appearance.theme);
  const reducedMotion = deps.reducedMotion ?? false;
  applyTokens(root, theme.tokens, { reducedMotion });
  root.replaceChildren();
  root.classList.add("cc-dashboard");

  // Background wallpaper layer. P4 paints it; here it is an empty, themed slot.
  const wallpaper = el("div", "cc-wallpaper");
  wallpaper.setAttribute("data-enabled", String(model.config.wallpaper.enabled));
  root.appendChild(wallpaper);

  const stage = el("div", "cc-stage");

  const home = homeZone(model.config);
  if (home !== undefined) {
    const clockModel: HomeClockModel = {
      now: model.now,
      zone: home,
      hour12: model.config.appearance.hour12,
    };
    if (model.config.profile.name !== undefined) {
      clockModel.name = model.config.profile.name;
    }
    renderHomeClock(stage, clockModel);

    const others = otherZones(model.config);
    if (others.length > 0) {
      const rowModel: ZoneRowModel = {
        now: model.now,
        homeZone: home,
        zones: others,
        hour12: model.config.appearance.hour12,
      };
      if (model.weatherByZone !== undefined) {
        rowModel.weatherByZone = model.weatherByZone;
      }
      renderZoneRow(stage, rowModel);
    }
  }

  // Dock of links.
  if (model.config.links.length > 0) {
    renderDock(
      stage,
      { links: model.config.links, reducedMotion },
      { navigate: deps.navigate },
    );
  }

  // Work streams (P3) fill this slot.
  stage.appendChild(el("div", "cc-streams-slot"));

  root.appendChild(stage);

  const edit = el("button", "cc-edit-btn", "Edit");
  edit.setAttribute("type", "button");
  edit.setAttribute("aria-label", "Edit dashboard");
  if (deps.onEdit !== undefined) {
    edit.addEventListener("click", deps.onEdit);
  }
  root.appendChild(edit);

  return root;
}

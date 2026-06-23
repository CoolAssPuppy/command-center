import { homeZone, otherZones, type Config } from "../config/schema";
import { renderDock } from "../dock/dock";
import { el } from "../render/helpers";
import { isSafeUrl } from "../security/url";
import { renderStreams } from "../streams/streams";
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
  /** Per-stream open override (UI state), keyed by stream id. */
  streamExpanded?: Record<string, boolean>;
  /** The resolved wallpaper image plus attribution, once Unsplash has answered. */
  wallpaper?: { imageUrl: string; authorName?: string; authorUrl?: string };
}

export interface DashboardDeps {
  navigate: (url: string) => void;
  reducedMotion?: boolean;
  theme?: Theme;
  /** Open the edit pane. */
  onEdit?: () => void;
  /** Persist a stream's open/closed toggle. */
  onToggleStream?: (streamId: string, open: boolean) => void;
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

  // Background wallpaper layer.
  const wallpaper = el("div", "cc-wallpaper");
  const imageUrl = model.wallpaper?.imageUrl;
  const showImage =
    model.config.wallpaper.enabled &&
    imageUrl !== undefined &&
    isSafeUrl(imageUrl, ["https:"]) &&
    !imageUrl.includes('"');
  wallpaper.setAttribute("data-enabled", String(showImage));
  if (showImage && imageUrl !== undefined) {
    wallpaper.style.setProperty("--cc-wallpaper-image", `url("${imageUrl}")`);
    wallpaper.style.setProperty(
      "--cc-wallpaper-scrim",
      String(model.config.wallpaper.scrim),
    );
  }
  root.appendChild(wallpaper);

  // Unsplash attribution, required when a photo is shown.
  if (showImage && model.wallpaper?.authorName !== undefined) {
    const credit = el("div", "cc-credit");
    credit.appendChild(el("span", undefined, "Photo by "));
    const author = model.wallpaper.authorUrl;
    if (author !== undefined && isSafeUrl(author, ["https:"])) {
      const link = document.createElement("a");
      link.className = "cc-credit__link";
      link.href = author;
      link.target = "_blank";
      link.rel = "noopener noreferrer";
      link.textContent = model.wallpaper.authorName;
      credit.appendChild(link);
    } else {
      credit.appendChild(el("span", "cc-credit__link", model.wallpaper.authorName));
    }
    credit.appendChild(el("span", undefined, " on Unsplash"));
    root.appendChild(credit);
  }

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

  // Work streams.
  if (model.config.streams.length > 0) {
    const streamsHost = el("div", "cc-streams-slot");
    renderStreams(
      streamsHost,
      {
        streams: model.config.streams,
        links: model.config.links,
        expanded: model.streamExpanded ?? {},
      },
      {
        navigate: deps.navigate,
        onToggle: deps.onToggleStream ?? ((): void => {}),
      },
    );
    stage.appendChild(streamsHost);
  }

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

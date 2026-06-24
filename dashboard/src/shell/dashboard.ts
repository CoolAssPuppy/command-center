import { homeZone, otherZones, type Config } from "../config/schema";
import { renderDock, type DockDeps } from "../dock/dock";
import type { IntegrationResult } from "../integrations/types";
import { el, svgEl } from "../render/helpers";
import { isSafeUrl } from "../security/url";
import { renderStreams, type StreamsDeps } from "../streams/streams";
import { resolveActiveTheme } from "../theme/resolve";
import { applyTokens, type Theme } from "../theme/tokens";
import type { Weather } from "../weather/openMeteo";
import { captureFlipRects, playFlip } from "./flip";
import { renderHomeClock, type HomeClockModel } from "./homeClock";
import { renderMeetingWindow } from "./meetingWindow";
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
  wallpaper?: {
    imageUrl: string;
    authorName?: string;
    authorUrl?: string;
    tone?: "light" | "dark";
  };
  /** Resolved integration data per stream id. */
  integrationResults?: Record<string, IntegrationResult>;
}

export interface DashboardDeps {
  navigate: (url: string) => void;
  reducedMotion?: boolean;
  theme?: Theme;
  /** Open the edit pane. */
  onEdit?: () => void;
  /** Persist a stream's open/closed toggle. */
  onToggleStream?: (streamId: string, open: boolean) => void;
  /** Reorder a dashboard group by dragging one item onto another. */
  onReorder?: (
    group: "zones" | "streams" | "links",
    fromId: string,
    toId: string,
  ) => void;
}

export function renderDashboard(
  root: HTMLElement,
  model: DashboardModel,
  deps: DashboardDeps,
): HTMLElement {
  const theme = deps.theme ?? resolveActiveTheme(model.config, model.now);
  const reducedMotion = deps.reducedMotion ?? false;
  // Snapshot widget positions before the rebuild so survivors can animate to
  // their new spots (a deleted zone/stream, the re-centred stage).
  const flipRects = captureFlipRects(root);
  const flipDisabled = reducedMotion || !theme.tokens.motion.enabled;
  applyTokens(root, theme.tokens, { reducedMotion });
  root.replaceChildren();
  root.classList.add("cc-dashboard");

  // Fluid background: a slow, muted drifting gradient, behind everything.
  if (model.config.wallpaper.source === "fluid" && !reducedMotion) {
    const fluid = el("div", "cc-fluid");
    for (let i = 1; i <= 4; i += 1) fluid.appendChild(el("span", `cc-fluid__blob cc-fluid__blob--${String(i)}`));
    root.appendChild(fluid);
  } else if (model.config.wallpaper.source === "fluid") {
    // Reduced motion: a static muted wash, no animation.
    root.appendChild(el("div", "cc-fluid cc-fluid--static"));
  }

  // Background wallpaper layer.
  const wallpaper = el("div", "cc-wallpaper");
  const imageUrl = model.wallpaper?.imageUrl;
  const showImage =
    model.config.wallpaper.source !== "gradient" &&
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
    wallpaper.setAttribute("data-tone", model.wallpaper?.tone ?? "dark");
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
    const hero = el("div", "cc-hero");
    const clockModel: HomeClockModel = {
      now: model.now,
      zone: home,
      hour12: model.config.appearance.hour12,
    };
    if (model.config.profile.name !== undefined) {
      clockModel.name = model.config.profile.name;
    }
    const homeForecast = model.weatherByZone?.[home.id]?.daily;
    if (model.config.weather.showForHome && homeForecast !== undefined) {
      clockModel.forecast = homeForecast;
    }
    renderHomeClock(hero, clockModel);

    if (model.config.appearance.showMeetingWindow !== false && model.config.zones.length >= 2) {
      renderMeetingWindow(hero, {
        now: model.now,
        zones: model.config.zones,
        homeZone: home,
        hour12: model.config.appearance.hour12,
      });
    }
    stage.appendChild(hero);

    const others = otherZones(model.config);
    if (others.length > 0) {
      const rowModel: ZoneRowModel = {
        now: model.now,
        homeZone: home,
        zones: others,
        hour12: model.config.appearance.hour12,
      };
      if (model.config.weather.showForZones && model.weatherByZone !== undefined) {
        rowModel.weatherByZone = model.weatherByZone;
      }
      if (deps.onReorder !== undefined) {
        const reorder = deps.onReorder;
        rowModel.onReorder = (fromId, toId) => reorder("zones", fromId, toId);
      }
      renderZoneRow(stage, rowModel);
    }
  }

  // Dock of links, pinned along the bottom of the page.
  if (model.config.links.length > 0) {
    const dockDeps: DockDeps = { navigate: deps.navigate };
    if (deps.onReorder !== undefined) {
      const reorder = deps.onReorder;
      dockDeps.onReorder = (fromId, toId) => reorder("links", fromId, toId);
    }
    renderDock(root, { links: model.config.links, reducedMotion }, dockDeps);
  }

  // Work streams, rendered directly into the stage so the panel grid fills
  // the remaining height.
  if (model.config.streams.length > 0) {
    const streamsModel = {
      streams: model.config.streams,
      connections: model.config.connections,
      expanded: model.streamExpanded ?? {},
      ...(model.integrationResults !== undefined
        ? { integrationResults: model.integrationResults }
        : {}),
    };
    const streamsDeps: StreamsDeps = {
      navigate: deps.navigate,
      onToggle: deps.onToggleStream ?? ((): void => {}),
    };
    if (deps.onReorder !== undefined) {
      const reorder = deps.onReorder;
      streamsDeps.onReorder = (fromId, toId) => reorder("streams", fromId, toId);
    }
    renderStreams(stage, streamsModel, streamsDeps);
  }

  root.appendChild(stage);

  const edit = el("button", "cc-edit-btn");
  edit.setAttribute("type", "button");
  edit.setAttribute("aria-label", "Customize dashboard");
  edit.setAttribute("title", "Customize");
  edit.appendChild(gearIcon());
  if (deps.onEdit !== undefined) {
    edit.addEventListener("click", deps.onEdit);
  }
  root.appendChild(edit);

  equalizeStreamHeights(root);
  if (!flipDisabled) playFlip(root, flipRects, { reducedMotion: false });

  return root;
}

/** A gear mark for the customize button. */
function gearIcon(): SVGElement {
  const svg = svgEl("svg", {
    viewBox: "0 0 24 24",
    width: "20",
    height: "20",
    fill: "none",
    stroke: "currentColor",
    "stroke-width": "1.7",
    "stroke-linecap": "round",
    "stroke-linejoin": "round",
  });
  svg.appendChild(svgEl("circle", { cx: "12", cy: "12", r: "3" }));
  svg.appendChild(
    svgEl("path", {
      d: "M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 1 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 1 1-2.83-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 1 1 2.83-2.83l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 1 1 2.83 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z",
    }),
  );
  return svg;
}

/** A floor so panels never collapse to a one-line "connect" body. */
const MIN_STREAM_BODY_PX = 96;

/**
 * Make every open work-stream panel as tall as the largest, so the cards line
 * up at a common height set by the fullest one (shorter cards simply have space
 * below their items). Measured synchronously here (after layout, before paint),
 * so there is no flicker. Collapsed panels (zero-height bodies) are skipped.
 */
function equalizeStreamHeights(root: HTMLElement): void {
  const open = [...root.querySelectorAll<HTMLElement>(".cc-stream__body")].filter(
    (body) => body.scrollHeight > 0,
  );
  if (open.length < 2) return;
  const target = Math.max(MIN_STREAM_BODY_PX, ...open.map((body) => body.scrollHeight));
  for (const body of open) {
    body.style.height = `${String(target)}px`;
    body.style.overflowY = "auto";
  }
}

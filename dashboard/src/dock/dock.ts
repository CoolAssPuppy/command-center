import type { DockLink } from "../config/schema";
import { el } from "../render/helpers";
import { isSafeUrl } from "../security/url";
import { makeDashboardReorderable, type ReorderHandler } from "../shell/dashboardReorder";
import { dockBrandIcon } from "./dockIcons";
import { fallbackGlyph, faviconUrl } from "./favicon";

/**
 * The dock: a centered row of icon-sized favicons, macOS-style. On hover the
 * icons magnify by proximity to the pointer (disabled under reduced motion). A
 * link only navigates if its url passes the scheme allowlist.
 */
export interface DockModel {
  links: DockLink[];
  reducedMotion?: boolean;
}

export interface DockDeps {
  navigate: (url: string) => void;
  /** Reorder dock links by dragging one onto another. */
  onReorder?: ReorderHandler;
}

const MAX_SCALE = 1.3;
const RANGE_PX = 70;

export function renderDock(
  host: HTMLElement,
  model: DockModel,
  deps: DockDeps,
): HTMLElement {
  const dock = el("nav", "cc-dock");
  dock.setAttribute("aria-label", "Links");

  const items = model.links.map((link) => renderItem(dock, link, deps));

  if (model.reducedMotion !== true && items.length > 0) {
    attachMagnify(dock, items);
  }

  host.appendChild(dock);
  return dock;
}

function letterGlyph(title: string): HTMLElement {
  return el("span", "cc-dock__glyph", fallbackGlyph(title));
}

/** A bundled brand icon for a link's host (Gmail, Calendar), or undefined. */
function brandIconFor(url: string): HTMLElement | undefined {
  try {
    return dockBrandIcon(new URL(url).hostname);
  } catch {
    return undefined;
  }
}

function renderItem(dock: HTMLElement, link: DockLink, deps: DockDeps): HTMLElement {
  const item = el("button", "cc-dock__item");
  item.setAttribute("type", "button");
  item.setAttribute("aria-label", link.title);
  item.setAttribute("title", link.title);

  const brand = brandIconFor(link.url);
  const icon = faviconUrl(link);
  if (brand !== undefined) {
    item.appendChild(brand);
  } else if (icon.length > 0) {
    const img = document.createElement("img");
    img.className = "cc-dock__icon";
    img.src = icon;
    img.alt = "";
    img.addEventListener("error", () => {
      img.replaceWith(letterGlyph(link.title));
    });
    item.appendChild(img);
  } else {
    item.appendChild(letterGlyph(link.title));
  }

  item.addEventListener("click", () => {
    if (isSafeUrl(link.url)) deps.navigate(link.url);
  });

  if (deps.onReorder !== undefined) {
    makeDashboardReorderable(item, "links", link.id, deps.onReorder);
  }

  dock.appendChild(item);
  return item;
}

function attachMagnify(dock: HTMLElement, items: HTMLElement[]): void {
  const reset = (): void => {
    for (const item of items) item.style.setProperty("--cc-dock-scale", "1");
  };
  dock.addEventListener("pointermove", (event) => {
    for (const item of items) {
      const rect = item.getBoundingClientRect();
      const center = rect.left + rect.width / 2;
      const distance = Math.abs(event.clientX - center);
      const scale =
        distance >= RANGE_PX
          ? 1
          : 1 + (MAX_SCALE - 1) * (1 - distance / RANGE_PX);
      item.style.setProperty("--cc-dock-scale", scale.toFixed(3));
    }
  });
  dock.addEventListener("pointerleave", reset);
}

import { type Config, type GoogleToken, type Secrets } from "../config/schema";
import type { GeoResult } from "../geo/geocode";
import { el } from "../render/helpers";
import { renderAppearanceSection } from "./appearanceSection";
import { renderBackupSection } from "./backupSection";
import { renderConnectionsSection } from "./connectionsSection";
import { renderDockSection } from "./dockSection";
import { renderStreamsSection } from "./streamsSection";
import { renderTickersSection } from "./tickersSection";
import { renderWallpaperSection } from "./wallpaperSection";
import { renderWeatherSection } from "./weatherSection";
import { renderZonesSection } from "./zonesSection";

/**
 * The edit pane: a slide-in drawer that customizes the new tab. It works on a
 * draft of the config and applies changes live, so the dashboard behind it
 * updates as you edit. Sections are independent renderers; each phase adds one
 * (zones now, dock/streams/wallpaper/integrations later) by appending to
 * SECTIONS, so the shell never has to change.
 */
export interface EditPaneRuntimeDeps {
  /** City search for adding a zone. Returns matches (empty on failure). */
  searchCities: (query: string) => Promise<GeoResult[]>;
  /**
   * Prompt for Google sign-in with the account chooser and return the chosen
   * account's token for this connection, or undefined if it was cancelled.
   * Absent outside the extension or when sign-in is not configured.
   */
  connectGoogleAccount?: (connectionId: string) => Promise<GoogleToken | undefined>;
}

export interface EditPaneDeps {
  config: Config;
  secrets: Secrets;
  /** Persist and repaint with the updated config. */
  applyConfig: (config: Config) => void;
  /** Persist updated secrets (never repainted directly). */
  applySecrets: (secrets: Secrets) => void;
  onClose: () => void;
  runtime: EditPaneRuntimeDeps;
}

/** What each section renderer receives. */
export interface SectionContext {
  draft: Config;
  draftSecrets: Secrets;
  /** Mutate the draft config, persist, and re-render the pane. */
  update: (mutate: (config: Config) => void) => void;
  /** Mutate the draft secrets and persist. */
  updateSecrets: (mutate: (secrets: Secrets) => void) => void;
  runtime: EditPaneRuntimeDeps;
  /** Collapsed section keys, persisted across the pane's re-renders. */
  collapsed: Set<string>;
}

export type SectionRenderer = (host: HTMLElement, ctx: SectionContext) => void;

const SECTIONS: SectionRenderer[] = [
  renderZonesSection,
  renderWeatherSection,
  renderDockSection,
  renderConnectionsSection,
  renderStreamsSection,
  renderTickersSection,
  renderWallpaperSection,
  renderAppearanceSection,
  renderBackupSection,
];

/**
 * The collapsed-state key of every section, in render order, so "Collapse all"
 * can reach all of them. Kept beside SECTIONS so the two stay in step.
 */
const SECTION_KEYS = [
  "zones",
  "weather",
  "dock",
  "connections",
  "streams",
  "tickers",
  "wallpaper",
  "appearance",
  "backup",
];

function clone<T>(value: T): T {
  return JSON.parse(JSON.stringify(value)) as T;
}

const FOCUSABLE =
  'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])';

/** Keep Tab focus inside the open pane. */
function trapFocus(panel: HTMLElement, event: KeyboardEvent): void {
  const focusable = [...panel.querySelectorAll<HTMLElement>(FOCUSABLE)].filter(
    (node) => !node.hasAttribute("disabled"),
  );
  const first = focusable[0];
  const last = focusable[focusable.length - 1];
  if (first === undefined || last === undefined) return;

  if (event.shiftKey && document.activeElement === first) {
    event.preventDefault();
    last.focus();
  } else if (!event.shiftKey && document.activeElement === last) {
    event.preventDefault();
    first.focus();
  }
}

export interface EditPaneHandle {
  close: () => void;
}

export function openEditPane(host: HTMLElement, deps: EditPaneDeps): EditPaneHandle {
  const draft = clone(deps.config);
  const draftSecrets = clone(deps.secrets);
  // Remember who opened the drawer so focus returns there when it closes.
  const opener =
    document.activeElement instanceof HTMLElement ? document.activeElement : null;
  // Section collapse state, kept across re-renders (the body rebuilds on edit).
  const collapsed = new Set<string>();

  const root = el("div", "cc-edit");
  const backdrop = el("div", "cc-edit__backdrop");
  const panel = el("div", "cc-edit__panel");
  panel.setAttribute("role", "dialog");
  panel.setAttribute("aria-modal", "true");
  panel.setAttribute("aria-label", "Customize");
  panel.tabIndex = -1;

  const header = el("div", "cc-edit__header");
  header.appendChild(el("h2", "cc-edit__title", "Customize"));
  const actions = el("div", "cc-edit__header-actions");

  const openAll = el("button", "cc-edit__toolbtn", "⤢");
  openAll.setAttribute("type", "button");
  openAll.setAttribute("title", "Open all");
  openAll.setAttribute("aria-label", "Open all sections");
  openAll.addEventListener("click", () => {
    collapsed.clear();
    renderBody();
  });
  actions.appendChild(openAll);

  const collapseAll = el("button", "cc-edit__toolbtn", "⤡");
  collapseAll.setAttribute("type", "button");
  collapseAll.setAttribute("title", "Collapse all");
  collapseAll.setAttribute("aria-label", "Collapse all sections");
  collapseAll.addEventListener("click", () => {
    for (const key of SECTION_KEYS) collapsed.add(key);
    renderBody();
  });
  actions.appendChild(collapseAll);

  const done = el("button", "cc-edit__done", "Done");
  done.setAttribute("type", "button");
  actions.appendChild(done);
  header.appendChild(actions);
  panel.appendChild(header);

  const body = el("div", "cc-edit__body");
  panel.appendChild(body);

  root.appendChild(backdrop);
  root.appendChild(panel);
  host.appendChild(root);

  const close = (): void => {
    root.remove();
    opener?.focus();
    deps.onClose();
  };

  const ctx: SectionContext = {
    draft,
    draftSecrets,
    update: (mutate) => {
      mutate(draft);
      deps.applyConfig(clone(draft));
      renderBody();
    },
    updateSecrets: (mutate) => {
      mutate(draftSecrets);
      deps.applySecrets(clone(draftSecrets));
      renderBody();
    },
    runtime: deps.runtime,
    collapsed,
  };

  function renderBody(): void {
    body.replaceChildren();
    for (const section of SECTIONS) section(body, ctx);
  }
  renderBody();

  done.addEventListener("click", close);
  backdrop.addEventListener("click", close);
  root.addEventListener("keydown", (event) => {
    if (event.key === "Escape") {
      close();
      return;
    }
    if (event.key === "Tab") trapFocus(panel, event);
  });
  panel.focus();

  return { close };
}

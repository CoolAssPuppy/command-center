import { type Config, type Secrets } from "../config/schema";
import type { GeoResult } from "../geo/geocode";
import { el } from "../render/helpers";
import { renderDockSection } from "./dockSection";
import { renderStreamsSection } from "./streamsSection";
import { renderWallpaperSection } from "./wallpaperSection";
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
}

export type SectionRenderer = (host: HTMLElement, ctx: SectionContext) => void;

const SECTIONS: SectionRenderer[] = [
  renderZonesSection,
  renderDockSection,
  renderStreamsSection,
  renderWallpaperSection,
];

function clone<T>(value: T): T {
  return JSON.parse(JSON.stringify(value)) as T;
}

export interface EditPaneHandle {
  close: () => void;
}

export function openEditPane(host: HTMLElement, deps: EditPaneDeps): EditPaneHandle {
  const draft = clone(deps.config);
  const draftSecrets = clone(deps.secrets);

  const root = el("div", "cc-edit");
  const backdrop = el("div", "cc-edit__backdrop");
  const panel = el("div", "cc-edit__panel");
  panel.setAttribute("role", "dialog");
  panel.setAttribute("aria-modal", "true");
  panel.setAttribute("aria-label", "Customize");
  panel.tabIndex = -1;

  const header = el("div", "cc-edit__header");
  header.appendChild(el("h2", "cc-edit__title", "Customize"));
  const done = el("button", "cc-edit__done", "Done");
  done.setAttribute("type", "button");
  header.appendChild(done);
  panel.appendChild(header);

  const body = el("div", "cc-edit__body");
  panel.appendChild(body);

  root.appendChild(backdrop);
  root.appendChild(panel);
  host.appendChild(root);

  const close = (): void => {
    root.remove();
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
  };

  function renderBody(): void {
    body.replaceChildren();
    for (const section of SECTIONS) section(body, ctx);
  }
  renderBody();

  done.addEventListener("click", close);
  backdrop.addEventListener("click", close);
  root.addEventListener("keydown", (event) => {
    if (event.key === "Escape") close();
  });
  panel.focus();

  return { close };
}

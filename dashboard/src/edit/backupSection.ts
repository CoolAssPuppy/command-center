import { parseConfig, type Config } from "../config/schema";
import { el } from "../render/helpers";
import { collapsibleSection } from "./controls";
import type { SectionContext } from "./editPane";

/**
 * The Backup section: export the config to a JSON file or import one. Secrets are
 * never part of the config, so they are never exported. Import replaces the
 * current settings (validated and repaired through parseConfig).
 */
function exportConfig(config: Config): void {
  const blob = new Blob([JSON.stringify(config, null, 2)], {
    type: "application/json",
  });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = "command-center.json";
  anchor.click();
  URL.revokeObjectURL(url);
}

export function renderBackupSection(host: HTMLElement, ctx: SectionContext): void {
  collapsibleSection(
    host,
    { title: "Backup", key: "backup", collapsed: ctx.collapsed },
    (section) => buildBackup(section, ctx),
  );
}

function buildBackup(section: HTMLElement, ctx: SectionContext): void {
  const row = el("div", "cc-edit__add-form cc-edit__add-form--stack");

  const exportButton = el("button", "cc-edit__add-btn", "Export settings");
  exportButton.setAttribute("type", "button");
  exportButton.addEventListener("click", () => {
    exportConfig(ctx.draft);
  });
  row.appendChild(exportButton);

  const importLabel = el("label", "cc-edit__add-btn cc-edit__import");
  importLabel.appendChild(el("span", undefined, "Import settings"));
  const file = document.createElement("input");
  file.type = "file";
  file.accept = "application/json";
  file.className = "cc-edit__file";
  file.setAttribute("aria-label", "Import settings file");
  const error = el("div", "cc-edit__hint");
  file.addEventListener("change", () => {
    const chosen = file.files?.[0];
    if (chosen === undefined) return;
    error.replaceChildren();
    void chosen.text().then((text) => {
      try {
        const parsed: unknown = JSON.parse(text);
        const next = parseConfig(parsed);
        ctx.update((config) => {
          for (const key of Object.keys(config)) {
            delete (config as Record<string, unknown>)[key];
          }
          Object.assign(config, next);
        });
      } catch {
        error.appendChild(el("span", undefined, "That file is not valid JSON."));
      }
    });
  });
  importLabel.appendChild(file);
  row.appendChild(importLabel);

  section.appendChild(row);
  section.appendChild(error);
  section.appendChild(
    el(
      "div",
      "cc-edit__hint",
      "Export downloads your settings as JSON (secrets are not included). Import replaces them.",
    ),
  );
}

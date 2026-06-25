import { el } from "../render/helpers";
import { SHIPPED_THEMES } from "../theme/registry";
import { AUTO_THEME } from "../theme/resolve";
import { parseTheme, type Theme } from "../theme/tokens";
import { collapsibleSection, field, textInput } from "./controls";
import type { SectionContext } from "./editPane";

/**
 * The Appearance section: the greeting name, the theme, and the clock format.
 * Themes include the shipped set plus any the user has imported; a theme can be
 * exported to a JSON file and shared, and a pasted theme imported back.
 */
export function renderAppearanceSection(host: HTMLElement, ctx: SectionContext): void {
  collapsibleSection(
    host,
    { title: "Appearance", key: "appearance", collapsed: ctx.collapsed },
    (section) => buildAppearance(section, ctx),
  );
}

/** Download a theme as a shareable JSON file named after it. */
function exportTheme(theme: Theme): void {
  const blob = new Blob([JSON.stringify(theme, null, 2)], { type: "application/json" });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = `${theme.meta.themeId}.json`;
  anchor.click();
  URL.revokeObjectURL(url);
}

function buildAppearance(section: HTMLElement, ctx: SectionContext): void {
  const name = textInput("Your name (optional)");
  name.value = ctx.draft.profile.name ?? "";
  name.setAttribute("aria-label", "Your name");
  name.addEventListener("change", () => {
    ctx.update((config) => {
      const value = name.value.trim();
      if (value.length > 0) config.profile.name = value;
      else delete config.profile.name;
    });
  });
  section.appendChild(field("Name", name));

  const current = ctx.draft.appearance.theme ?? AUTO_THEME;
  const customThemes = ctx.draft.customThemes;
  const chips = el("div", "cc-edit__chips");

  const selectTheme = (id: string): void => {
    ctx.update((config) => {
      config.appearance.theme = id;
    });
  };

  const addChip = (id: string, label: string, removable = false): void => {
    const chip = el(
      "button",
      `cc-edit__chip${current === id ? " is-active" : ""}`,
      label,
    );
    chip.setAttribute("type", "button");
    chip.addEventListener("click", () => {
      selectTheme(id);
    });
    if (removable) {
      const remove = el("span", "cc-edit__chip-x", "✕");
      remove.setAttribute("role", "button");
      remove.setAttribute("aria-label", `Remove ${label}`);
      remove.addEventListener("click", (event) => {
        event.stopPropagation();
        ctx.update((config) => {
          config.customThemes = config.customThemes.filter(
            (theme) => theme.meta.themeId !== id,
          );
          if (config.appearance.theme === id) config.appearance.theme = AUTO_THEME;
        });
      });
      chip.appendChild(remove);
    }
    chips.appendChild(chip);
  };

  addChip(AUTO_THEME, "Auto · day & night");
  for (const theme of SHIPPED_THEMES) addChip(theme.meta.themeId, theme.meta.name);
  for (const theme of customThemes) addChip(theme.meta.themeId, theme.meta.name, true);
  section.appendChild(field("Theme", chips));

  buildThemeShare(section, ctx, current, customThemes);

  const clockRow = el("label", "cc-edit__check");
  const clock = document.createElement("input");
  clock.type = "checkbox";
  clock.checked = !ctx.draft.appearance.hour12;
  clock.addEventListener("change", () => {
    ctx.update((config) => {
      config.appearance.hour12 = !clock.checked;
    });
  });
  clockRow.appendChild(clock);
  clockRow.appendChild(el("span", undefined, "Use a 24-hour clock"));
  section.appendChild(clockRow);

  section.appendChild(
    checkRow("Enable dock", ctx.draft.appearance.showDock !== false, (checked) => {
      ctx.update((config) => {
        config.appearance.showDock = checked;
      });
    }),
  );
  section.appendChild(
    checkRow(
      "Enable dock magnification",
      ctx.draft.appearance.dockMagnification !== false,
      (checked) => {
        ctx.update((config) => {
          config.appearance.dockMagnification = checked;
        });
      },
      // Magnification only matters when the dock is shown, so disable it
      // (and gray it out) while the dock is off.
      ctx.draft.appearance.showDock === false,
    ),
  );
}

/** A labeled checkbox row, matching the other edit-pane toggles. */
function checkRow(
  label: string,
  checked: boolean,
  onChange: (checked: boolean) => void,
  disabled = false,
): HTMLElement {
  const row = el("label", "cc-edit__check");
  const box = document.createElement("input");
  box.type = "checkbox";
  box.checked = checked;
  box.disabled = disabled;
  box.addEventListener("change", () => {
    onChange(box.checked);
  });
  row.appendChild(box);
  row.appendChild(el("span", undefined, label));
  return row;
}

/** Export the active theme, and import a pasted one as a new custom theme. */
function buildThemeShare(
  section: HTMLElement,
  ctx: SectionContext,
  current: string,
  customThemes: Theme[],
): void {
  const row = el("div", "cc-edit__add-form cc-edit__add-form--stack");

  // The active theme is exportable when a concrete theme is selected (not Auto).
  const active =
    [...SHIPPED_THEMES, ...customThemes].find((theme) => theme.meta.themeId === current);
  const exportButton = el("button", "cc-edit__add-btn", "Export current theme");
  exportButton.setAttribute("type", "button");
  if (active === undefined) exportButton.setAttribute("disabled", "true");
  exportButton.addEventListener("click", () => {
    if (active !== undefined) exportTheme(active);
  });
  row.appendChild(exportButton);

  const paste = document.createElement("textarea");
  paste.className = "cc-edit__input cc-edit__textarea";
  paste.rows = 3;
  paste.placeholder = "Paste theme JSON to import";
  paste.setAttribute("aria-label", "Theme JSON to import");
  row.appendChild(paste);

  const error = el("div", "cc-edit__hint");
  const importButton = el("button", "cc-edit__add-btn", "Add theme");
  importButton.setAttribute("type", "button");
  importButton.addEventListener("click", () => {
    error.replaceChildren();
    const text = paste.value.trim();
    if (text.length === 0) return;
    let raw: unknown;
    try {
      raw = JSON.parse(text);
    } catch {
      error.appendChild(el("span", undefined, "That is not valid JSON."));
      return;
    }
    const theme = parseTheme(raw);
    if (theme === undefined) {
      error.appendChild(el("span", undefined, "That JSON is not a valid theme."));
      return;
    }
    ctx.update((config) => {
      config.customThemes = [
        ...config.customThemes.filter((item) => item.meta.themeId !== theme.meta.themeId),
        theme,
      ];
      config.appearance.theme = theme.meta.themeId;
    });
    paste.value = "";
  });
  row.appendChild(importButton);

  section.appendChild(row);
  section.appendChild(error);
  section.appendChild(
    el(
      "div",
      "cc-edit__hint",
      "Export the selected theme as JSON to share it. Paste a theme's JSON and Add theme to import and use it.",
    ),
  );
}

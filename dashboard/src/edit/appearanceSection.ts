import { el } from "../render/helpers";
import { SHIPPED_THEMES } from "../theme/registry";
import { AUTO_THEME } from "../theme/resolve";
import { collapsibleSection, field, textInput } from "./controls";
import type { SectionContext } from "./editPane";

/**
 * The Appearance section: the greeting name, the theme, and the clock format.
 * All three are plain config and apply live to the dashboard.
 */
export function renderAppearanceSection(host: HTMLElement, ctx: SectionContext): void {
  collapsibleSection(
    host,
    { title: "Appearance", key: "appearance", collapsed: ctx.collapsed },
    (section) => buildAppearance(section, ctx),
  );
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

  const chips = el("div", "cc-edit__chips");
  const current = ctx.draft.appearance.theme ?? AUTO_THEME;
  const addChip = (id: string, label: string): void => {
    const chip = el(
      "button",
      `cc-edit__chip${current === id ? " is-active" : ""}`,
      label,
    );
    chip.setAttribute("type", "button");
    chip.addEventListener("click", () => {
      ctx.update((config) => {
        config.appearance.theme = id;
      });
    });
    chips.appendChild(chip);
  };
  addChip(AUTO_THEME, "Auto · day & night");
  for (const theme of SHIPPED_THEMES) addChip(theme.meta.themeId, theme.meta.name);
  section.appendChild(field("Theme", chips));

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
}

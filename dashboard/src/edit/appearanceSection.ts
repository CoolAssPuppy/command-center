import { el } from "../render/helpers";
import { SHIPPED_THEMES, themeById } from "../theme/registry";
import { field, textInput } from "./controls";
import type { SectionContext } from "./editPane";

/**
 * The Appearance section: the greeting name, the theme, and the clock format.
 * All three are plain config and apply live to the dashboard.
 */
export function renderAppearanceSection(host: HTMLElement, ctx: SectionContext): void {
  const section = el("section", "cc-edit__section");
  section.appendChild(el("h3", "cc-edit__section-title", "Appearance"));

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
  const activeId = themeById(ctx.draft.appearance.theme).meta.themeId;
  for (const theme of SHIPPED_THEMES) {
    const chip = el(
      "button",
      `cc-edit__chip${theme.meta.themeId === activeId ? " is-active" : ""}`,
      theme.meta.name,
    );
    chip.setAttribute("type", "button");
    chip.addEventListener("click", () => {
      ctx.update((config) => {
        config.appearance.theme = theme.meta.themeId;
      });
    });
    chips.appendChild(chip);
  }
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

  host.appendChild(section);
}

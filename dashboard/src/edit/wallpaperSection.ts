import { el } from "../render/helpers";
import { textInput } from "./controls";
import type { SectionContext } from "./editPane";

/**
 * The Wallpaper section: turn the wallpaper on, set the Unsplash search terms,
 * adjust the readability scrim, and store the Unsplash access key. The key is a
 * secret, so it goes through updateSecrets (local, never synced); everything
 * else is config.
 */
function field(labelText: string, control: HTMLElement): HTMLElement {
  const wrap = el("div", "cc-edit__field");
  wrap.appendChild(el("label", "cc-edit__field-label", labelText));
  wrap.appendChild(control);
  return wrap;
}

export function renderWallpaperSection(host: HTMLElement, ctx: SectionContext): void {
  const section = el("section", "cc-edit__section");
  section.appendChild(el("h3", "cc-edit__section-title", "Wallpaper"));

  const toggleRow = el("label", "cc-edit__check");
  const toggle = document.createElement("input");
  toggle.type = "checkbox";
  toggle.checked = ctx.draft.wallpaper.enabled;
  toggle.addEventListener("change", () => {
    ctx.update((config) => {
      config.wallpaper.enabled = toggle.checked;
    });
  });
  toggleRow.appendChild(toggle);
  toggleRow.appendChild(el("span", undefined, "Show an Unsplash wallpaper"));
  section.appendChild(toggleRow);

  const terms = textInput("San Francisco, Lisbon, Puppies");
  terms.value = ctx.draft.wallpaper.terms.join(", ");
  terms.setAttribute("aria-label", "Wallpaper search terms");
  terms.addEventListener("change", () => {
    ctx.update((config) => {
      config.wallpaper.terms = terms.value
        .split(",")
        .map((term) => term.trim())
        .filter((term) => term.length > 0);
    });
  });
  section.appendChild(field("Search terms", terms));

  const scrim = document.createElement("input");
  scrim.type = "range";
  scrim.min = "0";
  scrim.max = "1";
  scrim.step = "0.05";
  scrim.value = String(ctx.draft.wallpaper.scrim);
  scrim.className = "cc-edit__range";
  scrim.setAttribute("aria-label", "Darkening");
  scrim.addEventListener("change", () => {
    ctx.update((config) => {
      config.wallpaper.scrim = Number(scrim.value);
    });
  });
  section.appendChild(field("Darkening", scrim));

  const key = document.createElement("input");
  key.type = "password";
  key.className = "cc-edit__input";
  key.placeholder = "Unsplash access key";
  key.value = ctx.draftSecrets.unsplashAccessKey ?? "";
  key.setAttribute("aria-label", "Unsplash access key");
  key.addEventListener("change", () => {
    ctx.updateSecrets((secrets) => {
      const value = key.value.trim();
      if (value.length > 0) secrets.unsplashAccessKey = value;
      else delete secrets.unsplashAccessKey;
    });
  });
  section.appendChild(field("Access key", key));
  section.appendChild(
    el(
      "div",
      "cc-edit__hint",
      "Create a free key at unsplash.com/developers. Stored locally, never synced.",
    ),
  );

  host.appendChild(section);
}

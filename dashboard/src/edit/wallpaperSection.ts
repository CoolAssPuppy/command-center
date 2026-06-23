import type { Wallpaper } from "../config/schema";
import { el } from "../render/helpers";
import { field, textInput } from "./controls";
import type { SectionContext } from "./editPane";

type Source = Wallpaper["source"];

/**
 * The Wallpaper section: choose the background source (the theme gradient, an
 * Unsplash photo by search terms, or a custom image URL) and the readability
 * scrim. The Unsplash key is a secret (local, never synced); the rest is config.
 */
export function renderWallpaperSection(host: HTMLElement, ctx: SectionContext): void {
  const section = el("section", "cc-edit__section");
  section.appendChild(el("h3", "cc-edit__section-title", "Wallpaper"));

  const current = ctx.draft.wallpaper.source;
  const chips = el("div", "cc-edit__chips");
  const addChip = (value: Source, label: string): void => {
    const chip = el("button", `cc-edit__chip${current === value ? " is-active" : ""}`, label);
    chip.setAttribute("type", "button");
    chip.addEventListener("click", () => {
      ctx.update((config) => {
        config.wallpaper.source = value;
      });
    });
    chips.appendChild(chip);
  };
  addChip("gradient", "Gradient");
  addChip("unsplash", "Unsplash");
  addChip("custom", "Custom");
  section.appendChild(field("Source", chips));

  if (current === "unsplash") {
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
      el("div", "cc-edit__hint", "Create a free key at unsplash.com/developers. Stored locally."),
    );
  } else if (current === "custom") {
    const url = textInput("https://images.example.com/photo.jpg");
    url.value = ctx.draft.wallpaper.customUrl ?? "";
    url.setAttribute("aria-label", "Custom image URL");
    url.addEventListener("change", () => {
      ctx.update((config) => {
        const value = url.value.trim();
        if (value.length > 0) config.wallpaper.customUrl = value;
        else delete config.wallpaper.customUrl;
      });
    });
    section.appendChild(field("Image URL", url));
    section.appendChild(
      el("div", "cc-edit__hint", "Any https image URL, shown full-bleed under the scrim."),
    );
  } else {
    section.appendChild(
      el(
        "div",
        "cc-edit__hint",
        "The background follows your theme: a calm gradient, limestone by day and dusk by night.",
      ),
    );
  }

  if (current !== "gradient") {
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
  }

  host.appendChild(section);
}

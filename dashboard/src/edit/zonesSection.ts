import { homeZone, type Config, type Zone } from "../config/schema";
import { el } from "../render/helpers";
import { newId } from "../util/id";
import type { SectionContext } from "./editPane";

/**
 * The Timezones section of the edit pane: reorder, set the home zone, remove a
 * zone, and add one by searching for a city. The home zone is centered on the
 * dashboard, so exactly one zone carries isHome.
 */
export function renderZonesSection(host: HTMLElement, ctx: SectionContext): void {
  const section = el("section", "cc-edit__section");
  section.appendChild(el("h3", "cc-edit__section-title", "Timezones"));

  const list = el("div", "cc-edit__list");
  const home = homeZone(ctx.draft);
  ctx.draft.zones.forEach((zone, index) => {
    list.appendChild(renderZoneRow(zone, index, home?.id === zone.id, ctx));
  });
  if (ctx.draft.zones.length === 0) {
    list.appendChild(el("div", "cc-edit__hint", "No zones yet. Add one below."));
  }
  section.appendChild(list);

  section.appendChild(renderAddZone(ctx));
  host.appendChild(section);
}

function iconButton(label: string, glyph: string, onClick: () => void): HTMLElement {
  const button = el("button", "cc-edit__icon-btn", glyph);
  button.setAttribute("type", "button");
  button.setAttribute("aria-label", label);
  button.setAttribute("title", label);
  button.addEventListener("click", onClick);
  return button;
}

function moveZone(config: Config, index: number, delta: number): void {
  const target = index + delta;
  if (target < 0 || target >= config.zones.length) return;
  const zones = config.zones;
  const moved = zones[index];
  const swapped = zones[target];
  if (moved === undefined || swapped === undefined) return;
  zones[index] = swapped;
  zones[target] = moved;
}

function renderZoneRow(
  zone: Zone,
  index: number,
  isHome: boolean,
  ctx: SectionContext,
): HTMLElement {
  const row = el("div", "cc-edit__row");

  const label = el("div", "cc-edit__row-label");
  label.appendChild(el("span", "cc-edit__row-name", zone.label));
  label.appendChild(el("span", "cc-edit__row-sub", zone.timeZone));
  row.appendChild(label);

  const controls = el("div", "cc-edit__row-controls");

  const homeBtn = el(
    "button",
    `cc-edit__chip${isHome ? " is-active" : ""}`,
    isHome ? "Home" : "Set home",
  );
  homeBtn.setAttribute("type", "button");
  homeBtn.addEventListener("click", () => {
    ctx.update((config) => {
      config.zones = config.zones.map((z) => ({ ...z, isHome: z.id === zone.id }));
    });
  });
  controls.appendChild(homeBtn);

  controls.appendChild(
    iconButton("Move up", "↑", () => {
      ctx.update((config) => {
        moveZone(config, index, -1);
      });
    }),
  );
  controls.appendChild(
    iconButton("Move down", "↓", () => {
      ctx.update((config) => {
        moveZone(config, index, 1);
      });
    }),
  );
  controls.appendChild(
    iconButton("Remove", "✕", () => {
      ctx.update((config) => {
        config.zones = config.zones.filter((z) => z.id !== zone.id);
      });
    }),
  );

  row.appendChild(controls);
  return row;
}

function renderAddZone(ctx: SectionContext): HTMLElement {
  const wrap = el("div", "cc-edit__add");

  const form = el("form", "cc-edit__add-form");
  const input = document.createElement("input");
  input.type = "text";
  input.className = "cc-edit__input";
  input.placeholder = "Add a city";
  input.setAttribute("aria-label", "Search for a city");
  const submit = el("button", "cc-edit__add-btn", "Search");
  submit.setAttribute("type", "submit");
  form.appendChild(input);
  form.appendChild(submit);

  const results = el("div", "cc-edit__results");

  form.addEventListener("submit", (event) => {
    event.preventDefault();
    const query = input.value.trim();
    if (query.length === 0) return;
    results.replaceChildren(el("div", "cc-edit__hint", "Searching…"));
    void ctx.runtime
      .searchCities(query)
      .then((matches) => {
        results.replaceChildren();
        if (matches.length === 0) {
          results.appendChild(el("div", "cc-edit__hint", "No matches"));
          return;
        }
        for (const match of matches) {
          const item = el("button", "cc-edit__result", match.label);
          item.setAttribute("type", "button");
          item.addEventListener("click", () => {
            ctx.update((config) => {
              config.zones.push({
                id: newId("zone"),
                label: match.name,
                timeZone: match.timeZone,
                lat: match.lat,
                lon: match.lon,
              });
            });
          });
          results.appendChild(item);
        }
      })
      .catch(() => {
        results.replaceChildren(el("div", "cc-edit__hint", "Search failed"));
      });
  });

  wrap.appendChild(form);
  wrap.appendChild(results);
  return wrap;
}

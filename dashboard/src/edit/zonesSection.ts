import { homeZone, type Zone } from "../config/schema";
import { el } from "../render/helpers";
import { newId } from "../util/id";
import { collapsibleSection, iconButton, reorderInArray } from "./controls";
import type { SectionContext } from "./editPane";
import { makeReorderable } from "./reorderable";

/**
 * The Timezones section of the edit pane: reorder, set the home zone, remove a
 * zone, and add one by searching for a city. The home zone is centered on the
 * dashboard, so exactly one zone carries isHome.
 */
export function renderZonesSection(host: HTMLElement, ctx: SectionContext): void {
  collapsibleSection(
    host,
    { title: "Timezones", key: "zones", collapsed: ctx.collapsed },
    (section) => {
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
    },
  );
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
    `cc-edit__chip cc-edit__chip--home${isHome ? " is-active" : ""}`,
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
    iconButton("Remove", "✕", () => {
      ctx.update((config) => {
        config.zones = config.zones.filter((z) => z.id !== zone.id);
      });
    }),
  );

  row.appendChild(controls);

  makeReorderable({
    row,
    index,
    count: ctx.draft.zones.length,
    itemId: zone.id,
    itemNoun: "timezone",
    applyReorder: (from, to) =>
      ctx.update((config) => {
        reorderInArray(config.zones, from, to);
      }),
  });
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

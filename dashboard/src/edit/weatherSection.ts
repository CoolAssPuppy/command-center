import { el } from "../render/helpers";
import { collapsibleSection } from "./controls";
import type { SectionContext } from "./editPane";

/**
 * The Weather section: choose where the current temperature appears, on the
 * home clock and/or on the other timezone cards. A temperature only shows for a
 * zone that carries coordinates (added from a city search), so these toggles
 * gate the display, not the fetch.
 */
export function renderWeatherSection(host: HTMLElement, ctx: SectionContext): void {
  collapsibleSection(
    host,
    { title: "Weather", key: "weather", collapsed: ctx.collapsed },
    (section) => {
      section.appendChild(
        checkRow(
          "Show weather forecast for main",
          ctx.draft.weather.showForHome,
          (checked) =>
            ctx.update((config) => {
              config.weather.showForHome = checked;
            }),
        ),
      );
      section.appendChild(
        checkRow(
          "Show weather forecast for timezones",
          ctx.draft.weather.showForZones,
          (checked) =>
            ctx.update((config) => {
              config.weather.showForZones = checked;
            }),
        ),
      );
    },
  );
}

function checkRow(
  label: string,
  checked: boolean,
  onChange: (checked: boolean) => void,
): HTMLElement {
  const row = el("label", "cc-edit__check");
  const box = document.createElement("input");
  box.type = "checkbox";
  box.checked = checked;
  box.addEventListener("change", () => {
    onChange(box.checked);
  });
  row.appendChild(box);
  row.appendChild(el("span", undefined, label));
  return row;
}

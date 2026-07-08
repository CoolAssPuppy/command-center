import { el } from "../render/helpers";
import { checkRow, collapsibleSection, field } from "./controls";
import type { SectionContext } from "./editPane";

type Unit = "fahrenheit" | "celsius";

/**
 * The Weather section: choose where the current temperature appears, on the
 * home clock and/or on the other timezone cards. A temperature only shows for a
 * zone that carries coordinates (added from a city search), so these toggles
 * gate the display, not the fetch.
 */
export function renderWeatherSection(host: HTMLElement, ctx: SectionContext): void {
  collapsibleSection(
    host,
    {
      title: "Weather",
      key: "weather",
      collapsed: ctx.collapsed,
      description: "Show forecasts for home and your timezones.",
    },
    (section) => {
      section.appendChild(
        checkRow(
          "Show weather forecast for Home",
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

      const units = el("div", "cc-edit__chips");
      const addUnit = (value: Unit, label: string): void => {
        const active = ctx.draft.weather.unit === value;
        const chip = el("button", `cc-edit__chip${active ? " is-active" : ""}`, label);
        chip.setAttribute("type", "button");
        chip.addEventListener("click", () => {
          ctx.update((config) => {
            config.weather.unit = value;
          });
        });
        units.appendChild(chip);
      };
      addUnit("fahrenheit", "°F");
      addUnit("celsius", "°C");
      section.appendChild(field("Units", units));
    },
  );
}

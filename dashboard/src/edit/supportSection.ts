import { el, svgEl } from "../render/helpers";
import { collapsibleSection } from "./controls";
import type { SectionContext } from "./editPane";

/** A small coffee-cup mark for the Support section header. */
function supportIcon(): SVGElement {
  const svg = svgEl("svg", {
    viewBox: "0 0 24 24",
    width: "16",
    height: "16",
    fill: "none",
    stroke: "currentColor",
    "stroke-width": "1.6",
    "stroke-linecap": "round",
    "stroke-linejoin": "round",
  });
  svg.appendChild(svgEl("path", { d: "M4 8h12v5a4 4 0 0 1-4 4H8a4 4 0 0 1-4-4V8z" }));
  svg.appendChild(svgEl("path", { d: "M16 9h2a2 2 0 0 1 0 4h-2" }));
  svg.appendChild(svgEl("line", { x1: "7.5", y1: "2", x2: "7.5", y2: "4.5" }));
  svg.appendChild(svgEl("line", { x1: "11", y1: "2", x2: "11", y2: "4.5" }));
  return svg;
}

/**
 * The Support section: a nudge that the project is open-source and a couple of
 * tip links. All links open in a new tab. No secrets, no config; purely static.
 */
const REPO_URL = "https://github.com/CoolAssPuppy/command-center";
const VENMO_URL = "https://venmo.com/u/coolasspuppy";
const REVOLUT_URL = "https://revolut.me/coolasspuppy";

function link(href: string, text: string): HTMLAnchorElement {
  const anchor = document.createElement("a");
  anchor.className = "cc-edit__link";
  anchor.href = href;
  anchor.target = "_blank";
  anchor.rel = "noopener noreferrer";
  anchor.textContent = text;
  return anchor;
}

export function renderSupportSection(host: HTMLElement, ctx: SectionContext): void {
  collapsibleSection(
    host,
    {
      title: "Support",
      key: "support",
      collapsed: ctx.collapsed,
      icon: supportIcon(),
      description: "The source code and ways to say thanks.",
    },
    (section) => {
      const open = el("div", "cc-edit__hint");
      open.appendChild(link(REPO_URL, "Command Center is open-source. PRs are always welcome!"));
      section.appendChild(open);

      const coffee = el("div", "cc-edit__hint");
      coffee.appendChild(
        el(
          "span",
          undefined,
          "Shareware is awesome and indie creators are cool. Buy me coffee: ",
        ),
      );
      coffee.appendChild(link(VENMO_URL, "Venmo"));
      coffee.appendChild(el("span", undefined, " or "));
      coffee.appendChild(link(REVOLUT_URL, "Revolut"));
      section.appendChild(coffee);
    },
  );
}

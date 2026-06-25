import { el } from "../render/helpers";
import { collapsibleSection } from "./controls";
import type { SectionContext } from "./editPane";

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
    { title: "Support", key: "support", collapsed: ctx.collapsed },
    (section) => {
      const open = el("div", "cc-edit__hint");
      open.appendChild(link(REPO_URL, "Command Center is open-source. PRs are always welcome!"));
      section.appendChild(open);

      const coffee = el("div", "cc-edit__hint");
      coffee.appendChild(el("span", undefined, "Buy me coffee: "));
      coffee.appendChild(link(VENMO_URL, "Venmo"));
      coffee.appendChild(el("span", undefined, " or "));
      coffee.appendChild(link(REVOLUT_URL, "Revolut"));
      section.appendChild(coffee);
    },
  );
}

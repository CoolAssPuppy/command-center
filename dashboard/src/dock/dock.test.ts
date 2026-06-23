import { afterEach, describe, expect, it, vi } from "vitest";

import type { DockLink } from "../config/schema";
import { host } from "../test/dom";
import { renderDock } from "./dock";

afterEach(() => {
  document.body.replaceChildren();
});

const links: DockLink[] = [
  { id: "gh", title: "GitHub", url: "https://github.com" },
  { id: "ln", title: "Linear", url: "https://linear.app" },
];

describe("renderDock", () => {
  it("renders a labelled button with a favicon per link", () => {
    const root = host();
    renderDock(root, { links, reducedMotion: true }, { navigate: () => {} });

    const items = root.querySelectorAll(".cc-dock__item");
    expect(items).toHaveLength(2);
    expect(items[0]?.getAttribute("aria-label")).toBe("GitHub");
    expect(root.querySelectorAll(".cc-dock__icon")).toHaveLength(2);
  });

  it("navigates to a safe url on click", () => {
    const navigate = vi.fn();
    const root = host();
    renderDock(root, { links, reducedMotion: true }, { navigate });
    root.querySelector<HTMLButtonElement>(".cc-dock__item")?.click();
    expect(navigate).toHaveBeenCalledWith("https://github.com");
  });

  it("refuses to navigate to an unsafe url", () => {
    const navigate = vi.fn();
    const root = host();
    renderDock(
      root,
      {
        links: [{ id: "x", title: "Bad", url: "javascript:alert(1)" }],
        reducedMotion: true,
      },
      { navigate },
    );
    root.querySelector<HTMLButtonElement>(".cc-dock__item")?.click();
    expect(navigate).not.toHaveBeenCalled();
  });
});

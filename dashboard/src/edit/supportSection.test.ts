import { afterEach, describe, expect, it } from "vitest";

import { host } from "../test/dom";
import type { SectionContext } from "./editPane";
import { renderSupportSection } from "./supportSection";

afterEach(() => {
  document.body.replaceChildren();
});

const ctx = (): SectionContext =>
  ({ collapsed: new Set<string>() } as unknown as SectionContext);

describe("renderSupportSection", () => {
  it("renders the repo and tip links, all opening in a new tab", () => {
    const root = host();
    renderSupportSection(root, ctx());
    const hrefs = [...root.querySelectorAll<HTMLAnchorElement>("a")].map((a) => a.href);
    expect(hrefs).toContain("https://github.com/CoolAssPuppy/command-center");
    expect(hrefs).toContain("https://venmo.com/u/coolasspuppy");
    expect(hrefs).toContain("https://revolut.me/coolasspuppy");
    for (const anchor of root.querySelectorAll<HTMLAnchorElement>("a")) {
      expect(anchor.target).toBe("_blank");
      expect(anchor.rel).toContain("noopener");
    }
  });
});

import { afterEach, describe, expect, it } from "vitest";

import { svgEl } from "../render/helpers";
import { host } from "../test/dom";
import { collapsibleSection, helpIcon } from "./controls";

afterEach(() => {
  document.body.replaceChildren();
});

describe("collapsibleSection icon", () => {
  it("renders an explicit icon before the title", () => {
    const root = host();
    const icon = svgEl("svg");
    icon.classList.add("test-icon");
    collapsibleSection(
      root,
      { title: "Tickers", key: "tickers", collapsed: new Set(), icon },
      () => {},
    );
    expect(root.querySelector(".cc-edit__section-icon svg.test-icon")).not.toBeNull();
  });

  it("renders no icon slot for a key with no registry entry and no explicit icon", () => {
    const root = host();
    collapsibleSection(root, { title: "Support", key: "support", collapsed: new Set() }, () => {});
    expect(root.querySelector(".cc-edit__section-icon")).toBeNull();
  });
});

describe("helpIcon", () => {
  it("carries the explanation as title and aria-label", () => {
    const mark = helpIcon("Try is:open is:pr author:@me");
    expect(mark.getAttribute("title")).toBe("Try is:open is:pr author:@me");
    expect(mark.getAttribute("aria-label")).toBe("Try is:open is:pr author:@me");
  });
});

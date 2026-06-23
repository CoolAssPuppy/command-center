import { afterEach, describe, expect, it } from "vitest";

import { host } from "../test/dom";
import { captureFlipRects, playFlip } from "./flip";

afterEach(() => {
  document.body.replaceChildren();
});

const widget = (root: HTMLElement, flipId: string): HTMLElement => {
  const node = document.createElement("div");
  node.dataset.flipId = flipId;
  root.appendChild(node);
  return node;
};

describe("captureFlipRects", () => {
  it("collects a rect for every keyed widget and ignores the rest", () => {
    const root = host();
    widget(root, "zone:a");
    widget(root, "stream:b");
    root.appendChild(document.createElement("div")); // unkeyed, ignored

    const rects = captureFlipRects(root);

    expect([...rects.keys()].sort()).toEqual(["stream:b", "zone:a"]);
  });
});

describe("playFlip", () => {
  it("does nothing under reduced motion", () => {
    const root = host();
    const node = widget(root, "zone:a");
    const previous = new Map([["zone:a", new DOMRect(0, 0, 10, 10)]]);

    playFlip(root, previous, { reducedMotion: true });

    expect(node.style.transform).toBe("");
  });

  it("does nothing when there is no prior layout to animate from", () => {
    const root = host();
    const node = widget(root, "zone:a");

    playFlip(root, new Map(), { reducedMotion: false });

    expect(node.style.transform).toBe("");
  });
});

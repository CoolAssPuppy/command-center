import { afterEach, describe, expect, it } from "vitest";

import { host } from "../test/dom";
import { makeDashboardReorderable } from "./dashboardReorder";

afterEach(() => {
  document.body.replaceChildren();
});

/** A DataTransfer stand-in whose `types` reflects what was set. */
const fakeTransfer = (): DataTransfer => {
  const store: Record<string, string> = {};
  return {
    setData: (type: string, value: string) => {
      store[type] = value;
    },
    getData: (type: string) => store[type] ?? "",
    get types(): string[] {
      return Object.keys(store);
    },
    effectAllowed: "",
    dropEffect: "",
  } as unknown as DataTransfer;
};

const dragEvent = (type: string, transfer: DataTransfer): Event => {
  const event = new Event(type, { cancelable: true, bubbles: true });
  Object.defineProperty(event, "dataTransfer", { value: transfer });
  return event;
};

const item = (root: HTMLElement): HTMLElement => {
  const node = document.createElement("div");
  root.appendChild(node);
  return node;
};

describe("makeDashboardReorderable", () => {
  it("reports a reorder when dropping one item onto another in the group", () => {
    const root = host();
    const a = item(root);
    const b = item(root);
    let moved: [string, string] | undefined;
    makeDashboardReorderable(a, "zones", "a", () => {});
    makeDashboardReorderable(b, "zones", "b", (from, to) => {
      moved = [from, to];
    });

    const transfer = fakeTransfer();
    a.dispatchEvent(dragEvent("dragstart", transfer));
    b.dispatchEvent(dragEvent("drop", transfer));

    expect(moved).toEqual(["a", "b"]);
  });

  it("ignores a drop from another group, so items can't cross boundaries", () => {
    const root = host();
    const zone = item(root);
    const stream = item(root);
    let moved: [string, string] | undefined;
    makeDashboardReorderable(zone, "zones", "z", () => {});
    makeDashboardReorderable(stream, "streams", "s", (from, to) => {
      moved = [from, to];
    });

    const transfer = fakeTransfer();
    zone.dispatchEvent(dragEvent("dragstart", transfer));
    stream.dispatchEvent(dragEvent("drop", transfer));

    expect(moved).toBeUndefined();
  });
});

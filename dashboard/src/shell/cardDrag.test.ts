import { afterEach, describe, expect, it, vi } from "vitest";

import { host } from "../test/dom";
import { makeCardDraggable, makeColumnDropZone, type MoveCardHandler } from "./cardDrag";
import type { CardColumn } from "./cardMove";

afterEach(() => {
  document.body.replaceChildren();
});

const CARD_MIME = "application/x-cc-card";

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
  Object.defineProperty(event, "clientY", { value: 0 });
  return event;
};

/** A column container holding card nodes wired for drag, like the renderer makes. */
const column = (
  root: HTMLElement,
  col: CardColumn,
  ids: string[],
  onMove: MoveCardHandler = (): void => {},
): HTMLElement => {
  const container = document.createElement("div");
  container.className = "cc-streams";
  container.dataset.column = col;
  for (const id of ids) {
    const cardEl = document.createElement("details");
    cardEl.className = "cc-stream";
    const summary = document.createElement("summary");
    summary.className = "cc-stream__summary";
    cardEl.appendChild(summary);
    container.appendChild(cardEl);
    makeCardDraggable(cardEl, id, col, onMove);
  }
  root.appendChild(container);
  return container;
};

describe("card drag drop zone", () => {
  it("moves a dropped card into this column at the end", () => {
    const root = host();
    const moves: Array<[string, CardColumn, string | null]> = [];
    const container = column(root, "right", [], (id, col, beforeId) => {
      moves.push([id, col, beforeId]);
    });
    makeColumnDropZone(container, "right", (id, col, beforeId) => {
      moves.push([id, col, beforeId]);
    });

    const transfer = fakeTransfer();
    transfer.setData(CARD_MIME, "dragged");
    container.dispatchEvent(dragEvent("drop", transfer));

    expect(moves).toEqual([["dragged", "right", null]]);
  });

  it("ignores a drop that does not carry a card", () => {
    const root = host();
    const onMove = vi.fn();
    const container = column(root, "left", []);
    makeColumnDropZone(container, "left", onMove);

    const transfer = fakeTransfer();
    transfer.setData("text/plain", "nope");
    container.dispatchEvent(dragEvent("drop", transfer));

    expect(onMove).not.toHaveBeenCalled();
  });
});

describe("card keyboard move", () => {
  it("switches a left card to the right column with Alt+ArrowRight", () => {
    const root = host();
    const onMove = vi.fn();
    column(root, "left", ["a"], onMove);
    const cardEl = root.querySelector<HTMLElement>(".cc-stream");
    cardEl?.dispatchEvent(
      new KeyboardEvent("keydown", { key: "ArrowRight", altKey: true, bubbles: true }),
    );
    expect(onMove).toHaveBeenCalledWith("a", "right", null);
  });

  it("reorders up within the column with Alt+ArrowUp", () => {
    const root = host();
    const onMove = vi.fn();
    column(root, "left", ["a", "b"], onMove);
    const second = root.querySelectorAll<HTMLElement>(".cc-stream")[1];
    second?.dispatchEvent(
      new KeyboardEvent("keydown", { key: "ArrowUp", altKey: true, bubbles: true }),
    );
    expect(onMove).toHaveBeenCalledWith("b", "left", "a");
  });

  it("ignores arrows without the Alt modifier", () => {
    const root = host();
    const onMove = vi.fn();
    column(root, "left", ["a"], onMove);
    const cardEl = root.querySelector<HTMLElement>(".cc-stream");
    cardEl?.dispatchEvent(new KeyboardEvent("keydown", { key: "ArrowRight", bubbles: true }));
    expect(onMove).not.toHaveBeenCalled();
  });
});

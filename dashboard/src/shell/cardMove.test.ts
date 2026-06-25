import { describe, expect, it } from "vitest";

import { StreamSchema, type Stream } from "../config/schema";
import { moveCard, type CardColumn } from "./cardMove";

const card = (id: string, column: CardColumn, order: number): Stream =>
  StreamSchema.parse({ id, title: id, connectionId: "c", column, order });

/** A column's card ids in render order (sorted by order). */
const columnOrder = (streams: Stream[], column: CardColumn): string[] =>
  streams
    .filter((stream) => stream.column === column)
    .sort((a, b) => a.order - b.order)
    .map((stream) => stream.id);

describe("moveCard", () => {
  it("moves a card to the other column before a given card", () => {
    const streams = [card("a", "left", 0), card("b", "left", 1), card("x", "right", 0)];
    const next = moveCard(streams, "x", "left", "b");

    expect(next.find((s) => s.id === "x")?.column).toBe("left");
    expect(columnOrder(next, "left")).toEqual(["a", "x", "b"]);
    expect(columnOrder(next, "right")).toEqual([]);
  });

  it("moves a card to an empty column", () => {
    const streams = [card("a", "left", 0)];
    const next = moveCard(streams, "a", "right", null);

    expect(next[0]?.column).toBe("right");
    expect(next[0]?.order).toBe(0);
    expect(columnOrder(next, "left")).toEqual([]);
    expect(columnOrder(next, "right")).toEqual(["a"]);
  });

  it("reorders within a column without changing the column", () => {
    const streams = [card("a", "left", 0), card("b", "left", 1), card("c", "left", 2)];
    const next = moveCard(streams, "c", "left", "a");

    expect(columnOrder(next, "left")).toEqual(["c", "a", "b"]);
    expect(next.every((s) => s.column === "left")).toBe(true);
  });

  it("appends to the end of the column when beforeId is null", () => {
    const streams = [card("a", "right", 0), card("b", "right", 1)];
    const next = moveCard(streams, "a", "right", null);
    expect(columnOrder(next, "right")).toEqual(["b", "a"]);
  });

  it("preserves the config array order (that order is the pane's, not the surface's)", () => {
    const streams = [card("a", "left", 0), card("b", "right", 0), card("c", "left", 1)];
    const next = moveCard(streams, "c", "right", null);
    expect(next.map((s) => s.id)).toEqual(["a", "b", "c"]);
  });

  it("returns the same array when nothing changes", () => {
    const streams = [card("a", "left", 0), card("b", "left", 1)];
    // Dropping b at the end of left is where it already sits.
    expect(moveCard(streams, "b", "left", null)).toBe(streams);
  });

  it("returns the same array for an unknown card", () => {
    const streams = [card("a", "left", 0)];
    expect(moveCard(streams, "ghost", "right", null)).toBe(streams);
  });
});

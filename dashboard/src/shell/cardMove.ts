import type { Stream } from "../config/schema";

export type CardColumn = "left" | "right";

/**
 * Move a card to a column at a position, returning a new streams array (or the
 * same reference when nothing changed, so callers can skip a repaint).
 *
 * The new-tab surface layout lives in each card's explicit `column` and `order`
 * fields, and the dashboard renders by sorting on them, NOT by the config array
 * order (which the Customize pane owns, cosmetically). So a move recomputes the
 * affected columns: the dragged card is inserted into the target column before
 * beforeId (or at the end when null), then every card in both columns is given a
 * fresh 0..n order. The config array order is preserved.
 */
export function moveCard(
  streams: Stream[],
  cardId: string,
  column: CardColumn,
  beforeId: string | null,
): Stream[] {
  const card = streams.find((stream) => stream.id === cardId);
  if (card === undefined) return streams;

  const sortedColumn = (col: CardColumn): Stream[] =>
    streams
      .filter((stream) => stream.id !== cardId && stream.column === col)
      .sort((a, b) => a.order - b.order);

  const target = sortedColumn(column);
  const at =
    beforeId === null || beforeId === cardId
      ? target.length
      : indexOrEnd(target, beforeId);
  target.splice(at, 0, card);

  const otherColumn: CardColumn = column === "left" ? "right" : "left";
  const other = sortedColumn(otherColumn);

  const layout = new Map<string, { column: CardColumn; order: number }>();
  target.forEach((stream, index) => layout.set(stream.id, { column, order: index }));
  other.forEach((stream, index) => layout.set(stream.id, { column: otherColumn, order: index }));

  let changed = false;
  const next = streams.map((stream) => {
    const placed = layout.get(stream.id);
    if (placed === undefined) return stream;
    if (stream.column === placed.column && stream.order === placed.order) return stream;
    changed = true;
    return { ...stream, column: placed.column, order: placed.order };
  });
  return changed ? next : streams;
}

function indexOrEnd(cards: Stream[], beforeId: string): number {
  const index = cards.findIndex((stream) => stream.id === beforeId);
  return index < 0 ? cards.length : index;
}

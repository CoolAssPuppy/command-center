import { el } from "../render/helpers";
import type { CardColumn } from "./cardMove";

/**
 * Cross-column drag-and-drop for data cards. A card can be dragged into either
 * work-area column and dropped at a position; while dragging, an insertion
 * indicator marks the slot it would land in. Keyboard users move a focused card
 * with Alt+Arrow (up/down to reorder within a column, left/right to switch
 * columns). Both paths funnel through one handler that sets the card's column
 * and its place in the shared order.
 */
const CARD_MIME = "application/x-cc-card";

export type MoveCardHandler = (
  cardId: string,
  column: CardColumn,
  beforeId: string | null,
) => void;

/** Direct card children of a column container, in DOM order. */
function columnCards(container: HTMLElement): HTMLElement[] {
  return [...container.querySelectorAll<HTMLElement>(":scope > [data-card-id]")];
}

/**
 * The id of the card the pointer would drop in front of, or null for the end of
 * the column. The card being dragged is skipped so it never targets itself.
 */
function insertBeforeId(container: HTMLElement, clientY: number): string | null {
  for (const card of columnCards(container)) {
    if (card.classList.contains("is-dragging")) continue;
    const rect = card.getBoundingClientRect();
    if (clientY < rect.top + rect.height / 2) return card.dataset.cardId ?? null;
  }
  return null;
}

/** Place the insertion indicator at the hovered slot inside the column. */
function showIndicator(container: HTMLElement, clientY: number): void {
  let indicator = container.querySelector<HTMLElement>(".cc-streams__indicator");
  if (indicator === null) {
    indicator = el("div", "cc-streams__indicator");
    indicator.setAttribute("aria-hidden", "true");
  }
  const beforeId = insertBeforeId(container, clientY);
  const target =
    beforeId !== null
      ? columnCards(container).find((card) => card.dataset.cardId === beforeId)
      : undefined;
  if (target !== undefined) {
    container.insertBefore(indicator, target);
    return;
  }
  // Drop at the column's end: ahead of the empty placeholder when present.
  const empty = container.querySelector(".cc-streams__empty");
  if (empty !== null) container.insertBefore(indicator, empty);
  else container.appendChild(indicator);
}

function clearIndicator(container: HTMLElement): void {
  container.classList.remove("is-drop-target");
  container.querySelector(".cc-streams__indicator")?.remove();
}

/**
 * Make a column container a drop zone for cards. It accepts cards dragged from
 * either column, so a drag can cross between them. The geometry uses the live
 * pointer position, so it is exercised in the browser; tests drive the handler
 * directly.
 */
export function makeColumnDropZone(
  container: HTMLElement,
  column: CardColumn,
  onMove: MoveCardHandler,
): void {
  container.addEventListener("dragover", (event) => {
    if (event.dataTransfer === null || !event.dataTransfer.types.includes(CARD_MIME)) return;
    event.preventDefault();
    event.dataTransfer.dropEffect = "move";
    container.classList.add("is-drop-target");
    showIndicator(container, event.clientY);
  });
  container.addEventListener("dragleave", (event) => {
    // Ignore leaving for a child node; only clear when the pointer truly exits.
    if (event.relatedTarget instanceof Node && container.contains(event.relatedTarget)) return;
    clearIndicator(container);
  });
  container.addEventListener("drop", (event) => {
    if (event.dataTransfer === null || !event.dataTransfer.types.includes(CARD_MIME)) return;
    event.preventDefault();
    const cardId = event.dataTransfer.getData(CARD_MIME);
    const beforeId = insertBeforeId(container, event.clientY);
    clearIndicator(container);
    if (cardId.length > 0) onMove(cardId, column, beforeId);
  });
}

/**
 * Make a card draggable and keyboard-movable. Drag carries the card id and shows
 * the dragging affordance; Alt+Arrow moves the focused card (up/down reorder
 * within the column, left/right switch columns) and restores focus to it after
 * the repaint.
 */
export function makeCardDraggable(
  card: HTMLElement,
  cardId: string,
  column: CardColumn,
  onMove: MoveCardHandler,
): void {
  card.draggable = true;
  card.classList.add("is-reorderable");
  card.dataset.cardId = cardId;
  card.setAttribute("aria-keyshortcuts", "Alt+ArrowUp Alt+ArrowDown Alt+ArrowLeft Alt+ArrowRight");

  card.addEventListener("dragstart", (event) => {
    event.dataTransfer?.setData(CARD_MIME, cardId);
    if (event.dataTransfer) event.dataTransfer.effectAllowed = "move";
    card.classList.add("is-dragging");
  });
  card.addEventListener("dragend", () => {
    card.classList.remove("is-dragging");
  });

  const applyMove = (toColumn: CardColumn, beforeId: string | null): void => {
    const doc = card.ownerDocument;
    onMove(cardId, toColumn, beforeId);
    // The repaint rebuilds the card, so move focus to its new node by id.
    const moved = [...doc.querySelectorAll<HTMLElement>("[data-card-id]")].find(
      (node) => node.dataset.cardId === cardId,
    );
    moved?.querySelector<HTMLElement>(".cc-stream__summary")?.focus();
  };

  card.addEventListener("keydown", (event) => {
    if (!event.altKey) return;
    const key = event.key;
    if (key === "ArrowLeft") {
      if (column === "right") {
        event.preventDefault();
        applyMove("left", null);
      }
      return;
    }
    if (key === "ArrowRight") {
      if (column === "left") {
        event.preventDefault();
        applyMove("right", null);
      }
      return;
    }
    if (key !== "ArrowUp" && key !== "ArrowDown") return;
    const container = card.parentElement;
    if (container === null) return;
    const cards = columnCards(container);
    const index = cards.indexOf(card);
    if (index < 0) return;
    if (key === "ArrowUp") {
      if (index === 0) return;
      event.preventDefault();
      applyMove(column, cards[index - 1]?.dataset.cardId ?? null);
    } else {
      if (index >= cards.length - 1) return;
      event.preventDefault();
      // Land just after the next card: before the one two slots down, or the end.
      applyMove(column, cards[index + 2]?.dataset.cardId ?? null);
    }
  });
}

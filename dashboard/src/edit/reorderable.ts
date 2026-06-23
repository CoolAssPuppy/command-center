import { svgEl } from "../render/helpers";

/**
 * Drag-to-reorder for edit-pane list rows, with a grab handle that surfaces on
 * hover. The handle is a real focusable button: drag it with a mouse, or focus
 * it and press the arrow keys, so reordering stays keyboard-accessible without
 * the up/down buttons. After a keyboard move the pane re-renders, so focus is
 * returned to the same item's handle by its stable id.
 */

/** A six-dot grip mark, the drag affordance shown on row hover. */
function gripMark(): SVGElement {
  const mark = svgEl("svg", {
    viewBox: "0 0 10 16",
    width: "10",
    height: "16",
    fill: "currentColor",
  });
  for (const [cx, cy] of [
    [2, 3], [8, 3], [2, 8], [8, 8], [2, 13], [8, 13],
  ] as const) {
    mark.appendChild(svgEl("circle", { cx: String(cx), cy: String(cy), r: "1.3" }));
  }
  return mark;
}

export interface ReorderableOptions {
  /** The row element to make draggable. */
  row: HTMLElement;
  /** This row's position in the list. */
  index: number;
  /** How many rows there are, so the ends don't wrap. */
  count: number;
  /** A stable id for the row's item, used to restore focus after a move. */
  itemId: string;
  /** What this list reorders, for the handle's accessible name (e.g. "link"). */
  itemNoun: string;
  /** Where to place the grip. Defaults to the row; pass a header for stacked rows. */
  handleHost?: HTMLElement;
  /** Move the item from one index to another, persist, and re-render. */
  applyReorder: (from: number, to: number) => void;
}

/**
 * Prepend a grab handle to `row` and wire drag-and-drop plus keyboard
 * reordering. Returns nothing; mutates the row in place.
 */
export function makeReorderable(options: ReorderableOptions): void {
  const { row, index, count, itemId, itemNoun, applyReorder } = options;
  const handleHost = options.handleHost ?? row;
  row.classList.add("cc-edit__row--drag");

  const handle = document.createElement("button");
  handle.type = "button";
  handle.className = "cc-edit__grip";
  handle.dataset.reorderId = itemId;
  handle.setAttribute("aria-label", `Reorder ${itemNoun}: drag, or use the arrow keys`);
  handle.title = "Drag to reorder";
  handle.appendChild(gripMark());

  // Keyboard: move with the arrows, then refocus the handle at its new spot.
  const moveAndRefocus = (to: number): void => {
    applyReorder(index, to);
    document
      .querySelector<HTMLElement>(`.cc-edit__grip[data-reorder-id="${itemId}"]`)
      ?.focus();
  };
  handle.addEventListener("keydown", (event) => {
    if (event.key === "ArrowUp" && index > 0) {
      event.preventDefault();
      moveAndRefocus(index - 1);
    } else if (event.key === "ArrowDown" && index < count - 1) {
      event.preventDefault();
      moveAndRefocus(index + 1);
    }
  });
  // Only arm dragging from the handle, so inputs in the row stay selectable.
  handle.addEventListener("mousedown", () => {
    row.draggable = true;
  });

  handleHost.prepend(handle);
  wireDragReorder(row, index, applyReorder);
}

/** HTML5 drag-and-drop reordering, keyed by the row's current index. */
function wireDragReorder(
  row: HTMLElement,
  index: number,
  applyReorder: (from: number, to: number) => void,
): void {
  row.addEventListener("dragstart", (event) => {
    event.dataTransfer?.setData("text/plain", String(index));
    if (event.dataTransfer) event.dataTransfer.effectAllowed = "move";
    row.classList.add("is-dragging");
  });
  row.addEventListener("dragend", () => {
    row.classList.remove("is-dragging");
    row.draggable = false;
  });
  row.addEventListener("dragover", (event) => {
    event.preventDefault();
    if (event.dataTransfer) event.dataTransfer.dropEffect = "move";
    row.classList.add("is-drop-target");
  });
  row.addEventListener("dragleave", () => {
    row.classList.remove("is-drop-target");
  });
  row.addEventListener("drop", (event) => {
    event.preventDefault();
    row.classList.remove("is-drop-target");
    const from = Number(event.dataTransfer?.getData("text/plain"));
    if (Number.isInteger(from) && from !== index) applyReorder(from, index);
  });
}

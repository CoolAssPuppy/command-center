/**
 * Drag-to-reorder for dashboard items, scoped to their own group. The group is
 * encoded in the drag's MIME type (application/x-cc-reorder-<group>), so a drag
 * only previews and drops onto items of the same group: a timezone card can be
 * dropped on another timezone card, never on a work-stream panel. Reordering is
 * by item id, so it maps straight back to the config array the edit pane shows.
 */
export type ReorderHandler = (fromId: string, toId: string) => void;

export function makeDashboardReorderable(
  element: HTMLElement,
  group: string,
  itemId: string,
  onReorder: ReorderHandler,
): void {
  const mime = `application/x-cc-reorder-${group}`;
  element.draggable = true;
  element.classList.add("is-reorderable");

  element.addEventListener("dragstart", (event) => {
    event.dataTransfer?.setData(mime, itemId);
    if (event.dataTransfer) event.dataTransfer.effectAllowed = "move";
    element.classList.add("is-dragging");
  });
  element.addEventListener("dragend", () => {
    element.classList.remove("is-dragging");
  });
  element.addEventListener("dragover", (event) => {
    // Same-group drags carry our MIME type; anything else is not a drop target.
    if (event.dataTransfer === null || !event.dataTransfer.types.includes(mime)) return;
    event.preventDefault();
    event.dataTransfer.dropEffect = "move";
    element.classList.add("is-drop-target");
  });
  element.addEventListener("dragleave", () => {
    element.classList.remove("is-drop-target");
  });
  element.addEventListener("drop", (event) => {
    if (event.dataTransfer === null || !event.dataTransfer.types.includes(mime)) return;
    event.preventDefault();
    element.classList.remove("is-drop-target");
    const fromId = event.dataTransfer.getData(mime);
    if (fromId.length > 0 && fromId !== itemId) onReorder(fromId, itemId);
  });
}

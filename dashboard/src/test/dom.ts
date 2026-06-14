/**
 * Shared DOM helpers for tests. A host node must be attached to the document so
 * that `toBeInTheDocument` and layout-dependent queries behave; a detached node
 * fails those checks. Each test gets its own fresh host.
 */
export function host(): HTMLElement {
  const node = document.createElement("div");
  document.body.appendChild(node);
  return node;
}

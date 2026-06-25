/**
 * Text-only DOM helpers. All feed and provider content is rendered as text,
 * never as HTML. The renderers use these helpers exclusively, so a malformed or
 * malicious feed value can never inject markup. There is no innerHTML path for
 * untrusted content anywhere in the dashboard.
 */

/** Set a node's text content. Never assigns innerHTML. */
export function setText<T extends Node>(node: T, text: string): T {
  node.textContent = text;
  return node;
}

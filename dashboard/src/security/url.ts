import type { ActionRef, ManifestAction } from "../domain/actions";
import type { ParseResult } from "../domain/feed";

/**
 * URL safety for actions. A widget never opens a URL itself: it references an
 * action, the platform fills the template or route, and only a validated URL is
 * navigated. A provider can never cause an arbitrary URL to open. See
 * docs/10-security.md and docs/13-representation-model.md.
 */

/** Schemes the dashboard will navigate to by default. */
export const DEFAULT_ALLOWED_SCHEMES = ["https:", "commandcenter:"] as const;

/** Schemes that are never safe to navigate, blocked regardless of allowlist. */
const DANGEROUS_SCHEMES = new Set([
  "javascript:",
  "data:",
  "vbscript:",
  "file:",
  "blob:",
  "about:",
]);

export function isSafeUrl(
  raw: string,
  allowedSchemes: readonly string[] = DEFAULT_ALLOWED_SCHEMES,
): boolean {
  let scheme: string;
  try {
    scheme = new URL(raw).protocol.toLowerCase();
  } catch {
    return false;
  }
  if (DANGEROUS_SCHEMES.has(scheme)) return false;
  return allowedSchemes.includes(scheme);
}

export interface ResolveOptions {
  allowedSchemes?: readonly string[];
}

/** Substitute {name} placeholders, URL-encoding each value so it cannot break out. */
function fillTemplate(
  template: string,
  params: Record<string, string>,
): ParseResult<string> {
  for (const match of template.matchAll(/\{(\w+)\}/g)) {
    const key = match[1];
    if (key !== undefined && params[key] === undefined) {
      return { ok: false, error: `action is missing the param ${key}` };
    }
  }
  const filled = template.replace(/\{(\w+)\}/g, (_match, key: string) =>
    encodeURIComponent(params[key] ?? ""),
  );
  return { ok: true, value: filled };
}

function appendQuery(route: string, params: Record<string, string>): string {
  const search = new URLSearchParams();
  for (const [key, value] of Object.entries(params)) search.set(key, value);
  const query = search.toString();
  return query.length > 0 ? `${route}?${query}` : route;
}

/**
 * Resolve a manifest action plus a widget's action reference into a single,
 * validated URL to navigate to, or an error. The final scheme is always
 * checked, so a dangerous template scheme is rejected, and an encoded param can
 * never change the scheme.
 */
export function resolveActionUrl(
  action: ManifestAction,
  ref: ActionRef,
  options: ResolveOptions = {},
): ParseResult<string> {
  const allowed = options.allowedSchemes ?? DEFAULT_ALLOWED_SCHEMES;
  const params = ref.params ?? {};

  let url: string;
  if (action.route !== undefined) {
    url = appendQuery(action.route, params);
  } else if (action.urlTemplate !== undefined) {
    const filled = fillTemplate(action.urlTemplate, params);
    if (!filled.ok) return filled;
    url = filled.value;
  } else {
    return { ok: false, error: "action has neither a route nor a urlTemplate" };
  }

  if (!isSafeUrl(url, allowed)) {
    return { ok: false, error: `unsafe action url for ${action.id}` };
  }
  return { ok: true, value: url };
}

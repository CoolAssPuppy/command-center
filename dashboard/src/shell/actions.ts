import type { ActionRef, ManifestAction } from "../domain/actions";
import { DEFAULT_ALLOWED_SCHEMES, resolveActionUrl } from "../security/url";

/**
 * Binds a card's manifest actions to navigation. A widget calls invoke(ref);
 * this finds the declared action, resolves and validates the URL, and only then
 * navigates. Dangerous schemes are always blocked by resolveActionUrl, so the
 * derived allowlist below only ever widens to non-dangerous app schemes that a
 * provider declared and the native side already vetted at registration.
 */

export interface ActionInvokerDeps {
  navigate: (url: string) => void;
  allowedSchemes?: readonly string[];
}

function schemeOf(source: string): string | null {
  const match = /^([a-zA-Z][a-zA-Z0-9+.-]*):/.exec(source);
  const scheme = match?.[1];
  return scheme !== undefined ? `${scheme.toLowerCase()}:` : null;
}

/** Default schemes plus any non-dangerous schemes the manifest actions declare. */
export function deriveAllowedSchemes(actions: ManifestAction[]): string[] {
  const schemes = new Set<string>(DEFAULT_ALLOWED_SCHEMES);
  for (const action of actions) {
    const source = action.urlTemplate ?? action.route;
    const scheme = source !== undefined ? schemeOf(source) : null;
    if (scheme !== null) schemes.add(scheme);
  }
  return [...schemes];
}

export function createActionInvoker(
  actions: ManifestAction[],
  deps: ActionInvokerDeps,
): (ref: ActionRef) => void {
  const byId = new Map(actions.map((action) => [action.id, action]));
  const allowedSchemes = [
    ...new Set([...deriveAllowedSchemes(actions), ...(deps.allowedSchemes ?? [])]),
  ];

  return (ref: ActionRef) => {
    const action = byId.get(ref.ref);
    if (action === undefined) return;
    const resolved = resolveActionUrl(action, ref, { allowedSchemes });
    if (resolved.ok) deps.navigate(resolved.value);
  };
}

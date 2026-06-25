/**
 * URL safety for anything the dashboard navigates to or fetches: dock links,
 * integration item links, wallpaper image URLs. A dangerous scheme is always
 * blocked, and only allow-listed schemes are permitted.
 */

/** Schemes the dashboard will navigate to by default (dock links, item links). */
export const DEFAULT_ALLOWED_SCHEMES = ["https:", "http:"] as const;

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

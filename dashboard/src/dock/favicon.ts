import type { DockLink } from "../config/schema";

/**
 * Resolve the icon for a dock link. An explicit iconUrl wins; otherwise we ask
 * Google's favicon service for the link's domain (allow-listed in the manifest).
 * Returns an empty string for an unparseable url so the caller can fall back to
 * a letter glyph.
 */
export function faviconUrl(link: Pick<DockLink, "url" | "iconUrl">, size = 64): string {
  if (link.iconUrl !== undefined && link.iconUrl.length > 0) return link.iconUrl;
  try {
    const host = new URL(link.url).hostname;
    const url = new URL("https://www.google.com/s2/favicons");
    url.searchParams.set("domain", host);
    url.searchParams.set("sz", String(size));
    return url.toString();
  } catch {
    return "";
  }
}

/** A one-letter fallback for a link with no resolvable icon. */
export function fallbackGlyph(title: string): string {
  const trimmed = title.trim();
  return trimmed.length > 0 ? trimmed.charAt(0).toUpperCase() : "?";
}

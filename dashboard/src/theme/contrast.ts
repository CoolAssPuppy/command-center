/**
 * WCAG contrast utilities, used to guard theme legibility. Because the redesign
 * is borderless, text sits directly on the background gradient, so a theme's
 * text must stay readable against the flat bg token and against every color stop
 * of its gradient. These are pure functions over hex colors.
 */

interface Rgb {
  r: number;
  g: number;
  b: number;
}

function parseHex(hex: string): Rgb | undefined {
  const body = hex.trim().replace(/^#/, "");
  // Expand the 3-digit shorthand (#abc -> #aabbcc) so it is not silently treated
  // as black; anything that is not 3- or 6-digit hex stays unparseable.
  const full = /^[0-9a-f]{3}$/i.test(body)
    ? body.replace(/./g, (ch) => ch + ch)
    : /^[0-9a-f]{6}$/i.test(body)
      ? body
      : undefined;
  if (full === undefined) return undefined;
  const n = Number.parseInt(full, 16);
  return { r: (n >> 16) & 255, g: (n >> 8) & 255, b: n & 255 };
}

function linearize(channel: number): number {
  const c = channel / 255;
  return c <= 0.03928 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4);
}

/** WCAG relative luminance (0 black, 1 white) of a hex color. */
export function relativeLuminance(hex: string): number {
  const rgb = parseHex(hex);
  if (rgb === undefined) return 0;
  return 0.2126 * linearize(rgb.r) + 0.7152 * linearize(rgb.g) + 0.0722 * linearize(rgb.b);
}

/** WCAG contrast ratio between two hex colors, 1 (none) to 21 (black on white). */
export function contrastRatio(a: string, b: string): number {
  const la = relativeLuminance(a);
  const lb = relativeLuminance(b);
  const lighter = Math.max(la, lb);
  const darker = Math.min(la, lb);
  return (lighter + 0.05) / (darker + 0.05);
}

/** Every #rrggbb or #rgb stop in a CSS value (gradient or otherwise), in order. */
export function extractHexStops(value: string): string[] {
  return value.match(/#[0-9a-fA-F]{6}\b|#[0-9a-fA-F]{3}\b/g) ?? [];
}

/**
 * The lowest contrast of a text color against the background it can sit on: the
 * flat bg token plus every stop of the gradient. Worst-case, because borderless
 * text overlays the whole gradient.
 */
export function worstContrastAgainstBackground(
  textHex: string,
  bgHex: string,
  gradientValue: string,
): number {
  const backgrounds = [bgHex, ...extractHexStops(gradientValue)];
  return Math.min(...backgrounds.map((bg) => contrastRatio(textHex, bg)));
}

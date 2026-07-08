import { z } from "zod";

/**
 * Theme tokens are the styling contract between the platform and a theme. The
 * platform exposes a fixed set of tokens; a theme provides values. Tone names,
 * positive and urgent, map to token colors, so a feed that marks a glance
 * urgent is shown in the theme's urgent color.
 */

/**
 * A CSS color value from a theme. Applied via setProperty, which already ignores
 * invalid CSS (so this is not an injection sink), but a custom or imported theme
 * is untrusted, so reject the substrings that could smuggle a request or markup
 * while leaving hex/rgb/hsl/oklch/named syntax open for theme authors.
 */
const DANGEROUS_CSS = /[<>]|url\(|expression\(|javascript:/i;
const cssColor = z
  .string()
  .min(1)
  .refine((value) => !DANGEROUS_CSS.test(value), { message: "unsafe color value" });

export const ThemeTokensSchema = z.object({
  color: z.object({
    bg: cssColor,
    surface: cssColor,
    text: cssColor,
    muted: cssColor,
    accent: cssColor,
    positive: cssColor,
    urgent: cssColor,
    // The brand palette the redesign paints with: a primary and secondary, plus
    // three accents used for skylines, daylight gradients, and chart series.
    primary: cssColor,
    secondary: cssColor,
    accent1: cssColor,
    accent2: cssColor,
    accent3: cssColor,
  }),
  type: z.object({
    fontFamily: z.string(),
    scale: z.number().positive(),
    numericTabular: z.boolean(),
  }),
  space: z.object({
    unit: z.number().positive(),
    cardPadding: z.number().nonnegative(),
    cardRadius: z.number().nonnegative(),
  }),
  motion: z.object({
    enabled: z.boolean(),
    speed: z.number().nonnegative(),
  }),
  background: z.object({
    mode: z.enum(["solid", "gradient", "image"]),
    value: z.string(),
    imageOfDay: z.boolean(),
  }),
});
export type ThemeTokens = z.infer<typeof ThemeTokensSchema>;

export const ThemeMetaSchema = z.object({
  themeId: z.string().min(1),
  name: z.string().min(1),
  author: z.string(),
  tier: z.enum(["token", "render"]),
});
export type ThemeMeta = z.infer<typeof ThemeMetaSchema>;

export interface Theme {
  meta: ThemeMeta;
  tokens: ThemeTokens;
}

/**
 * A whole theme (meta plus tokens), used to validate a theme imported or shared
 * as JSON before it is trusted as a custom theme.
 */
export const ThemeSchema = z.object({
  meta: ThemeMetaSchema,
  tokens: ThemeTokensSchema,
});

/** Parse unknown JSON into a Theme, or undefined when it is not a valid theme. */
export function parseTheme(raw: unknown): Theme | undefined {
  const result = ThemeSchema.safeParse(raw);
  return result.success ? result.data : undefined;
}

/** Flatten tokens into the CSS custom properties the renderers consume. */
export function tokensToCssVars(tokens: ThemeTokens): Record<string, string> {
  return {
    "--cc-color-bg": tokens.color.bg,
    "--cc-color-surface": tokens.color.surface,
    "--cc-color-text": tokens.color.text,
    "--cc-color-muted": tokens.color.muted,
    "--cc-color-accent": tokens.color.accent,
    "--cc-color-positive": tokens.color.positive,
    "--cc-color-urgent": tokens.color.urgent,
    "--cc-color-primary": tokens.color.primary,
    "--cc-color-secondary": tokens.color.secondary,
    "--cc-color-accent-1": tokens.color.accent1,
    "--cc-color-accent-2": tokens.color.accent2,
    "--cc-color-accent-3": tokens.color.accent3,
    "--cc-font-family": tokens.type.fontFamily,
    "--cc-font-scale": String(tokens.type.scale),
    "--cc-numeric": tokens.type.numericTabular ? "tabular-nums" : "normal",
    "--cc-space-unit": `${String(tokens.space.unit)}px`,
    "--cc-card-padding": `${String(tokens.space.cardPadding)}px`,
    "--cc-card-radius": `${String(tokens.space.cardRadius)}px`,
    "--cc-motion-speed": tokens.motion.enabled ? String(tokens.motion.speed) : "0",
    "--cc-bg": tokens.background.value,
  };
}

export interface ApplyTokensOptions {
  /** When true, motion speed is forced to zero regardless of the token. */
  reducedMotion?: boolean;
}

/** Apply tokens as CSS custom properties on an element. */
export function applyTokens(
  root: HTMLElement,
  tokens: ThemeTokens,
  options: ApplyTokensOptions = {},
): void {
  const vars = tokensToCssVars(tokens);
  if (options.reducedMotion === true) vars["--cc-motion-speed"] = "0";
  for (const [name, value] of Object.entries(vars)) {
    root.style.setProperty(name, value);
  }
}

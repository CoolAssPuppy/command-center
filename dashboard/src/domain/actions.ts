import { z } from "zod";

/**
 * Actions are how a widget item asks for something to happen without ever
 * opening a URL itself. A widget references an action `id` declared in the
 * provider manifest, and supplies params. The platform resolves the template
 * or route, validates the scheme and host, and only then navigates.
 * See docs/10-security.md.
 */

/** A reference from a widget item to a declared action, with fill-in params. */
export const ActionRefSchema = z.object({
  ref: z.string().min(1),
  params: z.record(z.string(), z.string()).optional(),
});
export type ActionRef = z.infer<typeof ActionRefSchema>;

/**
 * An action a provider declares in its manifest. Exactly one of `urlTemplate`
 * or `route` is used. `urlTemplate` opens an app-specific URL with `{token}`
 * placeholders filled from params. `route` hands off to a known
 * commandcenter:// route that the native app validates and performs.
 */
export const ManifestActionSchema = z
  .object({
    id: z.string().min(1),
    title: z.string().optional(),
    urlTemplate: z.string().optional(),
    route: z.string().optional(),
  })
  .refine((action) => Boolean(action.urlTemplate) !== Boolean(action.route), {
    message: "an action needs exactly one of urlTemplate or route",
  });
export type ManifestAction = z.infer<typeof ManifestActionSchema>;

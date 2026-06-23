import { z } from "zod";

import { firstIssue, type ParseResult } from "../domain/result";
import {
  NEEDS_AUTH,
  type Integration,
  type IntegrationContext,
  type NormalizedItem,
} from "./types";

/**
 * The Linear integration. Linear OAuth needs a client secret, which a public
 * extension can't hold, so this uses a personal API key (kept in local secrets)
 * sent straight in the Authorization header. It queries the viewer's open
 * assigned issues and normalizes each into a text-only item linking to Linear.
 */
const ENDPOINT = "https://api.linear.app/graphql";

export const LinearConfigSchema = z.object({
  limit: z.number().int().positive().max(25).default(10),
});
export type LinearConfig = z.infer<typeof LinearConfigSchema>;

const QUERY = `query CommandCenterInbox($first: Int!) {
  viewer {
    assignedIssues(first: $first, filter: { completedAt: { null: true } }) {
      nodes { identifier title url state { name } }
    }
  }
}`;

const ResponseSchema = z.object({
  data: z
    .object({
      viewer: z.object({
        assignedIssues: z.object({
          nodes: z.array(
            z.object({
              identifier: z.string(),
              title: z.string(),
              url: z.string().optional(),
              state: z.object({ name: z.string() }).optional(),
            }),
          ),
        }),
      }),
    })
    .optional(),
  errors: z.array(z.object({ message: z.string() })).optional(),
});

export const linearIntegration: Integration = {
  id: "linear",
  displayName: "Linear",

  async fetch(
    rawConfig: unknown,
    ctx: IntegrationContext,
  ): Promise<ParseResult<NormalizedItem[]>> {
    const parsed = LinearConfigSchema.safeParse(rawConfig ?? {});
    if (!parsed.success) {
      return { ok: false, error: firstIssue(parsed.error, "invalid Linear config") };
    }
    const key = ctx.secrets.linearApiKey;
    if (key === undefined || key.trim().length === 0) {
      return { ok: false, error: NEEDS_AUTH };
    }

    let payload: unknown;
    try {
      const response = await ctx.fetch({
        url: ENDPOINT,
        method: "POST",
        headers: { Authorization: key, "Content-Type": "application/json" },
        body: JSON.stringify({ query: QUERY, variables: { first: parsed.data.limit } }),
      });
      if (response.status === 401 || response.status === 400) {
        return { ok: false, error: NEEDS_AUTH };
      }
      if (!response.ok) {
        return { ok: false, error: `Linear request failed (${response.status})` };
      }
      payload = await response.json();
    } catch (cause) {
      const message = cause instanceof Error ? cause.message : "Linear request failed";
      return { ok: false, error: message };
    }

    const result = ResponseSchema.safeParse(payload);
    if (!result.success) {
      return { ok: false, error: firstIssue(result.error, "invalid Linear response") };
    }
    if (result.data.errors !== undefined && result.data.errors.length > 0) {
      const first = result.data.errors[0];
      return { ok: false, error: first?.message ?? "Linear returned an error" };
    }
    if (result.data.data === undefined) {
      return { ok: false, error: "Linear returned no data" };
    }

    const items: NormalizedItem[] = result.data.data.viewer.assignedIssues.nodes.map(
      (issue) => {
        const item: NormalizedItem = { id: issue.identifier, title: issue.title };
        if (issue.state !== undefined) item.subtitle = issue.state.name;
        if (issue.url !== undefined) item.url = issue.url;
        item.meta = issue.identifier;
        return item;
      },
    );
    return { ok: true, value: items };
  },
};

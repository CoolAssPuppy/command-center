import { z } from "zod";

import type { Connection } from "../config/schema";
import { firstIssue, type ParseResult } from "../domain/result";
import {
  NEEDS_AUTH,
  type Integration,
  type IntegrationContext,
  type NormalizedItem,
} from "./types";

/**
 * The Linear integration. Uses the connection's personal API key (a secret) in
 * the Authorization header and queries the viewer's open assigned issues,
 * normalizing each into a text-only item linking to Linear.
 */
const ENDPOINT = "https://api.linear.app/graphql";

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
    connection: Connection,
    secret: string | undefined,
    ctx: IntegrationContext,
  ): Promise<ParseResult<NormalizedItem[]>> {
    if (secret === undefined || secret.trim().length === 0) {
      return { ok: false, error: NEEDS_AUTH };
    }

    let payload: unknown;
    try {
      const response = await ctx.fetch({
        url: ENDPOINT,
        method: "POST",
        headers: { Authorization: secret, "Content-Type": "application/json" },
        body: JSON.stringify({
          query: QUERY,
          variables: { first: connection.count ?? 6 },
        }),
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
      return { ok: false, error: result.data.errors[0]?.message ?? "Linear error" };
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

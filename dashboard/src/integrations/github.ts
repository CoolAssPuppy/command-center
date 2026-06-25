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
 * The GitHub integration. Uses the connection's personal access token (a secret)
 * as a bearer credential and runs a GitHub issue/PR search, normalizing each hit
 * into a text-only item linking to the pull request or issue. The search query
 * is the one knob: the default surfaces pull requests awaiting your review, but
 * any GitHub search works ("is:open is:pr author:@me", "is:open assignee:@me",
 * and so on), so a single integration covers reviews, your own PRs, assigned
 * issues, and mentions, each as its own connection.
 */
const ENDPOINT = "https://api.github.com/search/issues";
const DEFAULT_QUERY = "is:open is:pr review-requested:@me";
const API_VERSION = "2022-11-28";

const ItemSchema = z.object({
  title: z.string(),
  html_url: z.string().optional(),
  number: z.number().optional(),
  repository_url: z.string().optional(),
  updated_at: z.string().optional(),
});

const ResponseSchema = z.object({
  items: z.array(ItemSchema).optional(),
  /** GitHub puts the human-readable cause here on a non-2xx response. */
  message: z.string().optional(),
});

/**
 * Pull "owner/repo" out of a repository API url
 * ("https://api.github.com/repos/owner/repo"). Returns undefined when the shape
 * is unexpected, so the subtitle is simply omitted rather than shown wrong.
 */
function repoSlug(repositoryUrl: string | undefined): string | undefined {
  if (repositoryUrl === undefined) return undefined;
  const match = repositoryUrl.match(/repos\/([^/]+\/[^/]+)$/);
  return match?.[1];
}

export const githubIntegration: Integration = {
  id: "github",
  displayName: "GitHub",

  async fetch(
    connection: Connection,
    secret: string | undefined,
    ctx: IntegrationContext,
  ): Promise<ParseResult<NormalizedItem[]>> {
    if (secret === undefined || secret.trim().length === 0) {
      return { ok: false, error: NEEDS_AUTH };
    }

    const query = connection.query?.trim() || DEFAULT_QUERY;
    // A review request is something waiting on you; lift it in the "needs you"
    // lane. Your own PRs and other searches stay calm.
    const reviewRequested = query.includes("review-requested");
    const perPage = connection.count ?? 6;
    const url =
      `${ENDPOINT}?q=${encodeURIComponent(query)}` +
      `&per_page=${perPage}&sort=updated&order=desc`;

    let payload: unknown;
    try {
      const response = await ctx.fetch({
        url,
        method: "GET",
        headers: {
          Authorization: `Bearer ${secret}`,
          Accept: "application/vnd.github+json",
          "X-GitHub-Api-Version": API_VERSION,
        },
      });
      if (response.status === 401) return { ok: false, error: NEEDS_AUTH };
      if (!response.ok) {
        // GitHub's error body carries a precise message; surface it verbatim
        // instead of a bare status, so a bad query reads as such.
        const detail = ResponseSchema.safeParse(await response.json().catch(() => undefined));
        const apiMessage = detail.success ? detail.data.message : undefined;
        return { ok: false, error: apiMessage ?? `GitHub request failed (${response.status})` };
      }
      payload = await response.json();
    } catch (cause) {
      const message = cause instanceof Error ? cause.message : "GitHub request failed";
      return { ok: false, error: message };
    }

    const result = ResponseSchema.safeParse(payload);
    if (!result.success) {
      return { ok: false, error: firstIssue(result.error, "invalid GitHub response") };
    }

    const items: NormalizedItem[] = (result.data.items ?? []).map((entry, index) => {
      const slug = repoSlug(entry.repository_url);
      const item: NormalizedItem = {
        id: entry.html_url ?? `${slug ?? "github"}#${entry.number ?? index}`,
        title: entry.title,
      };
      if (slug !== undefined) item.subtitle = slug;
      if (entry.html_url !== undefined) item.url = entry.html_url;
      if (entry.number !== undefined) item.meta = `#${entry.number}`;
      if (entry.updated_at !== undefined) item.sortKey = entry.updated_at;
      if (reviewRequested) item.tone = "urgent";
      return item;
    });
    return { ok: true, value: items };
  },
};

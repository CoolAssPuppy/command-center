import { describe, expect, it } from "vitest";

import type { IntegrationSource } from "../config/schema";
import { githubIntegration } from "./github";
import {
  NEEDS_AUTH,
  type HttpRequest,
  type HttpResponseLike,
  type IntegrationContext,
} from "./types";

const json = (body: unknown): HttpResponseLike => ({
  ok: true,
  status: 200,
  json: () => Promise.resolve(body),
});

const searchBody = (items: unknown[]): unknown => ({ items });

const ctx = (
  fetch: (request: HttpRequest) => Promise<HttpResponseLike>,
): IntegrationContext => ({ fetch, now: new Date("2026-06-24T00:00:00Z") });

const connection = (overrides: Partial<IntegrationSource> = {}): IntegrationSource => ({
  id: "c1",
  name: "Reviews",
  service: "github",
  ...overrides,
});

describe("githubIntegration", () => {
  it("returns needs-auth without a token", async () => {
    const result = await githubIntegration.fetch(
      connection(),
      undefined,
      ctx(() => Promise.resolve(json(searchBody([])))),
    );
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error).toBe(NEEDS_AUTH);
  });

  it("searches with the default query and normalizes pull requests", async () => {
    let captured: HttpRequest | undefined;
    const fetch = (request: HttpRequest): Promise<HttpResponseLike> => {
      captured = request;
      return Promise.resolve(
        json(
          searchBody([
            {
              title: "Fix cold-start crash",
              html_url: "https://github.com/acme/web/pull/412",
              number: 412,
              repository_url: "https://api.github.com/repos/acme/web",
              updated_at: "2026-06-23T18:00:00Z",
            },
          ]),
        ),
      );
    };
    const result = await githubIntegration.fetch(connection({ count: 5 }), "ghp_token", ctx(fetch));

    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.value[0]).toMatchObject({
      title: "Fix cold-start crash",
      subtitle: "acme/web",
      url: "https://github.com/acme/web/pull/412",
      meta: "#412",
      sortKey: "2026-06-23T18:00:00Z",
    });
    expect(captured?.headers?.Authorization).toBe("Bearer ghp_token");
    expect(captured?.url).toContain("review-requested%3A%40me");
    expect(captured?.url).toContain("per_page=5");
  });

  it("uses a custom query when the connection sets one", async () => {
    let captured: HttpRequest | undefined;
    const fetch = (request: HttpRequest): Promise<HttpResponseLike> => {
      captured = request;
      return Promise.resolve(json(searchBody([])));
    };
    await githubIntegration.fetch(
      connection({ query: "is:open is:pr author:@me" }),
      "ghp_token",
      ctx(fetch),
    );
    expect(captured?.url).toContain(encodeURIComponent("is:open is:pr author:@me"));
  });

  it("maps 401 to needs-auth", async () => {
    const result = await githubIntegration.fetch(
      connection(),
      "ghp_token",
      ctx(() => Promise.resolve({ ok: false, status: 401, json: () => Promise.resolve({}) })),
    );
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error).toBe(NEEDS_AUTH);
  });

  it("surfaces GitHub's error message verbatim", async () => {
    const result = await githubIntegration.fetch(
      connection(),
      "ghp_token",
      ctx(() =>
        Promise.resolve({
          ok: false,
          status: 422,
          json: () => Promise.resolve({ message: "Validation Failed" }),
        }),
      ),
    );
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error).toBe("Validation Failed");
  });
});

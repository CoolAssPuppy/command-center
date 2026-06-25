import type { Connection } from "../config/schema";
import type { ParseResult } from "../domain/result";

/**
 * The integration platform. An integration turns some external source (a Notion
 * database first, others later) into a list of normalized, text-only items the
 * work-stream shell can render. Integrations never touch the DOM, never hold
 * secrets of their own, and never open a URL: they return data, the platform
 * renders and validates it. This keeps adding a new source small and safe.
 */
export interface NormalizedItem {
  id: string;
  title: string;
  subtitle?: string;
  /** An external link for the item; validated before it is ever navigated. */
  url?: string;
  /** A short trailing note, e.g. a status or date. */
  meta?: string;
  /** An opaque sort key (e.g. an ISO start time) for merging across sources. */
  sortKey?: string;
}

/** A minimal HTTP client so integrations can POST with headers, injected for tests. */
export interface HttpRequest {
  url: string;
  method?: string;
  headers?: Record<string, string>;
  body?: string;
}

export interface HttpResponseLike {
  ok: boolean;
  status: number;
  json(): Promise<unknown>;
}

export type HttpFetch = (request: HttpRequest) => Promise<HttpResponseLike>;

export interface IntegrationContext {
  fetch: HttpFetch;
  now: Date;
  /**
   * Obtain an OAuth access token for a provider (e.g. "google"), or undefined if
   * not connected. The optional connectionId selects a specific account, so each
   * Google Calendar connection can be a different signed-in account. Backed by
   * chrome.identity in the extension; injected in tests.
   */
  getAuthToken?: (
    provider: string,
    connectionId?: string,
  ) => Promise<string | undefined>;
}

/** A sentinel error an integration returns when its credential is missing. */
export const NEEDS_AUTH = "needs_auth";

export interface Integration {
  /** Matches Connection.service. */
  id: string;
  displayName: string;
  /**
   * Fetch items for a connection. `secret` is the connection's credential (a
   * Linear key or Notion token); Google Calendar ignores it and uses
   * ctx.getAuthToken instead.
   */
  fetch(
    connection: Connection,
    secret: string | undefined,
    ctx: IntegrationContext,
  ): Promise<ParseResult<NormalizedItem[]>>;
}

/** The display state of an integration stream, resolved by the platform. */
export interface IntegrationResult {
  status: "loading" | "ok" | "error" | "needs_auth";
  items?: NormalizedItem[];
  error?: string;
}

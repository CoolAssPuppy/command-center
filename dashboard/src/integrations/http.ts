import type { HttpFetch, HttpRequest } from "./types";

/** The real HTTP client backing integrations, wrapping the global fetch. */
export const realHttpFetch: HttpFetch = async (request) => {
  const init: RequestInit = { method: request.method ?? "GET" };
  if (request.headers !== undefined) init.headers = request.headers;
  if (request.body !== undefined) init.body = request.body;
  const response = await fetch(request.url, init);
  return {
    ok: response.ok,
    status: response.status,
    json: () => response.json(),
    text: () => response.text(),
  };
};

/** One request's outcome, after the shared transport catch and a lenient body read. */
export interface JsonResponse {
  /** HTTP status; 0 when the request threw before any response arrived. */
  status: number;
  /** True when the status was 2xx. */
  ok: boolean;
  /** Parsed JSON body, or undefined when there was none or it was unreadable. */
  body: unknown;
  /** Set only when the request threw at the transport level (network, abort). */
  transportError?: string;
}

/**
 * Run one request and read its JSON body in a single place, so every integration
 * shares the same transport catch instead of copying it. The body is parsed once
 * and returned for success and error statuses alike; callers map the status to
 * needs-auth or an error and validate the body with their own schema.
 */
export async function fetchJson(
  fetch: HttpFetch,
  request: HttpRequest,
  serviceName: string,
): Promise<JsonResponse> {
  try {
    const response = await fetch(request);
    const body = await response.json().catch(() => undefined);
    return { status: response.status, ok: response.ok, body };
  } catch (cause) {
    const transportError =
      cause instanceof Error ? cause.message : `${serviceName} request failed`;
    return { status: 0, ok: false, body: undefined, transportError };
  }
}

import type { HttpFetch } from "./types";

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
  };
};

import { describe, expect, it } from "vitest";

import manifest from "../../public/manifest.json";
import { buildCsp, CONNECT_HOSTS, DEFAULT_CSP } from "./csp";

describe("DEFAULT_CSP", () => {
  it("restricts scripts to self, with no inline or eval", () => {
    expect(DEFAULT_CSP).toContain("script-src 'self'");
    expect(DEFAULT_CSP).not.toContain("script-src 'self' 'unsafe-inline'");
    expect(DEFAULT_CSP).not.toContain("'unsafe-eval'");
  });

  it("allows outbound connections only to self and the known hosts", () => {
    expect(DEFAULT_CSP).toContain(
      "connect-src 'self' https://api.open-meteo.com https://api.unsplash.com https://api.notion.com",
    );
  });

  it("defaults to self", () => {
    expect(DEFAULT_CSP).toContain("default-src 'self'");
  });
});

describe("buildCsp", () => {
  it("adds extra connect hosts without weakening script-src", () => {
    const csp = buildCsp({ connectSrc: ["https://example.com"] });
    for (const host of CONNECT_HOSTS) expect(csp).toContain(host);
    expect(csp).toContain("https://example.com");
    expect(csp).toContain("script-src 'self'");
  });
});

describe("manifest CSP", () => {
  it("matches the single-source DEFAULT_CSP", () => {
    expect(manifest.content_security_policy.extension_pages).toBe(DEFAULT_CSP);
  });
});

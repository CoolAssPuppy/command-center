import { describe, expect, it } from "vitest";

import { buildCsp, DEFAULT_CSP } from "./csp";

describe("DEFAULT_CSP", () => {
  it("restricts scripts to self, with no inline or eval", () => {
    expect(DEFAULT_CSP).toContain("script-src 'self'");
    expect(DEFAULT_CSP).not.toContain("script-src 'self' 'unsafe-inline'");
    expect(DEFAULT_CSP).not.toContain("'unsafe-eval'");
  });

  it("allows outbound connections only to self and the weather host", () => {
    expect(DEFAULT_CSP).toContain("connect-src 'self' https://api.open-meteo.com");
  });

  it("defaults to self", () => {
    expect(DEFAULT_CSP).toContain("default-src 'self'");
  });
});

describe("buildCsp", () => {
  it("adds extra connect hosts without weakening script-src", () => {
    const csp = buildCsp({ connectSrc: ["https://example.com"] });

    expect(csp).toContain("https://api.open-meteo.com");
    expect(csp).toContain("https://example.com");
    expect(csp).toContain("script-src 'self'");
  });
});

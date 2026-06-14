import { describe, expect, it } from "vitest";

import { isSafeUrl, resolveActionUrl } from "./url";

describe("isSafeUrl", () => {
  it("allows https and the commandcenter scheme by default", () => {
    expect(isSafeUrl("https://linear.app/x")).toBe(true);
    expect(isSafeUrl("commandcenter://join")).toBe(true);
  });

  it("always blocks dangerous schemes, even if someone allowlists them", () => {
    expect(isSafeUrl("javascript:alert(1)")).toBe(false);
    expect(isSafeUrl("data:text/html,<script>1</script>")).toBe(false);
    expect(isSafeUrl("file:///etc/passwd")).toBe(false);
    expect(isSafeUrl("vbscript:msgbox")).toBe(false);
    expect(isSafeUrl("javascript:alert(1)", ["javascript:"])).toBe(false);
  });

  it("rejects a scheme that is not on the allowlist", () => {
    expect(isSafeUrl("linearbar://open")).toBe(false);
    expect(isSafeUrl("linearbar://open", ["linearbar:"])).toBe(true);
  });

  it("rejects an unparseable url", () => {
    expect(isSafeUrl("not a url")).toBe(false);
  });
});

describe("resolveActionUrl", () => {
  it("builds a commandcenter route with encoded params", () => {
    const result = resolveActionUrl(
      { id: "join", route: "commandcenter://join" },
      { ref: "join", params: { url: "https://meet.google.com/x", platform: "meet" } },
    );

    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.value.startsWith("commandcenter://join?")).toBe(true);
    expect(result.value).toContain("url=https%3A%2F%2Fmeet.google.com%2Fx");
    expect(result.value).toContain("platform=meet");
  });

  it("fills a urlTemplate, but only when its scheme is allowlisted", () => {
    const action = { id: "open", urlTemplate: "linearbar://open?url={url}" };
    const ref = { ref: "open", params: { url: "https://linear.app/x" } };

    expect(resolveActionUrl(action, ref).ok).toBe(false); // linearbar not allowed by default

    const allowed = resolveActionUrl(action, ref, { allowedSchemes: ["linearbar:"] });
    expect(allowed.ok).toBe(true);
    if (allowed.ok) {
      expect(allowed.value).toContain("url=https%3A%2F%2Flinear.app%2Fx");
    }
  });

  it("cannot have its scheme changed by a malicious param value", () => {
    const result = resolveActionUrl(
      { id: "join", urlTemplate: "commandcenter://join?url={url}" },
      { ref: "join", params: { url: "javascript:alert(1)" } },
    );

    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.value.startsWith("commandcenter:")).toBe(true);
    // the dangerous value is encoded data inside the query, not a new scheme
    expect(result.value).toContain("javascript%3Aalert");
    expect(result.value.startsWith("javascript:")).toBe(false);
  });

  it("rejects a template whose own scheme is dangerous", () => {
    const result = resolveActionUrl(
      { id: "x", urlTemplate: "javascript:alert({n})" },
      { ref: "x", params: { n: "1" } },
    );

    expect(result.ok).toBe(false);
  });

  it("rejects an action whose template references a missing param", () => {
    const result = resolveActionUrl(
      { id: "open", urlTemplate: "https://x/{id}" },
      { ref: "open", params: {} },
    );

    expect(result.ok).toBe(false);
  });
});

import { describe, expect, it } from "vitest";

import { isSafeUrl } from "./url";

describe("isSafeUrl", () => {
  it("allows http and https by default", () => {
    expect(isSafeUrl("https://github.com")).toBe(true);
    expect(isSafeUrl("http://example.com")).toBe(true);
  });

  it("always blocks dangerous schemes, even if someone allowlists them", () => {
    expect(isSafeUrl("javascript:alert(1)")).toBe(false);
    expect(isSafeUrl("data:text/html,<script>1</script>")).toBe(false);
    expect(isSafeUrl("file:///etc/passwd")).toBe(false);
    expect(isSafeUrl("vbscript:msgbox")).toBe(false);
    expect(isSafeUrl("javascript:alert(1)", ["javascript:"])).toBe(false);
  });

  it("rejects a scheme that is not on the allowlist", () => {
    expect(isSafeUrl("ftp://host/file")).toBe(false);
    expect(isSafeUrl("ftp://host/file", ["ftp:"])).toBe(true);
  });

  it("rejects an unparseable url", () => {
    expect(isSafeUrl("not a url")).toBe(false);
  });
});

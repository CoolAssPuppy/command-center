import { describe, expect, it } from "vitest";

import { setText } from "./dom";

const XSS = '<img src=x onerror="alert(1)"><script>alert(2)</script>';

describe("setText", () => {
  it("writes provider text as text, never as markup", () => {
    const host = document.createElement("div");

    setText(host, XSS);

    expect(host.textContent).toBe(XSS);
    expect(host.children).toHaveLength(0);
    expect(host.querySelector("img")).toBeNull();
    expect(host.querySelector("script")).toBeNull();
  });
});


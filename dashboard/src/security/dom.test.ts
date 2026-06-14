import { describe, expect, it } from "vitest";

import { setText, textEl } from "./dom";

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

describe("textEl", () => {
  it("creates an element whose content is inert text", () => {
    const el = textEl("span", XSS);

    expect(el.tagName).toBe("SPAN");
    expect(el.textContent).toBe(XSS);
    expect(el.children).toHaveLength(0);
  });

  it("applies a class name when given", () => {
    const el = textEl("div", "hello", { className: "title" });

    expect(el.className).toBe("title");
    expect(el.textContent).toBe("hello");
  });
});

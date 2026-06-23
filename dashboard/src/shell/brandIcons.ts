import { el, svgEl } from "../render/helpers";

/**
 * Small brand-mark tiles for the integration panels: a Google Calendar "31", the
 * Linear mark, and the Notion "N". Brand colors are intentional and theme-
 * independent, so they are set inline rather than via tokens. Returns undefined
 * for sources without a mark, so the caller simply omits the icon.
 */
function tile(background: string, border?: string): HTMLElement {
  const node = el("div", "cc-brand");
  node.style.background = background;
  if (border !== undefined) node.style.border = `1px solid ${border}`;
  return node;
}

function glyph(text: string, color: string, fontSize: string, weight: string): HTMLElement {
  const span = el("span", "cc-brand__glyph", text);
  span.style.color = color;
  span.style.fontSize = fontSize;
  span.style.fontWeight = weight;
  return span;
}

export function brandIcon(integrationId: string): HTMLElement | undefined {
  if (integrationId === "google-calendar") {
    const node = tile("#FCFCFA", "rgba(0,0,0,0.12)");
    node.appendChild(glyph("31", "#4285F4", "10px", "700"));
    return node;
  }
  if (integrationId === "notion") {
    const node = tile("#FBFBF9", "rgba(0,0,0,0.14)");
    node.appendChild(glyph("N", "#191919", "13px", "800"));
    return node;
  }
  if (integrationId === "linear") {
    const node = tile("#5E6AD2");
    const svg = svgEl("svg", { width: "12", height: "12", viewBox: "0 0 22 22", fill: "none" });
    for (const d of ["M3 12.5 L9.5 19", "M3 7 L15 19", "M4.5 3 L19 17.5"]) {
      svg.appendChild(
        svgEl("path", {
          d,
          stroke: "#FFFFFF",
          "stroke-width": "2.2",
          "stroke-linecap": "round",
        }),
      );
    }
    node.appendChild(svg);
    return node;
  }
  return undefined;
}

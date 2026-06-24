import { el, svgEl } from "../render/helpers";

/**
 * Real brand icons for well-known dock links. Google's favicon service returns
 * a generic mark for Gmail and Calendar, so for those hosts we draw the actual
 * logos on a white app tile, matching the dock's icon size.
 */
function tile(): HTMLElement {
  const node = el("span", "cc-dock__brand");
  return node;
}

function gmail(): HTMLElement {
  const node = tile();
  const svg = svgEl("svg", { viewBox: "0 0 48 48", width: "20", height: "20" });
  svg.appendChild(svgEl("path", { fill: "#4caf50", d: "M45,16.2l-5,2.75l-5,4.75L35,40h7c1.657,0,3-1.343,3-3V16.2z" }));
  svg.appendChild(svgEl("path", { fill: "#1e88e5", d: "M3,16.2l3.614,1.71L13,23.7V40H6c-1.657,0-3-1.343-3-3V16.2z" }));
  svg.appendChild(
    svgEl("polygon", {
      fill: "#e53935",
      points: "35,11.2 24,19.45 13,11.2 12,17 13,23.7 24,31.95 35,23.7 36,17",
    }),
  );
  svg.appendChild(
    svgEl("path", {
      fill: "#c62828",
      d: "M3,12.298V16.2l10,7.5V11.2L9.876,8.859C9.132,8.301,8.228,8,7.298,8h0C4.924,8,3,9.924,3,12.298z",
    }),
  );
  svg.appendChild(
    svgEl("path", {
      fill: "#fbc02d",
      d: "M45,12.298V16.2l-10,7.5V11.2l3.124-2.341C38.868,8.301,39.772,8,40.702,8h0C43.076,8,45,9.924,45,12.298z",
    }),
  );
  node.appendChild(svg);
  return node;
}

function googleCalendar(): HTMLElement {
  const node = tile();
  const mark = svgEl("svg", { viewBox: "0 0 24 24", width: "20", height: "20", fill: "none" });
  mark.appendChild(svgEl("rect", { x: "7.4", y: "2.4", width: "1.5", height: "4", rx: "0.75", fill: "#4285F4" }));
  mark.appendChild(svgEl("rect", { x: "15.1", y: "2.4", width: "1.5", height: "4", rx: "0.75", fill: "#4285F4" }));
  mark.appendChild(svgEl("rect", { x: "4", y: "4", width: "16", height: "4", rx: "1", fill: "#4285F4" }));
  const text = svgEl("text", {
    x: "12",
    y: "18.5",
    "text-anchor": "middle",
    "font-family": "Archivo, sans-serif",
    "font-size": "9.5",
    "font-weight": "700",
    fill: "#4285F4",
  });
  text.textContent = "31";
  mark.appendChild(text);
  node.appendChild(mark);
  return node;
}

/** A bundled brand icon for a known host, or undefined to use the favicon. */
export function dockBrandIcon(host: string): HTMLElement | undefined {
  const bare = host.replace(/^www\./, "");
  if (bare === "mail.google.com" || bare === "gmail.com" || bare === "googlemail.com") {
    return gmail();
  }
  if (bare === "calendar.google.com") return googleCalendar();
  return undefined;
}

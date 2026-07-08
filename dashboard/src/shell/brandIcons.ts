import { el, svgEl } from "../render/helpers";
import { googleCalendarLogo } from "./googleCalendarLogo";

/**
 * Brand-mark tiles for the integration panels. Each is the service's real logo
 * on a white app-tile: the Google Calendar "31", the Linear mark, the Notion
 * "N", and the GitHub mark. Brand colors are intentional and theme-independent.
 * Returns undefined for sources without a mark.
 */
function tile(): HTMLElement {
  // The logos (Google blue, Linear indigo, Notion ink) need a light ground to
  // stay legible, so the tile is light on every theme. A warm off-white plus a
  // soft ring keeps it from glaring as a pure-white chip on the dark themes.
  // Decorative: the stream title already names the service.
  const node = el("div", "cc-brand");
  node.setAttribute("aria-hidden", "true");
  node.style.background = "#F5F2EC";
  node.style.border = "1px solid rgba(20,22,28,0.12)";
  return node;
}

function svg(viewBox: string): SVGElement {
  return svgEl("svg", { viewBox, width: "15", height: "15", fill: "none" });
}

function googleCalendar(): HTMLElement {
  // The real Calendar logo is full color with a white body, so it gets a white
  // ground instead of the off-white used for the monochrome marks.
  const node = tile();
  node.style.background = "#ffffff";
  node.appendChild(googleCalendarLogo(20));
  return node;
}

function linear(): HTMLElement {
  const node = tile();
  const mark = svg("0 0 24 24");
  mark.appendChild(
    svgEl("path", {
      fill: "#5E6AD2",
      d: "M2.886 4.18A11.98 11.98 0 0 1 11.99 0C18.624 0 24 5.376 24 12.01c0 3.64-1.62 6.902-4.18 9.104L2.886 4.18ZM.682 7.679a12.06 12.06 0 0 0-.633 3.34L12.98 23.95a12.06 12.06 0 0 0 3.34-.633L.682 7.68ZM.012 12.93l11.057 11.057c-2.74-.244-5.3-1.45-7.255-3.4l-.401-.401C1.461 18.23.256 15.67.012 12.93Zm.717 4.342 6.012 6.011c-2.359-.804-4.225-2.43-5.226-4.627a8.7 8.7 0 0 1-.786-1.384Z",
    }),
  );
  node.appendChild(mark);
  return node;
}

function notion(): HTMLElement {
  const node = tile();
  const mark = svg("0 0 24 24");
  // The real Notion mark: the folded page with the angular "N" inside, in Notion
  // ink. (Simple Icons path.) Replaces an earlier hand-drawn stroke "N".
  mark.appendChild(
    svgEl("path", {
      fill: "#0F0F0F",
      d: "M4.459 4.208c.746.606 1.026.56 2.428.466l13.215-.793c.28 0 .047-.28-.046-.326L17.86 1.968c-.42-.326-.981-.7-2.055-.607L3.01 2.295c-.466.046-.56.28-.374.466zm.793 3.08v13.904c0 .747.373 1.027 1.214.98l14.523-.84c.841-.046.935-.56.935-1.167V6.354c0-.606-.233-.933-.748-.887l-15.177.887c-.56.047-.747.327-.747.933zm14.337.745c.093.42 0 .84-.42.888l-.7.14v10.264c-.608.327-1.168.514-1.635.514-.748 0-.935-.234-1.495-.933l-4.577-7.186v6.952l1.448.328s0 .84-1.168.84l-3.222.186c-.093-.187 0-.653.327-.746l.84-.233V9.854L7.822 9.76c-.094-.42.14-1.026.793-1.073l3.456-.233 4.764 7.279v-6.44l-1.215-.14c-.093-.514.28-.887.747-.933zM1.936 1.035l13.31-.98c1.634-.14 2.055-.047 3.082.7l4.249 2.986c.7.513.934.653.934 1.213v16.378c0 1.026-.373 1.634-1.68 1.726l-15.458.934c-.98.047-1.448-.093-1.962-.746l-3.129-4.06c-.56-.747-.793-1.306-.793-1.96V2.667c0-.839.374-1.54 1.447-1.632z",
    }),
  );
  node.appendChild(mark);
  return node;
}

function github(): HTMLElement {
  const node = tile();
  const mark = svg("0 0 24 24");
  mark.appendChild(
    svgEl("path", {
      fill: "#181717",
      "fill-rule": "evenodd",
      "clip-rule": "evenodd",
      d: "M12 .297c-6.63 0-12 5.373-12 12 0 5.303 3.438 9.8 8.205 11.385.6.113.82-.258.82-.577 0-.285-.01-1.04-.015-2.04-3.338.724-4.042-1.61-4.042-1.61C4.422 18.07 3.633 17.7 3.633 17.7c-1.087-.744.084-.729.084-.729 1.205.084 1.838 1.236 1.838 1.236 1.07 1.835 2.809 1.305 3.495.998.108-.776.417-1.305.76-1.605-2.665-.3-5.466-1.332-5.466-5.93 0-1.31.465-2.38 1.235-3.22-.135-.303-.54-1.523.105-3.176 0 0 1.005-.322 3.3 1.23.96-.267 1.98-.399 3-.405 1.02.006 2.04.138 3 .405 2.28-1.552 3.285-1.23 3.285-1.23.645 1.653.24 2.873.12 3.176.765.84 1.23 1.91 1.23 3.22 0 4.61-2.805 5.625-5.475 5.92.42.36.81 1.096.81 2.22 0 1.606-.015 2.896-.015 3.286 0 .315.21.69.825.57C20.565 22.092 24 17.592 24 12.297c0-6.627-5.373-12-12-12",
    }),
  );
  node.appendChild(mark);
  return node;
}

export function brandIcon(integrationId: string): HTMLElement | undefined {
  if (integrationId === "google-calendar") return googleCalendar();
  if (integrationId === "linear") return linear();
  if (integrationId === "notion") return notion();
  if (integrationId === "github") return github();
  return undefined;
}

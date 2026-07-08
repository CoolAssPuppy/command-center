import { NEWS_FEEDS } from "../integrations/newsFeeds";
import { el, svgEl } from "../render/helpers";
import { checkRow, collapsibleSection, field, secretInput, textInput } from "./controls";
import type { SectionContext } from "./editPane";

/** A small upward line-chart mark for the Tickers section header. */
function tickerIcon(): SVGElement {
  const svg = svgEl("svg", {
    viewBox: "0 0 24 24",
    width: "16",
    height: "16",
    fill: "none",
    stroke: "currentColor",
    "stroke-width": "1.6",
    "stroke-linecap": "round",
    "stroke-linejoin": "round",
  });
  svg.appendChild(svgEl("polyline", { points: "3 16 9 10 13 14 21 6" }));
  svg.appendChild(svgEl("polyline", { points: "15 6 21 6 21 12" }));
  return svg;
}

/**
 * Whether the news-sources dropdown is open, kept across the pane's re-renders
 * (toggling a source re-renders the whole pane). Collapsed by default.
 */
let newsPickerOpen = false;

/**
 * The Tickers section: the ambient strips in the orientation band. Stocks need a
 * free Finnhub key (kept in Secrets) and a list of symbols; news reads Hacker
 * News with no key. Both are off until enabled, and render nothing when empty.
 */
export function renderTickersSection(host: HTMLElement, ctx: SectionContext): void {
  collapsibleSection(
    host,
    {
      title: "Tickers",
      key: "tickers",
      collapsed: ctx.collapsed,
      icon: tickerIcon(),
      description: "Scrolling stocks, forex, and news headlines up top.",
    },
    (section) => {
      section.appendChild(
        checkRow("Show stock ticker", ctx.draft.tickers.stocks.enabled, (checked) =>
          ctx.update((config) => {
            config.tickers.stocks.enabled = checked;
          }),
        ),
      );

      const symbols = textInput("AAPL, MSFT, NVDA");
      symbols.value = ctx.draft.tickers.stocks.symbols.join(", ");
      symbols.setAttribute("aria-label", "Stock symbols");
      symbols.addEventListener("change", () => {
        ctx.update((config) => {
          config.tickers.stocks.symbols = symbols.value
            .split(/[,\s]+/)
            .map((symbol) => symbol.trim().toUpperCase())
            .filter((symbol) => symbol.length > 0);
        });
      });
      section.appendChild(field("Symbols", symbols));

      const key = secretInput("Finnhub API key");
      key.setAttribute("aria-label", "Finnhub API key");
      key.value = ctx.draftSecrets.finnhubKey ?? "";
      key.addEventListener("change", () => {
        ctx.updateSecrets((secrets) => {
          const value = key.value.trim();
          if (value.length > 0) secrets.finnhubKey = value;
          else delete secrets.finnhubKey;
        });
      });
      section.appendChild(field("Finnhub key", key));
      section.appendChild(
        el(
          "div",
          "cc-edit__hint",
          "A free key from finnhub.io. Stored locally. Quotes update on each new tab.",
        ),
      );

      section.appendChild(
        checkRow("Show news ticker", ctx.draft.tickers.news.enabled, (checked) =>
          ctx.update((config) => {
            config.tickers.news.enabled = checked;
          }),
        ),
      );

      // When the news ticker is on, pick which curated feeds it pulls from,
      // tucked into a chevron dropdown so the list stays compact.
      if (ctx.draft.tickers.news.enabled) {
        const active = new Set(ctx.draft.tickers.news.sources);

        const details = document.createElement("details");
        details.className = "cc-edit__field cc-edit__picker";
        details.open = newsPickerOpen;
        details.addEventListener("toggle", () => {
          newsPickerOpen = details.open;
        });

        const summary = document.createElement("summary");
        summary.className = "cc-edit__picker-summary";
        const chevron = el("span", "cc-edit__picker-chevron", "›");
        chevron.setAttribute("aria-hidden", "true");
        summary.appendChild(chevron);
        summary.appendChild(
          el("span", undefined, `News sources · ${String(active.size)} selected`),
        );
        details.appendChild(summary);

        const list = el("div", "cc-edit__picker-list");
        for (const feed of NEWS_FEEDS) {
          list.appendChild(
            checkRow(feed.name, active.has(feed.id), (checked) =>
              ctx.update((config) => {
                const sources = new Set(config.tickers.news.sources);
                if (checked) sources.add(feed.id);
                else sources.delete(feed.id);
                config.tickers.news.sources = [...sources];
              }),
            ),
          );
        }
        details.appendChild(list);
        section.appendChild(details);
      }
    },
  );
}

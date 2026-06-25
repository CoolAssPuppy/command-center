import { NEWS_FEEDS } from "../integrations/newsFeeds";
import { el, svgEl } from "../render/helpers";
import { collapsibleSection, field, textInput } from "./controls";
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
 * The Tickers section: the ambient strips in the orientation band. Stocks need a
 * free Finnhub key (kept in Secrets) and a list of symbols; news reads Hacker
 * News with no key. Both are off until enabled, and render nothing when empty.
 */
export function renderTickersSection(host: HTMLElement, ctx: SectionContext): void {
  collapsibleSection(
    host,
    { title: "Tickers", key: "tickers", collapsed: ctx.collapsed, icon: tickerIcon() },
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

      const key = document.createElement("input");
      key.type = "password";
      key.className = "cc-edit__input";
      key.placeholder = "Finnhub API key";
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

      // When the news ticker is on, pick which curated feeds it pulls from.
      if (ctx.draft.tickers.news.enabled) {
        const list = el("div", "cc-edit__nested");
        const active = new Set(ctx.draft.tickers.news.sources);
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
        section.appendChild(list);
      }
    },
  );
}

function checkRow(
  label: string,
  checked: boolean,
  onChange: (checked: boolean) => void,
): HTMLElement {
  const row = el("label", "cc-edit__check");
  const box = document.createElement("input");
  box.type = "checkbox";
  box.checked = checked;
  box.addEventListener("change", () => {
    onChange(box.checked);
  });
  row.appendChild(box);
  row.appendChild(el("span", undefined, label));
  return row;
}

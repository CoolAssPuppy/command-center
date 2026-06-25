import type { StockQuote } from "../integrations/finnhub";
import type { NewsItem } from "../integrations/news";
import { el } from "../render/helpers";
import { isSafeUrl } from "../security/url";

/**
 * Ambient ticker strips for the orientation band: a quiet, slowly scrolling
 * marquee of stock quotes and one of news headlines. Deliberately low contrast,
 * so it never competes with the "needs you" lane. With reduced motion it holds
 * still and simply clips. Renders nothing when there is no data.
 */
export interface TickerOptions {
  reducedMotion: boolean;
  stocks?: StockQuote[];
  news?: NewsItem[];
}

/** Seconds of scroll per item, so longer strips drift at a steady pace. */
const SECONDS_PER_ITEM = 5;

function marquee(reducedMotion: boolean, count: number): HTMLElement {
  const viewport = el("div", "cc-ticker__viewport");
  const track = el("div", "cc-ticker__track");
  if (!reducedMotion) {
    track.classList.add("cc-ticker__track--scroll");
    track.style.setProperty("--cc-ticker-duration", `${String(count * SECONDS_PER_ITEM)}s`);
  }
  viewport.appendChild(track);
  return viewport;
}

function formatPrice(price: number): string {
  return price >= 1000
    ? price.toLocaleString(undefined, { maximumFractionDigits: 0 })
    : price.toFixed(2);
}

function stockEntry(quote: StockQuote): HTMLElement {
  const entry = el("span", "cc-ticker__entry");
  entry.appendChild(el("span", "cc-ticker__symbol", quote.symbol));
  entry.appendChild(el("span", "cc-ticker__price", formatPrice(quote.price)));
  const up = quote.changePercent >= 0;
  const delta = el(
    "span",
    "cc-ticker__delta",
    `${up ? "+" : ""}${quote.changePercent.toFixed(2)}%`,
  );
  delta.dataset.dir = up ? "up" : "down";
  entry.appendChild(delta);
  return entry;
}

function renderStockStrip(quotes: StockQuote[], reducedMotion: boolean): HTMLElement {
  const strip = el("div", "cc-ticker cc-ticker--stocks");
  const viewport = marquee(reducedMotion, quotes.length);
  const track = viewport.querySelector(".cc-ticker__track");
  // Two passes of the content so the loop has no visible seam.
  for (let pass = 0; pass < 2; pass += 1) {
    for (const quote of quotes) track?.appendChild(stockEntry(quote));
  }
  strip.appendChild(viewport);
  return strip;
}

function newsEntry(item: NewsItem, navigate: (url: string) => void): HTMLElement {
  const navigable = isSafeUrl(item.url);
  const entry = el(navigable ? "button" : "span", "cc-ticker__entry cc-ticker__entry--news");
  entry.appendChild(el("span", "cc-ticker__source", item.source));
  entry.appendChild(el("span", "cc-ticker__headline", item.title));
  if (navigable) {
    entry.setAttribute("type", "button");
    entry.addEventListener("click", () => {
      navigate(item.url);
    });
  }
  return entry;
}

function renderNewsStrip(
  items: NewsItem[],
  reducedMotion: boolean,
  navigate: (url: string) => void,
): HTMLElement {
  const strip = el("div", "cc-ticker cc-ticker--news");
  const viewport = marquee(reducedMotion, items.length);
  const track = viewport.querySelector(".cc-ticker__track");
  for (let pass = 0; pass < 2; pass += 1) {
    for (const item of items) track?.appendChild(newsEntry(item, navigate));
  }
  strip.appendChild(viewport);
  return strip;
}

export function renderTickers(
  host: HTMLElement,
  options: TickerOptions,
  navigate: (url: string) => void,
): HTMLElement | undefined {
  const stocks = options.stocks ?? [];
  const news = options.news ?? [];
  if (stocks.length === 0 && news.length === 0) return undefined;

  const wrap = el("div", "cc-tickers");
  if (stocks.length > 0) wrap.appendChild(renderStockStrip(stocks, options.reducedMotion));
  if (news.length > 0) wrap.appendChild(renderNewsStrip(news, options.reducedMotion, navigate));
  host.appendChild(wrap);
  return wrap;
}

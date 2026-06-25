import type { StockQuote } from "../integrations/finnhub";
import type { NewsItem } from "../integrations/news";
import { el } from "../render/helpers";
import { isSafeUrl } from "../security/url";

/**
 * Ambient ticker strips for the orientation band: a quiet, slowly scrolling
 * marquee of stock quotes and one of news headlines. Deliberately low contrast,
 * so it never competes with the "needs you" lane. With reduced motion it holds
 * still and simply clips. When a strip is enabled but empty it shows a short
 * hint rather than vanishing, so it never looks broken; off strips render nothing.
 */
export interface TickerOptions {
  reducedMotion: boolean;
  stocks?: StockQuote[];
  news?: NewsItem[];
  /** Whether each strip is switched on, so an empty one can explain itself. */
  stocksEnabled?: boolean;
  newsEnabled?: boolean;
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

/** Map a news source to the domain whose favicon stands in for its name. */
const SOURCE_DOMAIN: Record<string, string> = {
  "Hacker News": "news.ycombinator.com",
};

function sourceFavicon(source: string): HTMLImageElement {
  const domain = SOURCE_DOMAIN[source] ?? "news.ycombinator.com";
  const icon = document.createElement("img");
  icon.className = "cc-ticker__favicon";
  // The Google favicon service is already allowed by the manifest's img-src.
  icon.src = `https://www.google.com/s2/favicons?sz=32&domain=${domain}`;
  icon.alt = source;
  icon.width = 14;
  icon.height = 14;
  icon.setAttribute("aria-hidden", "true");
  return icon;
}

function newsEntry(item: NewsItem, navigate: (url: string) => void): HTMLElement {
  const navigable = isSafeUrl(item.url);
  const entry = el(navigable ? "button" : "span", "cc-ticker__entry cc-ticker__entry--news");
  entry.appendChild(sourceFavicon(item.source));
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

/** A still, quiet line for an enabled-but-empty strip, so it does not look broken. */
function hintStrip(text: string): HTMLElement {
  const strip = el("div", "cc-ticker cc-ticker--hint");
  strip.appendChild(el("span", "cc-ticker__hint", text));
  return strip;
}

export function renderTickers(
  host: HTMLElement,
  options: TickerOptions,
  navigate: (url: string) => void,
): HTMLElement | undefined {
  const stocks = options.stocks ?? [];
  const news = options.news ?? [];
  const stockHint = (options.stocksEnabled ?? false) && stocks.length === 0;
  const newsHint = (options.newsEnabled ?? false) && news.length === 0;
  if (stocks.length === 0 && news.length === 0 && !stockHint && !newsHint) return undefined;

  const wrap = el("div", "cc-tickers");
  if (stocks.length > 0) wrap.appendChild(renderStockStrip(stocks, options.reducedMotion));
  else if (stockHint) wrap.appendChild(hintStrip("Add a Finnhub key in Customize to show stocks."));
  if (news.length > 0) wrap.appendChild(renderNewsStrip(news, options.reducedMotion, navigate));
  else if (newsHint) wrap.appendChild(hintStrip("News unavailable right now."));
  host.appendChild(wrap);
  return wrap;
}

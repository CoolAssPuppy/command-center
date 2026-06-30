import type { StockQuote } from "../integrations/finnhub";
import type { NewsItem } from "../integrations/news";
import { el } from "../render/helpers";
import { isSafeUrl } from "../security/url";
import { DEFAULT_TICKER_MODE, type TickerMode } from "./tickerModeState";

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
  /**
   * Stock (non-forex) symbols are configured but no Finnhub key is set, so the
   * equities were dropped. Surfaces a hint, since forex alone would otherwise
   * make the missing symbols a silent mystery.
   */
  stocksNeedKey?: boolean;
  /** Whether the stock/forex delta reads as a percent or an absolute amount. */
  mode?: TickerMode;
  /** Persist the new mode after the user clicks the strip to toggle it. */
  onTickerModeChange?: (mode: TickerMode) => void;
}

/** Seconds of scroll per item, so longer strips drift at a steady pace. */
const SECONDS_PER_ITEM = 5;

/**
 * Widen each copy of the strip to at least the viewport so a short list (even a
 * single quote) spreads across the whole band via space-around, instead of
 * clustering at the left. The two copies stay equal in width, so the track (sized
 * to its content) is exactly twice a copy and the -50% scroll loops seamlessly.
 *
 * The new tab can be laid out at zero width until it is actually shown, where a
 * lone ResizeObserver would fire once at width 0 and never again. requestAnimation-
 * Frame is paused while the page is hidden, so retrying on frames waits until the
 * band has a real width; a ResizeObserver then keeps it right on later resizes.
 */
function fitGroupsToViewport(viewport: HTMLElement, groups: HTMLElement[]): void {
  const apply = (): boolean => {
    const width = viewport.clientWidth;
    if (width === 0) return false;
    for (const group of groups) group.style.minWidth = `${String(width)}px`;
    return true;
  };

  const raf = (
    globalThis as { requestAnimationFrame?: (cb: FrameRequestCallback) => number }
  ).requestAnimationFrame;
  if (!apply() && raf !== undefined) {
    let frames = 0;
    const retry = (): void => {
      if (!viewport.isConnected || frames > 240) return;
      frames += 1;
      if (!apply()) raf(retry);
    };
    raf(retry);
  }

  if (typeof ResizeObserver !== "undefined") {
    const observer = new ResizeObserver(() => {
      if (!viewport.isConnected) {
        observer.disconnect();
        return;
      }
      apply();
    });
    observer.observe(viewport);
  }
}

/**
 * A scrolling viewport holding two identical content groups. Callers fill both
 * groups with the same entries; rendering the content twice lets the -50% loop
 * run without a visible seam, and each group is widened to the viewport so the
 * band is never empty on the right.
 */
function marquee(
  reducedMotion: boolean,
  count: number,
): { viewport: HTMLElement; groups: [HTMLElement, HTMLElement] } {
  const viewport = el("div", "cc-ticker__viewport");
  const track = el("div", "cc-ticker__track");
  if (!reducedMotion) {
    track.classList.add("cc-ticker__track--scroll");
    track.style.setProperty("--cc-ticker-duration", `${String(count * SECONDS_PER_ITEM)}s`);
  }
  const groups: [HTMLElement, HTMLElement] = [
    el("div", "cc-ticker__group"),
    el("div", "cc-ticker__group"),
  ];
  track.append(groups[0], groups[1]);
  viewport.appendChild(track);
  fitGroupsToViewport(viewport, groups);
  return { viewport, groups };
}

function formatPrice(quote: StockQuote): string {
  // FX rates need more precision; equities keep two decimals (no decimals over 1000).
  if (quote.isForex === true) return quote.price.toFixed(4);
  return quote.price >= 1000
    ? quote.price.toLocaleString(undefined, { maximumFractionDigits: 0 })
    : quote.price.toFixed(2);
}

/**
 * The delta text and direction for a quote in the chosen mode: a percentage, or
 * the absolute change (4 decimals for FX, 2 for equities). Returns undefined when
 * an amount is asked for but the absolute change is unknown.
 */
export function formatDelta(
  quote: StockQuote,
  mode: TickerMode,
): { text: string; dir: "up" | "down" } | undefined {
  if (mode === "amount") {
    if (quote.change === undefined) return undefined;
    const decimals = quote.isForex === true ? 4 : 2;
    const sign = quote.change >= 0 ? "+" : "";
    return { text: `${sign}${quote.change.toFixed(decimals)}`, dir: quote.change >= 0 ? "up" : "down" };
  }
  const sign = quote.changePercent >= 0 ? "+" : "";
  return {
    text: `${sign}${quote.changePercent.toFixed(2)}%`,
    dir: quote.changePercent >= 0 ? "up" : "down",
  };
}

function setDelta(span: HTMLElement, quote: StockQuote, mode: TickerMode): void {
  const delta = formatDelta(quote, mode);
  if (delta === undefined) {
    span.textContent = "";
    delete span.dataset.dir;
  } else {
    span.textContent = delta.text;
    span.dataset.dir = delta.dir;
  }
}

function stockEntry(quote: StockQuote, mode: TickerMode): { entry: HTMLElement; delta: HTMLElement } {
  const entry = el("span", "cc-ticker__entry");
  entry.appendChild(el("span", "cc-ticker__symbol", quote.symbol));
  entry.appendChild(el("span", "cc-ticker__price", formatPrice(quote)));
  const delta = el("span", "cc-ticker__delta");
  setDelta(delta, quote, mode);
  entry.appendChild(delta);
  return { entry, delta };
}

function renderStockStrip(
  quotes: StockQuote[],
  reducedMotion: boolean,
  mode: TickerMode,
  onTickerModeChange?: (mode: TickerMode) => void,
): HTMLElement {
  const strip = el("div", "cc-ticker cc-ticker--stocks");
  // The whole strip toggles percent vs amount. It holds no links, so making it a
  // button is safe (the news strip, which has per-headline links, is left alone).
  strip.setAttribute("role", "button");
  strip.setAttribute("tabindex", "0");
  strip.setAttribute("aria-label", "Toggle ticker between percent change and amount");
  strip.title = "Click to switch between percent and amount";

  const { viewport, groups } = marquee(reducedMotion, quotes.length);
  const deltas: Array<{ quote: StockQuote; span: HTMLElement }> = [];
  // Two identical passes of the content so the loop has no visible seam.
  for (const group of groups) {
    for (const quote of quotes) {
      const { entry, delta } = stockEntry(quote, mode);
      group.appendChild(entry);
      deltas.push({ quote, span: delta });
    }
  }
  strip.appendChild(viewport);

  // Toggle in place so the marquee keeps scrolling; persist via the callback.
  let current = mode;
  const toggle = (): void => {
    current = current === "percent" ? "amount" : "percent";
    for (const { quote, span } of deltas) setDelta(span, quote, current);
    onTickerModeChange?.(current);
  };
  strip.addEventListener("click", toggle);
  strip.addEventListener("keydown", (event) => {
    if (event.key === "Enter" || event.key === " ") {
      event.preventDefault();
      toggle();
    }
  });
  return strip;
}

/** Map a news source to the domain whose favicon stands in for its name. */
function sourceFavicon(host: string, source: string): HTMLImageElement {
  const icon = document.createElement("img");
  icon.className = "cc-ticker__favicon";
  // The Google favicon service is already allowed by the manifest's img-src.
  icon.src = `https://www.google.com/s2/favicons?sz=32&domain=${host}`;
  icon.alt = source;
  icon.width = 14;
  icon.height = 14;
  icon.setAttribute("aria-hidden", "true");
  return icon;
}

function newsEntry(item: NewsItem, navigate: (url: string) => void): HTMLElement {
  const navigable = isSafeUrl(item.url);
  const entry = el(navigable ? "button" : "span", "cc-ticker__entry cc-ticker__entry--news");
  // A favicon when the source's brand domain is known, else a short text label.
  if (item.iconHost !== undefined) entry.appendChild(sourceFavicon(item.iconHost, item.source));
  else entry.appendChild(el("span", "cc-ticker__source", item.source));
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
  const { viewport, groups } = marquee(reducedMotion, items.length);
  for (const group of groups) {
    for (const item of items) group.appendChild(newsEntry(item, navigate));
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
  if (stocks.length > 0) {
    wrap.appendChild(
      renderStockStrip(
        stocks,
        options.reducedMotion,
        options.mode ?? DEFAULT_TICKER_MODE,
        options.onTickerModeChange,
      ),
    );
    // Forex renders, but equities were dropped for lack of a key. Say so quietly,
    // so the missing symbols are explained rather than silently gone.
    if (options.stocksNeedKey === true) {
      wrap.appendChild(hintStrip("Add a Finnhub key in Customize to show stocks."));
    }
  } else if (stockHint) {
    wrap.appendChild(
      hintStrip(
        options.stocksNeedKey === true
          ? "Add a Finnhub key in Customize to show stocks."
          : "Stock quotes are unavailable right now.",
      ),
    );
  }
  if (news.length > 0) wrap.appendChild(renderNewsStrip(news, options.reducedMotion, navigate));
  else if (newsHint) wrap.appendChild(hintStrip("News unavailable right now."));
  host.appendChild(wrap);
  return wrap;
}

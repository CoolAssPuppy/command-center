import { afterEach, describe, expect, it, vi } from "vitest";

import { ConfigSchema, homeZone, type Config } from "../config/schema";
import type { GeoResult } from "../geo/geocode";
import { host } from "../test/dom";
import { openEditPane } from "./editPane";

afterEach(() => {
  document.body.replaceChildren();
});

const tick = (): Promise<void> => new Promise((resolve) => setTimeout(resolve, 0));

const twoZones = (): Config =>
  ConfigSchema.parse({
    zones: [
      { id: "ny", label: "New York", timeZone: "America/New_York", isHome: true },
      { id: "lis", label: "Lisbon", timeZone: "Europe/Lisbon" },
    ],
  });

const tokyoMatch: GeoResult = {
  id: "g1",
  label: "Tokyo, Japan",
  name: "Tokyo",
  country: "Japan",
  timeZone: "Asia/Tokyo",
  lat: 35.6,
  lon: 139.6,
};

interface Harness {
  root: HTMLElement;
  applied: () => Config | undefined;
}

function open(config: Config, search: GeoResult[] = []): Harness {
  let applied: Config | undefined;
  const root = host();
  openEditPane(root, {
    config,
    secrets: {},
    applyConfig: (next) => {
      applied = next;
    },
    applySecrets: vi.fn(),
    onClose: vi.fn(),
    runtime: { searchCities: () => Promise.resolve(search) },
  });
  return { root, applied: () => applied };
}

function rowFor(root: HTMLElement, label: string): HTMLElement {
  const row = [...root.querySelectorAll<HTMLElement>(".cc-edit__row")].find((node) =>
    node.textContent?.includes(label),
  );
  if (row === undefined) throw new Error(`no row for ${label}`);
  return row;
}

describe("edit pane — zones", () => {
  it("lists the configured zones", () => {
    const { root } = open(twoZones());
    expect(rowFor(root, "New York")).toBeTruthy();
    expect(rowFor(root, "Lisbon")).toBeTruthy();
  });

  it("changes the home zone and applies it live", () => {
    const harness = open(twoZones());
    const setHome = rowFor(harness.root, "Lisbon").querySelector<HTMLButtonElement>(
      ".cc-edit__chip",
    );
    setHome?.click();
    const applied = harness.applied();
    expect(applied && homeZone(applied)?.label).toBe("Lisbon");
  });

  it("removes a zone", () => {
    const harness = open(twoZones());
    const remove = rowFor(harness.root, "Lisbon").querySelector<HTMLButtonElement>(
      '[aria-label="Remove"]',
    );
    remove?.click();
    expect(harness.applied()?.zones.some((z) => z.label === "Lisbon")).toBe(false);
  });

  it("adds a zone from a city search", async () => {
    const harness = open(twoZones(), [tokyoMatch]);
    const input = harness.root.querySelector<HTMLInputElement>(".cc-edit__input");
    const form = harness.root.querySelector<HTMLFormElement>(".cc-edit__add-form");
    if (input === null || form === null) throw new Error("missing search form");
    input.value = "Tokyo";
    form.dispatchEvent(new Event("submit", { cancelable: true, bubbles: true }));
    await tick();

    const result = harness.root.querySelector<HTMLButtonElement>(".cc-edit__result");
    expect(result?.textContent).toBe("Tokyo, Japan");
    result?.click();
    expect(harness.applied()?.zones.some((z) => z.timeZone === "Asia/Tokyo")).toBe(true);
  });
});

describe("edit pane — dock", () => {
  it("adds a dock link, normalizing a bare host to https", () => {
    const harness = open(twoZones());
    const form = harness.root.querySelector<HTMLFormElement>(
      ".cc-edit__add-form--stack",
    );
    if (form === null) throw new Error("missing dock form");
    const inputs = form.querySelectorAll<HTMLInputElement>("input");
    const titleInput = inputs[0];
    const urlInput = inputs[1];
    if (titleInput === undefined || urlInput === undefined) {
      throw new Error("missing dock inputs");
    }
    titleInput.value = "GitHub";
    urlInput.value = "github.com";
    form.dispatchEvent(new Event("submit", { cancelable: true, bubbles: true }));

    expect(
      harness.applied()?.links.some((link) => link.url === "https://github.com"),
    ).toBe(true);
  });
});

describe("edit pane — shell", () => {
  it("closes and removes itself on Done", () => {
    const onClose = vi.fn();
    const root = host();
    openEditPane(root, {
      config: ConfigSchema.parse({}),
      secrets: {},
      applyConfig: vi.fn(),
      applySecrets: vi.fn(),
      onClose,
      runtime: { searchCities: () => Promise.resolve([]) },
    });
    root.querySelector<HTMLButtonElement>(".cc-edit__done")?.click();
    expect(onClose).toHaveBeenCalledOnce();
    expect(root.querySelector(".cc-edit")).toBeNull();
  });
});

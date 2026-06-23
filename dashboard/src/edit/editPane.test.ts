import { afterEach, describe, expect, it, vi } from "vitest";

import { ConfigSchema, homeZone, type Config, type Secrets } from "../config/schema";
import type { GeoResult } from "../geo/geocode";
import { host } from "../test/dom";
import { SHIPPED_THEMES } from "../theme/registry";
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
  appliedSecrets: () => Secrets | undefined;
}

function open(config: Config, search: GeoResult[] = []): Harness {
  let applied: Config | undefined;
  let appliedSecrets: Secrets | undefined;
  const root = host();
  openEditPane(root, {
    config,
    secrets: { connectionSecrets: {} },
    applyConfig: (next) => {
      applied = next;
    },
    applySecrets: (next) => {
      appliedSecrets = next;
    },
    onClose: vi.fn(),
    runtime: { searchCities: () => Promise.resolve(search) },
  });
  return { root, applied: () => applied, appliedSecrets: () => appliedSecrets };
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

const withLinks = (): Config =>
  ConfigSchema.parse({
    zones: [{ id: "ny", label: "New York", timeZone: "America/New_York", isHome: true }],
    links: [
      { id: "l1", title: "GitHub", url: "https://github.com" },
      { id: "l2", title: "Linear", url: "https://linear.app" },
    ],
  });

const linkRow = (root: HTMLElement, title: string): HTMLElement => {
  const input = [
    ...root.querySelectorAll<HTMLInputElement>('input[aria-label="Link title"]'),
  ].find((node) => node.value === title);
  const row = input?.closest<HTMLElement>(".cc-edit__row");
  if (row === null || row === undefined) throw new Error(`no link row for ${title}`);
  return row;
};

/** A DataTransfer stand-in: jsdom drag events carry no real one. */
const fakeTransfer = (): DataTransfer => {
  const store: Record<string, string> = {};
  return {
    setData: (type: string, value: string) => {
      store[type] = value;
    },
    getData: (type: string) => store[type] ?? "",
  } as unknown as DataTransfer;
};

const dragEvent = (type: string, transfer: DataTransfer): Event => {
  const event = new Event(type, { cancelable: true, bubbles: true });
  Object.defineProperty(event, "dataTransfer", { value: transfer });
  return event;
};

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

  it("edits a link's title in place", () => {
    const harness = open(withLinks());
    const title = linkRow(harness.root, "GitHub").querySelector<HTMLInputElement>(
      'input[aria-label="Link title"]',
    );
    if (title === null) throw new Error("no title input");
    title.value = "Source";
    title.dispatchEvent(new Event("change"));
    expect(harness.applied()?.links.find((l) => l.id === "l1")?.title).toBe("Source");
  });

  it("edits a link's url in place, normalizing a bare host", () => {
    const harness = open(withLinks());
    const url = linkRow(harness.root, "GitHub").querySelector<HTMLInputElement>(
      'input[aria-label="Link URL"]',
    );
    if (url === null) throw new Error("no url input");
    url.value = "example.com";
    url.dispatchEvent(new Event("change"));
    expect(harness.applied()?.links.find((l) => l.id === "l1")?.url).toBe(
      "https://example.com",
    );
  });

  it("reorders links with the move buttons (keyboard and touch path)", () => {
    const harness = open(withLinks());
    const down = linkRow(harness.root, "GitHub").querySelector<HTMLButtonElement>(
      '[aria-label="Move down"]',
    );
    down?.click();
    expect(harness.applied()?.links.map((l) => l.id)).toEqual(["l2", "l1"]);
  });

  it("reorders links by dropping one row onto another", () => {
    const harness = open(withLinks());
    const rows = [...harness.root.querySelectorAll<HTMLElement>(".cc-edit__row--drag")];
    const [first, second] = rows;
    if (first === undefined || second === undefined) throw new Error("missing rows");
    const transfer = fakeTransfer();
    first.dispatchEvent(dragEvent("dragstart", transfer));
    second.dispatchEvent(dragEvent("drop", transfer));
    expect(harness.applied()?.links.map((l) => l.id)).toEqual(["l2", "l1"]);
  });
});

const withConnection = (): Config =>
  ConfigSchema.parse({
    zones: [{ id: "ny", label: "New York", timeZone: "America/New_York", isHome: true }],
    connections: [{ id: "c1", name: "Roadmap", service: "notion", databaseId: "db1" }],
  });

const formWithOption = (root: HTMLElement, optionText: string): HTMLFormElement => {
  const form = [...root.querySelectorAll<HTMLFormElement>(".cc-edit__add-form")].find((node) =>
    [...node.querySelectorAll("option")].some((option) => option.textContent === optionText),
  );
  if (form === undefined) throw new Error(`no form with option ${optionText}`);
  return form;
};

describe("edit pane — connections & streams", () => {
  it("adds a connection for a service", () => {
    const harness = open(twoZones());
    const form = formWithOption(harness.root, "Google Calendar");
    const name = form.querySelector<HTMLInputElement>("input");
    if (name === null) throw new Error("no connection name input");
    name.value = "Work Calendar";
    form.dispatchEvent(new Event("submit", { cancelable: true, bubbles: true }));
    const connection = harness.applied()?.connections.find((c) => c.name === "Work Calendar");
    expect(connection?.service).toBe("google-calendar");
  });

  it("stores a connection's Notion token keyed by id", () => {
    const harness = open(withConnection());
    const token = harness.root.querySelector<HTMLInputElement>('input[aria-label="Notion token"]');
    if (token === null) throw new Error("no token field");
    token.value = "secret_notion";
    token.dispatchEvent(new Event("change"));
    expect(harness.appliedSecrets()?.connectionSecrets["c1"]).toBe("secret_notion");
  });

  it("adds a work stream pointing at a connection", () => {
    const harness = open(withConnection());
    const form = formWithOption(harness.root, "Roadmap");
    const title = form.querySelector<HTMLInputElement>("input");
    if (title === null) throw new Error("no stream title input");
    title.value = "Docs";
    form.dispatchEvent(new Event("submit", { cancelable: true, bubbles: true }));
    const stream = harness.applied()?.streams.find((s) => s.title === "Docs");
    expect(stream?.connectionId).toBe("c1");
  });
});

describe("edit pane — wallpaper", () => {
  const clickChip = (root: HTMLElement, label: string): void => {
    const chip = [...root.querySelectorAll<HTMLButtonElement>(".cc-edit__chips .cc-edit__chip")].find(
      (node) => node.textContent === label,
    );
    if (chip === undefined) throw new Error(`no chip ${label}`);
    chip.click();
  };

  it("selects the Unsplash source", () => {
    const harness = open(twoZones());
    clickChip(harness.root, "Unsplash");
    expect(harness.applied()?.wallpaper.source).toBe("unsplash");
  });

  it("stores the access key once Unsplash is the source", () => {
    const harness = open(twoZones());
    clickChip(harness.root, "Unsplash");
    const key = harness.root.querySelector<HTMLInputElement>(
      'input[aria-label="Unsplash access key"]',
    );
    if (key === null) throw new Error("no access key field");
    key.value = "unsplash-key";
    key.dispatchEvent(new Event("change"));
    expect(harness.appliedSecrets()?.unsplashAccessKey).toBe("unsplash-key");
  });

  it("stores a custom image URL", () => {
    const harness = open(twoZones());
    clickChip(harness.root, "Custom");
    const url = harness.root.querySelector<HTMLInputElement>(
      'input[aria-label="Custom image URL"]',
    );
    if (url === null) throw new Error("no custom URL field");
    url.value = "https://images.example.com/p.jpg";
    url.dispatchEvent(new Event("change"));
    expect(harness.applied()?.wallpaper.customUrl).toBe("https://images.example.com/p.jpg");
  });
});

describe("edit pane — appearance", () => {
  it("sets the greeting name", () => {
    const harness = open(twoZones());
    const name = harness.root.querySelector<HTMLInputElement>(
      'input[aria-label="Your name"]',
    );
    if (name === null) throw new Error("no name field");
    name.value = "Prashant";
    name.dispatchEvent(new Event("change"));
    expect(harness.applied()?.profile.name).toBe("Prashant");
  });

  it("changes the theme", () => {
    const harness = open(twoZones());
    const target = SHIPPED_THEMES[1];
    if (target === undefined) throw new Error("expected a second theme");
    const chip = [
      ...harness.root.querySelectorAll<HTMLButtonElement>(".cc-edit__chips .cc-edit__chip"),
    ].find((node) => node.textContent === target.meta.name);
    chip?.click();
    expect(harness.applied()?.appearance.theme).toBe(target.meta.themeId);
  });

  it("toggles the 24-hour clock", () => {
    const harness = open(twoZones());
    const label = [
      ...harness.root.querySelectorAll<HTMLElement>("label.cc-edit__check"),
    ].find((node) => node.textContent?.includes("24-hour"));
    const clock = label?.querySelector<HTMLInputElement>('input[type="checkbox"]');
    if (clock === null || clock === undefined) throw new Error("no clock toggle");
    clock.checked = true;
    clock.dispatchEvent(new Event("change"));
    expect(harness.applied()?.appearance.hour12).toBe(false);
  });
});

describe("edit pane — collapsible sections", () => {
  const sectionFor = (root: HTMLElement, title: string): HTMLDetailsElement => {
    const found = [
      ...root.querySelectorAll<HTMLDetailsElement>("details.cc-edit__section"),
    ].find((node) => node.querySelector(".cc-edit__section-title")?.textContent === title);
    if (found === undefined) throw new Error(`no section ${title}`);
    return found;
  };

  it("renders each section as a details, open by default", () => {
    const { root } = open(twoZones());
    const sections = root.querySelectorAll<HTMLDetailsElement>("details.cc-edit__section");
    expect(sections.length).toBeGreaterThanOrEqual(6);
    expect([...sections].every((node) => node.open)).toBe(true);
  });

  it("remembers a collapsed section across the pane's re-renders", () => {
    const harness = open(twoZones());
    const zones = sectionFor(harness.root, "Timezones");
    zones.open = false;
    zones.dispatchEvent(new Event("toggle"));

    // Any edit re-renders the whole body; the section must stay collapsed.
    const name = harness.root.querySelector<HTMLInputElement>('input[aria-label="Your name"]');
    if (name === null) throw new Error("no name field");
    name.value = "Prashant";
    name.dispatchEvent(new Event("change"));

    expect(sectionFor(harness.root, "Timezones").open).toBe(false);
    expect(sectionFor(harness.root, "Appearance").open).toBe(true);
  });
});

describe("edit pane — shell", () => {
  it("closes and removes itself on Done", () => {
    const onClose = vi.fn();
    const root = host();
    openEditPane(root, {
      config: ConfigSchema.parse({}),
      secrets: { connectionSecrets: {} },
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

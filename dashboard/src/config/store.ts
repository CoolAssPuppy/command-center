import { defaultConfig } from "./defaults";
import {
  parseConfig,
  parseSecrets,
  type Config,
  type Secrets,
} from "./schema";

/**
 * Persistence for the config. The dashboard depends only on the ConfigStore
 * interface, never on a concrete storage backend, so the same app runs against
 * chrome.storage in the extension, localStorage in plain-browser dev, and an
 * in-memory map in tests. Non-secret config syncs; secrets are kept in a
 * separate local area and never leave the device.
 */
export interface ConfigStore {
  load(): Promise<Config>;
  save(config: Config): Promise<void>;
  loadSecrets(): Promise<Secrets>;
  saveSecrets(secrets: Secrets): Promise<void>;
}

/** A minimal async key/value area. chrome.storage and localStorage adapt to it. */
export interface KeyValueArea {
  get(key: string): Promise<unknown>;
  set(key: string, value: unknown): Promise<void>;
}

const CONFIG_KEY = "config";
const SECRETS_KEY = "secrets";

export interface CreateConfigStoreOptions {
  /** Produces the config used when nothing has been saved yet. */
  fallback?: () => Config;
}

export function createConfigStore(
  configArea: KeyValueArea,
  secretArea: KeyValueArea,
  options: CreateConfigStoreOptions = {},
): ConfigStore {
  const fallback = options.fallback ?? ((): Config => defaultConfig());
  return {
    async load(): Promise<Config> {
      const raw = await configArea.get(CONFIG_KEY);
      if (raw === undefined || raw === null) return fallback();
      return parseConfig(raw);
    },
    async save(config: Config): Promise<void> {
      await configArea.set(CONFIG_KEY, config);
    },
    async loadSecrets(): Promise<Secrets> {
      const raw = await secretArea.get(SECRETS_KEY);
      return parseSecrets(raw);
    },
    async saveSecrets(secrets: Secrets): Promise<void> {
      await secretArea.set(SECRETS_KEY, secrets);
    },
  };
}

/** An in-memory area, used by tests and as a last-resort fallback. */
export function memoryArea(initial: Record<string, unknown> = {}): KeyValueArea {
  const map = new Map<string, unknown>(Object.entries(initial));
  return {
    get(key: string): Promise<unknown> {
      return Promise.resolve(map.get(key));
    },
    set(key: string, value: unknown): Promise<void> {
      // Round-trip through JSON so stored values are plain, like real storage.
      map.set(key, JSON.parse(JSON.stringify(value)) as unknown);
      return Promise.resolve();
    },
  };
}

/** Adapt a Web Storage object (localStorage) to a KeyValueArea. */
export function localStorageArea(storage: Storage): KeyValueArea {
  return {
    get(key: string): Promise<unknown> {
      const raw = storage.getItem(key);
      if (raw === null) return Promise.resolve(undefined);
      try {
        return Promise.resolve(JSON.parse(raw) as unknown);
      } catch {
        return Promise.resolve(undefined);
      }
    },
    set(key: string, value: unknown): Promise<void> {
      storage.setItem(key, JSON.stringify(value));
      return Promise.resolve();
    },
  };
}

interface ChromeStorageArea {
  get(keys: string[]): Promise<Record<string, unknown>>;
  set(items: Record<string, unknown>): Promise<void>;
}

interface ChromeLike {
  storage: { sync: ChromeStorageArea; local: ChromeStorageArea };
}

function isChromeStorageArea(value: unknown): value is ChromeStorageArea {
  if (typeof value !== "object" || value === null) return false;
  const area = value as { get?: unknown; set?: unknown };
  return typeof area.get === "function" && typeof area.set === "function";
}

function isChromeLike(value: unknown): value is ChromeLike {
  if (typeof value !== "object" || value === null) return false;
  const storage = (value as { storage?: unknown }).storage;
  if (typeof storage !== "object" || storage === null) return false;
  const areas = storage as { sync?: unknown; local?: unknown };
  return isChromeStorageArea(areas.sync) && isChromeStorageArea(areas.local);
}

/** Adapt a chrome.storage area to a KeyValueArea. */
export function chromeStorageAreaAdapter(area: ChromeStorageArea): KeyValueArea {
  return {
    async get(key: string): Promise<unknown> {
      const result = await area.get([key]);
      return result[key];
    },
    async set(key: string, value: unknown): Promise<void> {
      await area.set({ [key]: value });
    },
  };
}

function detectChrome(): ChromeLike | undefined {
  const candidate = (globalThis as { chrome?: unknown }).chrome;
  return isChromeLike(candidate) ? candidate : undefined;
}

/**
 * Pick the right store for the current environment: chrome.storage inside the
 * extension, localStorage in plain-browser dev, in-memory otherwise.
 */
export function createEnvironmentStore(): ConfigStore {
  const chrome = detectChrome();
  if (chrome !== undefined) {
    return createConfigStore(
      chromeStorageAreaAdapter(chrome.storage.sync),
      chromeStorageAreaAdapter(chrome.storage.local),
    );
  }
  const local = (globalThis as { localStorage?: Storage }).localStorage;
  if (local !== undefined) {
    return createConfigStore(localStorageArea(local), localStorageArea(local));
  }
  return createConfigStore(memoryArea(), memoryArea());
}

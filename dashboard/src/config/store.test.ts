import { describe, expect, it } from "vitest";

import { defaultConfig } from "./defaults";
import { createConfigStore, memoryArea } from "./store";
import { type Config } from "./schema";

const sampleConfig = (): Config =>
  defaultConfig({ timeZone: "America/New_York" });

describe("ConfigStore", () => {
  it("returns the fallback default when nothing is saved", async () => {
    const store = createConfigStore(memoryArea(), memoryArea(), {
      fallback: () => sampleConfig(),
    });
    const loaded = await store.load();
    expect(loaded.zones.some((z) => z.isHome)).toBe(true);
  });

  it("round-trips a saved config", async () => {
    const store = createConfigStore(memoryArea(), memoryArea());
    const config = sampleConfig();
    config.profile.name = "Prashant";
    await store.save(config);

    const loaded = await store.load();
    expect(loaded.profile.name).toBe("Prashant");
    expect(loaded.zones).toEqual(config.zones);
  });

  it("repairs a corrupted stored config on load", async () => {
    const configArea = memoryArea();
    await configArea.set("config", { zones: "broken" });
    const store = createConfigStore(configArea, memoryArea());

    const loaded = await store.load();
    expect(loaded.zones).toEqual([]);
  });

  it("keeps secrets out of the synced config area", async () => {
    const configArea = memoryArea();
    const secretArea = memoryArea();
    const store = createConfigStore(configArea, secretArea);

    await store.saveSecrets({ connectionSecrets: { c1: "secret-token" } });

    expect(await configArea.get("secrets")).toBeUndefined();
    expect(await configArea.get("config")).toBeUndefined();
    expect(await secretArea.get("secrets")).toEqual({
      connectionSecrets: { c1: "secret-token" },
    });
  });

  it("round-trips secrets", async () => {
    const store = createConfigStore(memoryArea(), memoryArea());
    await store.saveSecrets({ unsplashAccessKey: "abc", connectionSecrets: {} });
    expect(await store.loadSecrets()).toEqual({
      unsplashAccessKey: "abc",
      connectionSecrets: {},
    });
  });
});

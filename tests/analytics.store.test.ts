import { describe, it, expect, beforeEach, afterEach } from "bun:test";
import fs from "fs/promises";
import { AnalyticsStore, ReviewMetadataSchema } from "../analytics";

const ANALYTICS_DIR = ".code-review-analytics";
const ANALYTICS_FILE = `${ANALYTICS_DIR}/reviews.json`;

describe("AnalyticsStore", () => {
  beforeEach(async () => {
    await fs.rm(ANALYTICS_DIR, { recursive: true, force: true });
  });

  afterEach(async () => {
    await fs.rm(ANALYTICS_DIR, { recursive: true, force: true });
  });

  it("creates analytics file on first use", async () => {
    const store = new AnalyticsStore();
    const all = await store.readAll();
    expect(Array.isArray(all)).toBe(true);

    const exists = await Bun.file(ANALYTICS_FILE).exists();
    expect(exists).toBe(true);
  });

  it("appends and reads records", async () => {
    const store = new AnalyticsStore();

    // Provide required tokensUsed to satisfy schema on read
    const record = {
      id: `test_${Date.now()}`,
      timestamp: new Date().toISOString(),
      tokensUsed: { input: 0, output: 0, total: 0 },
    } as any;

    await store.append(record);
    const all = await store.readAll();

    expect(all.length).toBe(1);
    expect(all[0].id).toBe(record.id);
    expect(all[0].timestamp).toBe(record.timestamp);
    expect(all[0].tokensUsed.total).toBeDefined();
    expect(all[0].issues).toBeDefined();
  });
});
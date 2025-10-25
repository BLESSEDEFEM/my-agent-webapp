import { describe, it, expect, beforeEach, afterEach } from "bun:test";
import fs from "fs/promises";
import { AnalyticsService } from "../analytics";

const ANALYTICS_DIR = ".code-review-analytics";

describe("AnalyticsService", () => {
  beforeEach(async () => {
    await fs.rm(ANALYTICS_DIR, { recursive: true, force: true });
  });

  afterEach(async () => {
    await fs.rm(ANALYTICS_DIR, { recursive: true, force: true });
  });

  it("adds web review and computes metrics", async () => {
    const svc = new AnalyticsService();

    await svc.addReview({
      fileName: "fileA.ts",
      issues: { critical: 1, warnings: 2, suggestions: 3 },
      tokens: { input: 100, output: 200 },
      duration: 1500,
      cost: 0.0005,
    });

    await svc.addReview({
      fileName: "fileB.ts",
      issues: { critical: 0, warnings: 1, suggestions: 0 },
      tokens: { input: 50, output: 50 },
      duration: 1000,
      cost: 0.0002,
    });

    const metrics = await svc.getMetrics(30);

    expect(metrics.summary.totalReviews).toBeGreaterThanOrEqual(2);
    expect(metrics.summary.totalIssues).toBeGreaterThan(0);
    expect(metrics.breakdown.bySeverity["critical"]).toBeGreaterThanOrEqual(1);
    expect(metrics.summary.totalTokens).toBeGreaterThan(0);
    expect(metrics.trends.length).toBeGreaterThan(0);
  });

  it("returns history list with limit", async () => {
    const svc = new AnalyticsService();

    for (let i = 0; i < 3; i++) {
      await svc.addReview({
        fileName: `file_${i}.ts`,
        issues: { critical: 0, warnings: 0, suggestions: 1 },
        tokens: { input: 10, output: 10 },
        duration: 500,
        cost: 0.0001,
      });
    }

    const history = await svc.getHistory(2);
    expect(history.length).toBe(2);
    expect(history[0].timestamp >= history[1].timestamp).toBe(true);
  });
});
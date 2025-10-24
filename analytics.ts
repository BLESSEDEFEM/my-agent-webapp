import { z } from "zod";
import fs from "fs/promises";
import path from "path";

// ===== TYPES =====
export const IssueSchema = z.object({
  type: z.enum(["security", "performance", "style", "bug", "maintainability", "documentation"]).default("maintainability"),
  severity: z.enum(["critical", "high", "medium", "low", "info"]).default("info"),
  message: z.string(),
  file: z.string().optional(),
  line: z.number().optional(),
});
export type Issue = z.infer<typeof IssueSchema>;

export const ReviewMetadataSchema = z.object({
  id: z.string(),
  timestamp: z.string(),
  repository: z.string().default("unknown"),
  branch: z.string().default("unknown"),
  commitHash: z.string().default("unknown"),
  filesChanged: z.number().default(0),
  linesChanged: z.number().default(0),
  tokensUsed: z.object({ input: z.number().default(0), output: z.number().default(0), total: z.number().default(0) }),
  reviewDurationMs: z.number().default(0),
  issues: z.array(IssueSchema).default([]),
  modelName: z.string().default("models/gemini-2.5-flash"),
});
export type ReviewMetadata = z.infer<typeof ReviewMetadataSchema>;

// ===== STORE =====
const ANALYTICS_DIR = ".code-review-analytics";
const ANALYTICS_FILE = path.join(ANALYTICS_DIR, "reviews.json");

export class AnalyticsStore {
  private async ensureFile(): Promise<void> {
    try {
      await fs.mkdir(ANALYTICS_DIR, { recursive: true });
      const file = Bun.file(ANALYTICS_FILE);
      if (!(await file.exists())) {
        await Bun.write(ANALYTICS_FILE, "[]");
      }
    } catch (err) {
      console.error("AnalyticsStore.ensureFile error", err);
    }
  }

  async readAll(): Promise<ReviewMetadata[]> {
    try {
      await this.ensureFile();
      const file = Bun.file(ANALYTICS_FILE);
      const text = await file.text();
      const json = JSON.parse(text || "[]");
      return z.array(ReviewMetadataSchema).parse(json);
    } catch (err) {
      console.error("AnalyticsStore.readAll error", err);
      return [];
    }
  }

  async append(record: ReviewMetadata): Promise<void> {
    try {
      await this.ensureFile();
      const items = await this.readAll();
      items.push(record);
      await Bun.write(ANALYTICS_FILE, JSON.stringify(items, null, 2));
    } catch (err) {
      console.error("AnalyticsStore.append error", err);
    }
  }
}

// ===== SERVICE =====
export class AnalyticsService {
  constructor(private store = new AnalyticsStore()) {}

  async getMetrics(daysBack: number = 30) {
    const items = await this.store.readAll();
    // Merge any history-only records not yet in the store (backfill)
    const history = await this.readHistory().catch(() => [] as WebHistoryItem[]);
    const existingIds = new Set(items.map(i => i.id));
    for (const h of history) {
      if (!existingIds.has(h.id)) {
        const issuesArr: Issue[] = [];
        for (let i = 0; i < (h.issues?.critical || 0); i++) issuesArr.push({ type: "maintainability", severity: "critical", message: "critical" });
        for (let i = 0; i < (h.issues?.warnings || 0); i++) issuesArr.push({ type: "maintainability", severity: "medium", message: "warning" });
        for (let i = 0; i < (h.issues?.suggestions || 0); i++) issuesArr.push({ type: "maintainability", severity: "low", message: "suggestion" });
        items.push({
          id: h.id,
          timestamp: h.timestamp,
          repository: "web-app",
          branch: "web",
          commitHash: "web",
          filesChanged: 1,
          linesChanged: 0,
          tokensUsed: {
            input: h.tokens?.input || 0,
            output: h.tokens?.output || 0,
            total: (h.tokens?.input || 0) + (h.tokens?.output || 0),
          },
          reviewDurationMs: h.duration || 0,
          issues: issuesArr,
          modelName: "models/gemini-2.5-flash",
        });
      }
    }

    // Compute time window: daysBack <= 0 -> start of today
    const startOfToday = new Date();
    startOfToday.setHours(0, 0, 0, 0);
    const since = daysBack <= 0
      ? startOfToday.getTime()
      : Date.now() - daysBack * 24 * 60 * 60 * 1000;

    const filtered = items.filter((i) => new Date(i.timestamp).getTime() >= since);
    const totalReviews = filtered.length;

    const totalIssues = filtered.reduce((acc, r) => acc + r.issues.length, 0);
    const criticalIssues = filtered.filter((r) => r.issues.some((x) => x.severity === "critical")).length;

    const totalTokens = filtered.reduce((acc, r) => acc + (r.tokensUsed?.total || 0), 0);
    const avgReviewTimeSeconds = totalReviews
      ? Math.round(
          (filtered.reduce((acc, r) => acc + (r.reviewDurationMs || 0), 0) / totalReviews / 1000) * 100
        ) / 100
      : 0;

    // Assume manual review 30 min
    const timeSavedHours = Math.round(((totalReviews * 30 * 60 * 1000 - filtered.reduce((a, r) => a + r.reviewDurationMs, 0)) / 3600000) * 100) / 100;

    // Issue breakdown by type and severity
    const byType: Record<string, number> = {};
    const bySeverity: Record<string, number> = {};
    for (const r of filtered) {
      for (const issue of r.issues) {
        byType[issue.type] = (byType[issue.type] || 0) + 1;
        bySeverity[issue.severity] = (bySeverity[issue.severity] || 0) + 1;
      }
    }

    // Trends per day
    const byDay: Record<string, { reviews: number; issues: number }> = {};
    for (const r of filtered) {
      const day = new Date(r.timestamp).toISOString().slice(0, 10);
      if (!byDay[day]) byDay[day] = { reviews: 0, issues: 0 };
      byDay[day].reviews += 1;
      byDay[day].issues += r.issues.length;
    }
    const trendDays = Object.keys(byDay).sort();
    const trends = trendDays.map((d) => ({ day: d, reviews: byDay[d].reviews, issues: byDay[d].issues }));

    // Cost analysis aligned to stored per-run cost values
    const historyFiltered = history.filter(h => new Date(h.timestamp).getTime() >= since);
    const totalCost = Math.round(historyFiltered.reduce((acc, r) => acc + (r.cost || 0), 0) * 1_000_000) / 1_000_000;
    const reviewsForCost = historyFiltered.length;
    const avgCostPerReview = reviewsForCost ? Math.round((totalCost / reviewsForCost) * 1_000_000) / 1_000_000 : 0;

    return {
      summary: {
        totalReviews,
        totalIssues,
        criticalIssues,
        timeSavedHours,
        avgReviewTimeSeconds,
        totalTokens,
        totalCost,
        avgCostPerReview,
      },
      breakdown: { byType, bySeverity },
      trends,
    } as const;
  }

  // Web app history support
  private historyPath = path.join(ANALYTICS_DIR, "history.json");

  private async ensureHistoryFile(): Promise<void> {
    try {
      await fs.mkdir(ANALYTICS_DIR, { recursive: true });
      const f = Bun.file(this.historyPath);
      if (!(await f.exists())) {
        await Bun.write(this.historyPath, "[]");
      }
    } catch (err) {
      console.error("AnalyticsService.ensureHistoryFile error", err);
    }
  }

  private async readHistory(): Promise<WebHistoryItem[]> {
    try {
      await this.ensureHistoryFile();
      const txt = await Bun.file(this.historyPath).text();
      const json = JSON.parse(txt || "[]");
      return Array.isArray(json) ? json as WebHistoryItem[] : [];
    } catch (err) {
      console.error("AnalyticsService.readHistory error", err);
      return [];
    }
  }

  async addReview(item: Omit<WebHistoryItem, "id" | "timestamp"> & Partial<Pick<WebHistoryItem, "id" | "timestamp">>): Promise<void> {
    try {
      await this.ensureHistoryFile();
      const list = await this.readHistory();
      const record: WebHistoryItem = {
        id: item.id || `web_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
        timestamp: item.timestamp || new Date().toISOString(),
        fileName: item.fileName,
        issues: item.issues,
        tokens: item.tokens,
        duration: item.duration,
        cost: item.cost,
      };
      list.push(record);
      await Bun.write(this.historyPath, JSON.stringify(list, null, 2));

      // Also append a normalized ReviewMetadata record so /api/analytics reflects web reviews
      const issuesArr: Issue[] = [];
      for (let i = 0; i < (record.issues?.critical || 0); i++) {
        issuesArr.push({ type: "maintainability", severity: "critical", message: "critical" });
      }
      for (let i = 0; i < (record.issues?.warnings || 0); i++) {
        issuesArr.push({ type: "maintainability", severity: "medium", message: "warning" });
      }
      for (let i = 0; i < (record.issues?.suggestions || 0); i++) {
        issuesArr.push({ type: "maintainability", severity: "low", message: "suggestion" });
      }

      await this.store.append({
        id: record.id,
        timestamp: record.timestamp,
        repository: "web-app",
        branch: "web",
        commitHash: "web",
        filesChanged: 1,
        linesChanged: 0,
        tokensUsed: {
          input: record.tokens?.input || 0,
          output: record.tokens?.output || 0,
          total: (record.tokens?.input || 0) + (record.tokens?.output || 0),
        },
        reviewDurationMs: record.duration || 0,
        issues: issuesArr,
        modelName: "models/gemini-2.5-flash",
      });
    } catch (err) {
      console.error("AnalyticsService.addReview error", err);
    }
  }

  async getHistory(limit: number = 50): Promise<WebHistoryItem[]> {
    const list = await this.readHistory();
    return list
      .sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime())
      .slice(0, Math.max(0, limit));
  }
}

// Types for web history items
export type WebHistoryItem = {
  id: string;
  timestamp: string;
  fileName: string;
  issues: { critical: number; warnings: number; suggestions: number };
  tokens: { input: number; output: number };
  duration: number; // ms
  cost: number; // USD
};
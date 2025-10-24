import { AnalyticsStore, ReviewMetadataSchema, IssueSchema } from "./analytics";

const store = new AnalyticsStore();

async function generateDemoData() {
  const now = Date.now();
  const days = 30;
  const count = Math.floor(Math.random() * 15) + 30; // 30-45
  const files = [
    "api/routes.ts",
    "components/Button.tsx",
    "utils/helpers.ts",
    "services/auth.ts",
    "pages/Dashboard.tsx",
    "hooks/useData.ts",
    "lib/validation.ts",
    "types/index.ts",
  ];

  for (let i = 0; i < count; i++) {
    const ts = new Date(now - Math.random() * days * 24 * 3600 * 1000).toISOString();
    const input = Math.floor(Math.random() * 2500) + 800;
    const output = Math.floor(Math.random() * 1200) + 300;
    const duration = Math.floor(Math.random() * 12000) + 2500;
    const total = input + output;

    const file = files[Math.floor(Math.random() * files.length)];

    const issueCount = Math.floor(Math.random() * 6) + 2;
    const allIssues = Array.from({ length: issueCount }).map(() => {
      const types = ["security", "performance", "style", "bug", "maintainability", "documentation"] as const;
      const severities = ["critical", "high", "medium", "low", "info"] as const;
      return IssueSchema.parse({
        type: types[Math.floor(Math.random() * types.length)],
        severity: severities[Math.floor(Math.random() * severities.length)],
        message: `Demo issue ${Math.random().toString(36).slice(2)}`,
        file,
        line: Math.floor(Math.random() * 400) + 1,
      });
    });

    const record = ReviewMetadataSchema.parse({
      id: `demo_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
      timestamp: ts,
      repository: process.cwd(),
      branch: "main",
      commitHash: Math.random().toString(36).slice(2, 10),
      filesChanged: Math.floor(Math.random() * 5) + 1,
      linesChanged: Math.floor(Math.random() * 250) + 30,
      tokensUsed: { input, output, total },
      reviewDurationMs: duration,
      issues: allIssues,
      modelName: "models/gemini-2.5-flash",
    });

    await store.append(record);
  }

  console.log(`Generated ${count} demo reviews across ${days} days.`);
}

await generateDemoData();
import { stepCountIs, streamText } from "ai";
import { google } from "@ai-sdk/google";
import { SYSTEM_PROMPT } from "./prompts";
import { 
  getFileChangesInDirectoryTool,
  generateCommitMessageTool,
  writeReviewToMarkdownTool
} from "./tools";
import fs from "fs/promises";
import { simpleGit } from "simple-git";
import { AnalyticsStore, ReviewMetadataSchema, IssueSchema, type Issue } from "./analytics";

function parseIssuesFromMarkdown(md: string): Issue[] {
  const lines = md.split(/\r?\n/);
  const issues: Issue[] = [];
  const typeKeywords = {
    security: /\bsecurity\b/i,
    performance: /\bperformance\b|\bperf\b/i,
    style: /\bstyle\b|\breadability\b/i,
    bug: /\bbug\b|\berror\b|\bexception\b/i,
    maintainability: /\bmaintainability\b|\brefactor\b/i,
    documentation: /\bdocumentation\b|\bdocs\b/i,
  } as const;
  const severityKeywords = {
    critical: /\bcritical\b|\bblocker\b/i,
    high: /\bhigh\b|\bmajor\b/i,
    medium: /\bmedium\b|\bmoderate\b/i,
    low: /\blow\b|\bminor\b/i,
    info: /\binfo\b|\bnote\b|\bsuggestion\b/i,
  } as const;

  for (const raw of lines) {
    const line = raw.trim();
    if (!line) continue;
    if (!/^[-*]/.test(line)) continue; // focus bullets

    let type: Issue["type"] | undefined;
    let severity: Issue["severity"] | undefined;
    for (const k of Object.keys(typeKeywords) as (keyof typeof typeKeywords)[]) {
      if (typeKeywords[k].test(line)) { type = k; break; }
    }
    for (const k of Object.keys(severityKeywords) as (keyof typeof severityKeywords)[]) {
      if (severityKeywords[k].test(line)) { severity = k; break; }
    }

    const fileMatch = line.match(/\(([^)]+):(\d+)\)/) || line.match(/file\s*:\s*([^\s)]+)/i);
    const file = fileMatch?.[1];
    const lineNo = fileMatch?.[2] ? Number(fileMatch[2]) : undefined;

    const message = line.replace(/^[-*]\s*/, "");
    issues.push(IssueSchema.parse({ type: type || "maintainability", severity: severity || "info", message, file, line: lineNo }));
  }
  return issues;
}

const codeReviewAgent = async (prompt: string) => {
  const start = performance.now();
  const result = streamText({
    model: google("models/gemini-2.5-flash"),
    prompt,
    system: SYSTEM_PROMPT,
    tools: {
      getFileChangesInDirectoryTool,
      generateCommitMessageTool,
      writeReviewToMarkdownTool,
    },
    stopWhen: stepCountIs(10),
  });

  for await (const chunk of result.textStream) {
    process.stdout.write(chunk);
  }

  // ===== Analytics capture (non-blocking) =====
  try {
    const end = performance.now();
    const response = await result.response;
    const usage: any = (response as any)?.usage || {};
    const inputTokens = usage.inputTokens ?? usage.promptTokens ?? 0;
    const outputTokens = usage.outputTokens ?? usage.completionTokens ?? 0;
    const totalTokens = (inputTokens || 0) + (outputTokens || Math.ceil((await fs.readFile("code_review.md", "utf-8").catch(()=>""))).length / 4);

    const git = simpleGit();
    const status = await git.status();
    const branch = status.current || "unknown";
    const repo = process.cwd();
    const commitHash = (await git.revparse(["HEAD"]).catch(()=>"unknown")) || "unknown";
    const diffSummary = await git.diffSummary().catch(()=>({ files: [], insertions: 0, deletions: 0 } as any));
    const filesChanged = Array.isArray(diffSummary.files) ? diffSummary.files.length : 0;
    const linesChanged = (diffSummary.insertions || 0) + (diffSummary.deletions || 0);

    const reviewMd = await fs.readFile("code_review.md", "utf-8").catch(()=>"");
    const issues = parseIssuesFromMarkdown(reviewMd);

    const record = ReviewMetadataSchema.parse({
      id: `rev_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
      timestamp: new Date().toISOString(),
      repository: repo,
      branch,
      commitHash,
      filesChanged,
      linesChanged,
      tokensUsed: { input: inputTokens || 0, output: outputTokens || 0, total: totalTokens || 0 },
      reviewDurationMs: Math.round(end - start),
      issues,
      modelName: "models/gemini-2.5-flash",
    });

    const store = new AnalyticsStore();
    await store.append(record);
  } catch (err) {
    // Non-blocking: log and continue
    console.error("Analytics capture failed", err);
  }
};

// Example run
await codeReviewAgent(
  "Review the code changes in '../my-agent' directory, suggest commit messages, and save the review into a markdown file"
);
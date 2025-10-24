import { tool } from "ai";
import { simpleGit } from "simple-git";
import { z } from "zod";
import fs from "fs/promises";

const excludeFiles = ["dist", "bun.lock"];

const fileChange = z.object({
  rootDir: z.string().min(1).describe("The root directory"),
});

type FileChange = z.infer<typeof fileChange>;

// 🔹 Tool 1: Get file changes
async function getFileChangesInDirectory({ rootDir }: FileChange) {
  const git = simpleGit(rootDir);
  const summary = await git.diffSummary();
  const diffs: { file: string; diff: string }[] = [];

  for (const file of summary.files) {
    if (excludeFiles.includes(file.file)) continue;
    const diff = await git.diff(["--", file.file]);
    diffs.push({ file: file.file, diff });
  }

  return diffs;
}

export const getFileChangesInDirectoryTool = tool({
  description: "Gets the code changes made in given directory",
  inputSchema: fileChange,
  execute: getFileChangesInDirectory,
});

// 🔹 Tool 2: Generate commit message
export const generateCommitMessageTool = tool({
  description: "Generates a commit message based on code changes",
  inputSchema: fileChange,
  async execute({ rootDir }: FileChange) {
    const git = simpleGit(rootDir);
    const summary = await git.diffSummary();

    if (summary.files.length === 0) {
      return "No changes detected.";
    }

    // Simple commit message listing changed files
    const changedFiles = summary.files.map(f => f.file).join(", ");
    return `Update ${changedFiles}`;
  },
});

// 🔹 Tool 3: Write review to markdown
const reviewFileSchema = z.object({
  reviewContent: z.string().min(1, "Review content cannot be empty"),
  filePath: z.string().default("code-review.md"),
});

type ReviewFile = z.infer<typeof reviewFileSchema>;

async function writeReviewToMarkdown({ reviewContent, filePath }: ReviewFile) {
  await fs.writeFile(filePath, reviewContent, "utf-8");
  return `Review written to ${filePath}`;
}

export const writeReviewToMarkdownTool = tool({
  description: "Writes the AI's code review into a markdown file",
  inputSchema: reviewFileSchema,
  execute: writeReviewToMarkdown,
});
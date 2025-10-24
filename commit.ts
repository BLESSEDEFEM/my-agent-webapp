import { simpleGit } from "simple-git";
import { google } from "@ai-sdk/google";
import { generateText } from "ai";
import * as readline from "readline";

const COMMIT_MESSAGE_PROMPT = `You are an expert at writing conventional commit messages following the standard format.

Analyze the provided git diff and generate a commit message that:
1. Follows conventional commits format: type(scope): description
2. Uses one of these types: feat, fix, refactor, docs, style, test, chore, perf, ci, build, revert
3. Includes a concise description (max 72 characters for first line)
4. For complex changes, adds a body with bullet points explaining key changes
5. Focuses on WHAT changed and WHY, not HOW
6. Uses imperative mood ("add" not "added" or "adds")

Examples:
- feat(auth): add OAuth2 login support
- fix(api): resolve null pointer in user handler
- refactor(database): migrate from MySQL to PostgreSQL
- docs(readme): update installation instructions

For the given diff, provide ONLY the commit message without any additional explanation or markdown formatting.`;

async function getStagedChanges(): Promise<string> {
  const git = simpleGit();
  const diff = await git.diff(["--cached"]);
  return diff;
}

async function generateCommitMessage(diff: string): Promise<string> {
  const result = await generateText({
    model: google("models/gemini-2.5-flash"),
    prompt: `${COMMIT_MESSAGE_PROMPT}\n\nHere is the git diff:\n\n${diff}`,
  });
  
  return result.text.trim();
}

function askUser(question: string): Promise<string> {
  const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout,
  });

  return new Promise((resolve) => {
    rl.question(question, (answer) => {
      rl.close();
      resolve(answer.trim());
    });
  });
}

async function copyToClipboard(text: string): Promise<boolean> {
  try {
    // Try to use Windows clipboard via PowerShell
    const { execSync } = await import("child_process");
    execSync(`powershell.exe -Command "Set-Clipboard -Value '${text.replace(/'/g, "''")}'"`
    );
    return true;
  } catch {
    return false;
  }
}

async function main() {
  console.log("🔍 Checking for staged changes...\n");

  const diff = await getStagedChanges();

  if (!diff || diff.trim().length === 0) {
    console.log("❌ No staged changes found. Stage your changes with 'git add' first.");
    process.exit(1);
  }

  // Check diff size (limit to ~10k characters to avoid token limits)
  if (diff.length > 10000) {
    console.log("⚠️  Warning: Diff is very large. This may take longer or be truncated.");
  }

  console.log("🤖 Generating commit message with Gemini AI...\n");

  const commitMessage = await generateCommitMessage(diff);

  console.log("\n📝 Generated Commit Message:\n");
  console.log("─────────────────────────────────────────");
  console.log(commitMessage);
  console.log("─────────────────────────────────────────\n");

  const answer = await askUser(
    "What would you like to do?\n  [c] Commit with this message\n  [e] Edit message\n  [p] Copy to clipboard\n  [q] Cancel\nYour choice: "
  );

  switch (answer.toLowerCase()) {
    case "c":
      const git = simpleGit();
      await git.commit(commitMessage);
      console.log("\n✅ Changes committed successfully!");
      break;

    case "e":
      console.log("\n✏️  Please edit the message manually and commit with:");
      console.log(`git commit -m "${commitMessage.replace(/"/g, '\\"')}"`
      );
      break;

    case "p":
      const copied = await copyToClipboard(commitMessage);
      if (copied) {
        console.log("\n📋 Commit message copied to clipboard!");
      } else {
        console.log("\n⚠️  Could not copy to clipboard. Here's the message again:");
        console.log(commitMessage);
      }
      break;

    case "q":
    default:
      console.log("\n❌ Cancelled.");
      break;
  }
}

main().catch((error) => {
  console.error("\n❌ Error:", error.message);
  process.exit(1);
});
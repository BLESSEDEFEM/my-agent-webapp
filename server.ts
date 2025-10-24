import { serve } from "bun";
import { streamText, stepCountIs } from "ai";
import { google } from "@ai-sdk/google";
import { SYSTEM_PROMPT } from "./prompts";
import { AnalyticsService } from "./analytics";

const analytics = new AnalyticsService();
let currentAbort: AbortController | null = null;

function jsonResponse(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}

function errorResponse(message: string, status = 500) {
  return jsonResponse({ error: message }, status);
}

async function runReview(fileName: string, content: string, abortSignal?: AbortSignal) {
  const start = performance.now();

  const prompt = `Review the following file: ${fileName}. Provide clear, constructive feedback.\n\n---\n${content}\n\n---\nFirst output a single line JSON summary with keys critical, warnings, suggestions (counts only). Then provide the detailed review.`;

  const result = streamText({
    model: google("models/gemini-2.5-flash"),
    prompt,
    system: SYSTEM_PROMPT,
    tools: {},
    stopWhen: stepCountIs(10),
    abortSignal,
  });

  let reviewText = "";
  for await (const chunk of result.textStream) {
    if (abortSignal?.aborted) break;
    reviewText += chunk;
  }

  const end = performance.now();
  const durationMs = Math.round(end - start);

  const response = await result.response;
  const usage = (response as any)?.usage || {};
  const inputTokens = usage.inputTokens ?? usage.promptTokens ?? 0;
  const outputTokens = usage.outputTokens ?? usage.completionTokens ?? 0;

  // Estimate tokens if not provided
  const estimatedOutputTokens = Math.ceil(reviewText.length / 4);
  const outTokens = outputTokens || estimatedOutputTokens;

  // Cost estimation (approx Gemini pricing)
  const cost = (inputTokens / 1_000_000) * 0.075 + (outTokens / 1_000_000) * 0.3;

  // Parse summary line or fenced JSON block
  let summary = { critical: 0, warnings: 0, suggestions: 0 };
  try {
    const lines = reviewText.split(/\r?\n/);
    const firstNonEmpty = lines.find((l) => l.trim().length > 0)?.trim() || "";
    let parsedObj: any | null = null;

    if (firstNonEmpty.startsWith("{")) {
      parsedObj = JSON.parse(firstNonEmpty);
    } else {
      // Look for a JSON object anywhere near the top (handles ```json fenced blocks)
      const match = reviewText.match(/\{\s*\"critical\"\s*:\s*\d+[^]*?\}/);
      if (match && match[0]) {
        parsedObj = JSON.parse(match[0]);
        // remove the matched JSON block and any surrounding code fences if present
        reviewText = reviewText.replace(match[0], "");
        reviewText = reviewText.replace(/^```(?:json)?\s*\n/, "");
        reviewText = reviewText.replace(/\n```\s*/, "");
        reviewText = reviewText.trimStart();
      }
    }

    if (
      parsedObj &&
      typeof parsedObj.critical === "number" &&
      typeof parsedObj.warnings === "number" &&
      typeof parsedObj.suggestions === "number"
    ) {
      summary = parsedObj;
      // If we parsed from first line, strip it for cleaner display
      if (firstNonEmpty.startsWith("{")) {
        reviewText = reviewText.substring(firstNonEmpty.length).trimStart();
      }
    } else {
      throw new Error("Summary JSON not found");
    }
  } catch (_) {
    // Fallback: heuristic counts by keyword
    const lower = reviewText.toLowerCase();
    const count = (s: string) => (lower.match(new RegExp(s, "g")) || []).length;
    summary = {
      critical: count("critical"),
      warnings: count("warning"),
      suggestions: count("suggestion"),
    };
  }

  return {
    reviewText,
    summary,
    tokens: { input: inputTokens, output: outTokens },
    duration: durationMs,
    cost: Number(cost.toFixed(6)),
  };
}

const PORT = Number(process.env.PORT || 3000);

export default {
  port: PORT,
  async fetch(req: Request) {
    try {
      const url = new URL(req.url);

      // Static web app page (includes upload + analytics)
      if (url.pathname === "/" && req.method === "GET") {
        const file = Bun.file("web/index.html");
        if (!(await file.exists())) return errorResponse("UI not found", 404);
        return new Response(file, { headers: { "Content-Type": "text/html" } });
      }

      // POST /api/review
      if (url.pathname === "/api/review" && req.method === "POST") {
        const contentType = req.headers.get("content-type") || "";
        if (!contentType.includes("application/json")) {
          return errorResponse("Expected application/json body", 415);
        }
        const body = await req.json();
        const fileName = String(body.fileName || "uploaded-file");
        const content = String(body.content || "");
        if (!content || content.length === 0) {
          return errorResponse("Empty file content", 400);
        }

        // Start new abort controller for this review
        if (currentAbort) currentAbort.abort();
        currentAbort = new AbortController();

        const review = await runReview(fileName, content, currentAbort.signal);
        currentAbort = null;

        await analytics.addReview({
          fileName,
          issues: review.summary,
          tokens: review.tokens,
          duration: review.duration,
          cost: review.cost,
        });

        return jsonResponse({
          ok: true,
          review: review.reviewText,
          summary: review.summary,
          metrics: {
            tokens: review.tokens,
            duration: review.duration,
            cost: review.cost,
          },
        });
      }

      // POST /api/review/cancel
      if (url.pathname === "/api/review/cancel" && req.method === "POST") {
        if (currentAbort) {
          currentAbort.abort();
          currentAbort = null;
        }
        return jsonResponse({ ok: true });
      }

      // GET /api/analytics
      if (url.pathname === "/api/analytics" && req.method === "GET") {
        const daysBack = Number(url.searchParams.get("days") || 30);
        const metrics = await analytics.getMetrics(daysBack);
        return jsonResponse(metrics);
      }

      // GET /api/history
      if (url.pathname === "/api/history" && req.method === "GET") {
        const limit = Number(url.searchParams.get("limit") || "50");
        const history = await analytics.getHistory(limit);
        return jsonResponse(history);
      }

      return errorResponse("Not Found", 404);
    } catch (error) {
      console.error(error);
      return errorResponse("Unexpected server error", 500);
    }
  },
};
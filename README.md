# AI Code Review Agent with Analytics Dashboard

An intelligent code review assistant powered by Google Gemini, featuring real-time analytics tracking and a modern dark-themed dashboard.

**Built with:** Bun + TypeScript + AI SDK

## Features

### 🤖 AI-Powered Code Review
- Automated code analysis using Google Gemini 2.5 Flash
- Security, performance, style, and maintainability checks
- Actionable feedback with severity classification (critical, high, medium, low, info)

### 📊 Analytics Dashboard
- Real-time metrics: total reviews, issues found, tokens used, estimated costs
- Interactive charts: issue breakdown by type/severity, daily trends
- Time-range selector: Today, Last 3/7/14/30/60/90 days
- Cost tracking aligned with per-review actual usage

### 🛠️ Developer Experience
- CLI integration: `bun run review` for instant code reviews
- **AI Commit Message Generator**: `bun run commit` for conventional commit messages
- Web interface with drag-and-drop file upload
- Stop review mid-run with graceful cancellation
- Non-blocking analytics (never interrupts workflow)

### 🏗️ Technical Highlights
- Zod-typed `ReviewMetadata` with structured issue tracking
- Bun-backed `AnalyticsStore` for persistent data
- RESTful API: `GET /api/analytics?days=30`, `POST /api/review`, `POST /api/review/cancel`

## Usage

### Code Review
- Run a review (CLI):
  - `bun run index.ts` or `bun run review`

### Commit Message Generator
- Generate AI-powered commit messages:
  ```bash
  # Stage your changes first
  git add .
  
  # Generate commit message
  bun run commit
  ```
- Features:
  - Analyzes staged Git changes
  - Generates conventional commit messages (feat, fix, refactor, etc.)
  - Interactive options: commit directly, edit, copy to clipboard, or cancel
  - Follows conventional commits format with type, scope, and description
  - Adds bullet points for complex multi-file changes

### Analytics Dashboard
- Start dashboard:
  - `bun run server.ts` or `bun run dashboard`
  - Open `http://localhost:3001/` (if `PORT=3001`)

### Demo Data
- Generate demo data:
  - `bun run generate-demo-data.ts`

## Screenshots
- Dashboard cards and charts show totals, breakdowns, and activity trends.

## Setup
1. Install dependencies:
   ```bash
   bun install
   ```

2. Configure Google Gemini API:
   - Copy `.env.example` to `.env`
   - Get your API key from [Google AI Studio](https://aistudio.google.com/app/apikey)
   - Set `GOOGLE_GENERATIVE_AI_API_KEY` in `.env`

3. No extra dependencies required beyond existing `package.json`.

## Notes
- Analytics writes are non-blocking; failures do not interrupt the review.
- Cost estimates use a blended Gemini rate (~$0.00025 per 1K tokens).

This project was created using `bun init` in bun v1.2.22. [Bun](https://bun.com) is a fast all-in-one JavaScript runtime.

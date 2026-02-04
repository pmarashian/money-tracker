# Combined Recommendations Report

**Source:** Analysis of log-analysis markdown files (task insights) and `tasks/progress.txt` (Codebase Patterns and task learnings).  
**Scope:** Project-agnostic recommendations applicable to any agent-driven development workflow.  
**Categories:** New Agent Skills, Updates to Existing Skills, Agent Prompt Updates.

---

## 1. New Agent Skills

### 1.1 Backend Server Verification

| Attribute | Detail |
|-----------|--------|
| **Description** | A skill that encodes the canonical flow for starting and verifying a backend dev server: check if the target port is in use, start the server from the correct directory (or with an absolute path), then confirm readiness via a short-timeout health request before running any API tests. |
| **Rationale** | Logs repeatedly show 60–90+ seconds lost to curl timeouts and port-conflict diagnosis because the agent did not verify that the server actually started. Timeouts were often misattributed to Redis, OpenAI, or “server stuck” when the real cause was “port already in use” or wrong working directory. |
| **Priority** | **High** |
| **Implementation guidance** | Document: (1) Before starting: run `lsof -i :PORT` (or equivalent) and, if in use, kill the process or document using an alternate port. (2) Start command: always use an explicit directory (e.g. `cd /absolute/path/to/backend && npm run dev`) so CWD is unambiguous across tool invocations. (3) After start: wait briefly, then `curl -f http://localhost:PORT/api/health --max-time 5`; if it fails, read the terminal output for “port in use” or bind errors before retrying long curls. Optionally include a two-step pattern: “start server in one invocation; in a subsequent invocation run curl with timeout.” |

---

### 1.2 Monorepo / Backend Layout

| Attribute | Detail |
|-----------|--------|
| **Description** | A skill that states: for repositories with a `backend/` (or similar) directory, treat that directory as the app root; create all API routes and library code under `backend/src/app/...` and `backend/src/lib/...` (or the project’s actual layout). Never create `src/` at the repository root for backend routes. |
| **Rationale** | Multiple tasks showed routes or libs created in the repo root `src/` instead of under `backend/src/`, leading to 404s, repeated server restarts, and long debugging cycles. A single explicit layout rule prevents wrong-path creation. |
| **Priority** | **High** |
| **Implementation guidance** | One short checklist: “Before creating any API or lib file: (1) Identify the backend app root (e.g. `backend/`). (2) Create files only under that root (e.g. `backend/src/app/api/...`, `backend/src/lib/...`).” Optionally reference “pre-write layout check” in progress or task instructions. |

---

### 1.3 Next.js API File Upload (App Router)

| Attribute | Detail |
|-----------|--------|
| **Description** | A skill that specifies: for Next.js App Router, use the request’s `formData()` and stream/parse the file (e.g. CSV) in the route handler. Do not use Express-style middleware (e.g. multer) in API routes; it can block the request pipeline and cause hangs. |
| **Rationale** | At least one task used multer in a Next.js API route, causing a long login hang and a full rewrite to Next.js built-in multipart handling. A single “tech stack” rule avoids this class of error. |
| **Priority** | **High** |
| **Implementation guidance** | One to two sentences: “This project uses Next.js App Router. Do not use Express middleware (e.g. multer) in API routes. Use `request.formData()` and parse the file in the route handler.” Can be merged into a broader “Next.js API” skill if one exists. |

---

### 1.4 Safe / Incremental File Edits

| Attribute | Detail |
|-----------|--------|
| **Description** | A skill that instructs the agent to prefer small, targeted search-and-replace edits with unique context and minimal span. Avoid replacing entire files or large sections unless intentionally doing a full rewrite. If an edit could match multiple locations, narrow the context so the match is unique. |
| **Rationale** | Multiple tasks reported “file corruption” or “accidentally replaced the whole file” when a single broad edit overwrote the entire file. Recovery required full file recreation and added time and risk. |
| **Priority** | **High** |
| **Implementation guidance** | Add to an existing file-edit or batching skill, or create a short “safe-edits” skill: “Prefer small search_replace with at least 3–5 lines of unique context before and after. Avoid whole-file or multi-hundred-line replacements unless you are intentionally rewriting the file. After two failed or ambiguous edits, consider a smaller span or a different anchor.” |

---

### 1.5 Progress File Append and Fallback

| Attribute | Detail |
|-----------|--------|
| **Description** | A skill that defines a single, robust pattern for appending a new task block to a progress file (e.g. `tasks/progress.txt`): read the last 10–20 lines to get exact trailing content and structure; use a unique anchor (e.g. task ID and date) for search_replace; if two replace attempts fail, switch to shell append (e.g. `echo '...' >> path/to/progress.txt`) instead of further edits. |
| **Rationale** | Many tasks showed 2–6+ failed progress file edits due to ambiguous delimiters (e.g. `---`) or non-unique anchors. Some agents fell back to shell append only after many retries, wasting 25–35+ seconds. |
| **Priority** | **Medium** |
| **Implementation guidance** | In the progress-tracking (or equivalent) skill, add a “Progress file update” section: “When appending: (1) Read the last 10–20 lines. (2) Use a unique line (e.g. `## YYYY-MM-DD - Task TASK_ID`) in your replace. (3) If two replace attempts fail, append via shell: `echo '...' >> tasks/progress.txt`.” Optionally add a one-line “do not replace on generic separators like `---` alone.” |

---

### 1.6 Cross-Platform “Run with Timeout”

| Attribute | Detail |
|-----------|--------|
| **Description** | A small skill or doc that explains how to run a command with a time limit in a cross-platform way. Do not rely on `timeout` (GNU coreutils) when agents may run on macOS, where it is not default. |
| **Rationale** | Several tasks used `timeout 10s npm run dev`, which failed on macOS and forced a fallback (e.g. `npm run dev &` then `sleep N` then `kill`). Documenting one cross-platform pattern reduces wasted attempts. |
| **Priority** | **Medium** |
| **Implementation guidance** | Options: “On macOS, use `(cmd &); sleep N; kill $!` or a small Node script that spawns and kills after N seconds. Do not use `timeout` unless the environment is known to provide it.” Keep the skill short (a few lines). |

---

### 1.7 CORS and Cookie-Based Auth (Cross-Origin)

| Attribute | Detail |
|-----------|--------|
| **Description** | A skill that states: for cookie-based auth from a different origin (e.g. frontend on port 3001, backend on 3000), the backend must send `Access-Control-Allow-Credentials: true` and a specific `Access-Control-Allow-Origin` (not `*`). If framework middleware (e.g. Next.js middleware) does not apply to API routes or headers do not appear, add CORS headers in the API route handler as a fallback. |
| **Rationale** | At least one task spent many steps editing middleware before discovering that middleware was not affecting API responses; moving CORS and credentials into the route handler fixed the issue. A short rule plus fallback reduces iteration time. |
| **Priority** | **Medium** |
| **Implementation guidance** | Add to a “backend auth” or “cross-origin” note: “Cookie-based auth from another origin requires credentials: true and a specific origin. If middleware CORS does not show in responses, set headers in the route handler.” Optionally add: “Verify with `curl -v -H 'Origin: ...'` that Access-Control-* headers are present.” |

---

### 1.8 Web Task Verification Gate (Browser Mandate)

| Attribute | Detail |
|-----------|--------|
| **Description** | A skill that enforces a pre-completion checklist for frontend/web tasks: (1) Load agent-browser (and screenshot-handling if capturing screenshots). (2) Run the app and perform at least one user flow that matches the task (e.g. open the relevant screen, submit a form, see the expected UI). (3) Do not output the completion marker until this verification is done or explicitly documented as impossible (e.g. backend down, with fallback). |
| **Rationale** | Several frontend tasks were marked complete with 0/N success criteria and no browser verification—only curl or code inspection. This contradicts “verify in browser” and “never mark complete without demonstrating working functionality,” and increases the risk of broken or incomplete UX. |
| **Priority** | **High** |
| **Implementation guidance** | In task-verification-workflow or a dedicated “web-task-verification-gate” skill: “For frontend-ui / web tasks: before `<ralph>COMPLETE</ralph>`, you must have used agent-browser (or equivalent) to perform at least one flow that matches the task. If backend/auth is unavailable, document the limitation and use a documented fallback (e.g. mock data + revert, or structure-only verification); do not substitute API-only verification for UI verification when the task is a UI task.” |

---

### 1.9 Configurable API Base URL (Frontend)

| Attribute | Detail |
|-----------|--------|
| **Description** | A skill that encodes the pattern for a configurable API base URL in a frontend app (e.g. Vite): use a single env variable (e.g. `VITE_API_URL`), a shared API client module that reads it, and update all call sites to use that client. Do not hardcode the host/port in multiple files; do not create or commit `.env`—only `.env.example` and documentation for copying locally. |
| **Rationale** | One task resolved a port conflict by changing nine frontend files to a new port, creating maintenance and consistency risk. Another task introduced a single API client and env variable, which is the desired pattern. Capturing this as a skill prevents regression and encourages a single source of truth. |
| **Priority** | **Medium** |
| **Implementation guidance** | Steps: (1) Add `VITE_API_URL` (or equivalent) to `.env.example`. (2) Create a shared client (e.g. `api.ts`) that uses `import.meta.env.VITE_API_URL`. (3) Replace direct fetch/axios calls with the client. (4) Do not create or modify `.env` in the repo; document “copy .env.example to .env” for local use. |

---

### 1.10 Auth-for-Browser-Tests (Session / Cookie Injection)

| Attribute | Detail |
|-----------|--------|
| **Description** | A skill that documents how to establish an authenticated session for browser-based E2E: e.g. register/login via API (curl with cookie jar), then either (1) load the cookie file or state into the browser context if the tool supports it, or (2) document that browser tests require manual login or a test-only auth bypass, and rely on API verification + manual check. Include a fallback when cookie/state injection is not supported. |
| **Rationale** | Multiple frontend tasks could not verify protected pages because login in the browser failed (network, CORS, or cookie handling). Agents either gave up on UI verification or used temporary auth bypass and mocks. A single “auth for browser tests” flow reduces ad-hoc bypasses and clarifies fallbacks. |
| **Priority** | **Medium** |
| **Implementation guidance** | Steps: (1) Create or reuse a test user via API (register/login with curl, save cookies). (2) Check the browser tool’s docs for loading cookies/state. (3) If supported: load state, then open the protected URL. (4) If not supported: document “browser tests require manual login or test-only route” and use API verification; optionally add a test-only “login as test user” that sets a cookie. (5) When using mocks for verification due to backend down, revert all mock/bypass changes and document in progress. |

---

### 1.11 Backend API Verification (Authenticated Requests)

| Attribute | Detail |
|-----------|--------|
| **Description** | A skill that requires: for backend tasks that add or change API routes, do not mark the task complete based only on “server started” or an unauthenticated 401. Either (a) run an authenticated request (e.g. curl with session cookie or test token) to the new/changed endpoint and document the result, or (b) add or run an automated test that hits the route with auth. |
| **Rationale** | At least one task marked a settings API complete after only seeing 401 on health, without ever calling the new settings endpoint with auth. That leaves bugs in the new route or in how health uses settings undetected. |
| **Priority** | **High** |
| **Implementation guidance** | Add to backend verification or task-verification-workflow: “For new or changed API routes: run at least one authenticated request (e.g. register → login → GET/PATCH to the new route) and confirm status and expected shape. If no auth harness exists, document in progress how to verify manually.” |

---

### 1.12 Create-Next-App in Existing Directory

| Attribute | Detail |
|-----------|--------|
| **Description** | A skill that documents: when running create-next-app in an existing directory (e.g. `backend/`), (a) remove or rename an existing `package.json` in that directory if the tool refuses to overwrite; (b) prefer an absolute path for the target directory to avoid `cd`/sandbox issues; (c) for API-only setups, strip UI (layout, page, globals, public) and clear `.next` before re-running type-check. |
| **Rationale** | One task lost ~20–25 s to create-next-app retries (existing package.json, then path issues). A short checklist prevents repeated failures. |
| **Priority** | **Low** |
| **Implementation guidance** | Three bullets in a “scaffold” or “Next.js” skill; optionally link to “monorepo layout” so the agent knows the backend directory is the app root. |

---

## 2. Updates to Existing Skills

### 2.1 Completion-Marker-Optimization

| Attribute | Detail |
|-----------|--------|
| **Description** | Enforce a single completion marker: output `<ralph>COMPLETE</ralph>` exactly once, as a single atomic string. Place it early in the final response (e.g. right after the verification summary) so truncation does not drop it. Add an explicit “do not repeat the marker” rule and, if possible, an example of invalid output (e.g. `<ralph>COMPLETE</ralph><ralph>COMPLETE</ralph>`). |
| **Rationale** | Every analyzed task showed a duplicate completion marker in the final message. The skill already specifies “SINGLE ATOMIC STRING,” but the model still duplicated it. Early placement also guards against truncation (one task lost completion due to a truncated response). |
| **Priority** | **High** |
| **Implementation guidance** | (1) Add: “Output `<ralph>COMPLETE</ralph>` exactly once. Do not repeat it. Duplicate output is invalid.” (2) Add: “Place the marker early in your final response (e.g. immediately after the verification summary) so that if the response is truncated, completion is still detected.” (3) Add a “common mistake” line: “Do not output the marker twice.” (4) Orchestrator: treat the first occurrence as completion; optionally log a warning when more than one marker appears. |

---

### 2.2 Pre-Flight-Checklist / Pre-Implementation-Check

| Attribute | Detail |
|-----------|--------|
| **Description** | Extend with: (1) For backend tasks: before the first API test, check that the target port is free (e.g. `lsof -i :PORT`) or that a single dev server is listening; if the task involves auth, expect first register/login to be slow (e.g. bcrypt) and use request timeouts (e.g. 10–15 s). (2) For monorepos: confirm backend app root and that library/route paths use the correct prefix (e.g. `backend/src/lib/` not `backend/lib/`). (3) Where is the API base URL defined? How are backend and frontend started (commands and directories)? |
| **Rationale** | Port conflicts and wrong-path creation recur because pre-flight did not include “port free?” and “where is the app root?”. Slow auth and missing timeouts caused long blocks and mistaken server restarts. |
| **Priority** | **High** |
| **Implementation guidance** | Add a short “Backend / server” subsection: port check, start command with explicit path, optional health check with timeout. Add “Path convention” where applicable: “Backend library code lives under `backend/src/lib/`, not `backend/lib/`.” Add “Auth tasks: use curl --max-time 10 (or similar) for register/login checks.” |

---

### 2.3 Task-Verification-Workflow

| Attribute | Detail |
|-----------|--------|
| **Description** | Add: (1) Before outputting the completion marker, compare the current repo state to the orchestrator’s stated success criteria (e.g. the “Next” line or checklist). Ensure each criterion is satisfied by the actual paths and content produced, or explicitly document why not. (2) For backend API tasks: require authenticated verification of new/changed endpoints (see 1.11). (3) For frontend/web tasks: require at least one browser flow that matches the task (see 1.8). (4) If authenticated E2E is impossible (backend/auth down): verify UI with mock data if appropriate, document the limitation in progress, and ensure real API is used in code with no mocks left in. |
| **Rationale** | Success criteria were reported as 0/N at completion in almost every task, and many tasks were completed without browser or authenticated API verification. Aligning verification with criteria and making verification type explicit (browser vs API, auth vs unauthenticated) improves trust and reporting. |
| **Priority** | **High** |
| **Implementation guidance** | Add a “Criteria alignment” step: “Before completing, verify each success criterion; if the orchestrator shows 0/N, do not complete until criteria are met or you have documented and waived with reason.” Add “Verification by task type” (backend: auth request; frontend: browser flow or documented fallback). |

---

### 2.4 Progress-Tracking

| Attribute | Detail |
|-----------|--------|
| **Description** | Include the progress file append and fallback pattern (see 1.5): read last 10–20 lines, use a unique anchor for replace, and after two failures use shell append. Optionally add: “Reuse recent grep results when the query is unchanged” to avoid redundant searches. |
| **Rationale** | Repeated progress file edit failures and duplicate greps appear across tasks. A single documented pattern reduces retries and latency. |
| **Priority** | **Medium** |
| **Implementation guidance** | Add a “Progress file update” subsection with the read → unique anchor → replace → fallback to shell append flow. Keep it short (5–7 lines). |

---

### 2.5 Typescript-Incremental-Check

| Attribute | Detail |
|-----------|--------|
| **Description** | Add: (1) Run `npx tsc --noEmit` from the correct package directory (e.g. `cd backend && npx tsc --noEmit` or use `--project backend/tsconfig.json` from repo root). Do not assume shell CWD from a previous command. (2) Do not run tsc until a TypeScript/Next.js project exists (e.g. after create-next-app); use presence of `tsconfig.json` or `next.config` to decide. (3) After a successful tsc in the same turn, do not run it again unless source files were changed in between. |
| **Rationale** | Tasks showed tsc run from the wrong directory (e.g. root or frontend when backend was intended), redundant second tsc runs, and one run before any tsconfig existed. |
| **Priority** | **Medium** |
| **Implementation guidance** | Three bullets: correct cwd or --project; do not run before project exists; do not repeat in same turn without new edits. Optionally: “Assume each shell command runs from project root unless you use an explicit path or compound command.” |

---

### 2.6 Environment-Files (or Equivalent)

| Attribute | Detail |
|-----------|--------|
| **Description** | Add: (1) In some environments, `.env` may not be persisted. For backend tasks, prefer defensive defaults in code (e.g. `process.env.REDIS_URL || 'redis://localhost:6379'`) and document in `.env.example`. (2) Do not create or modify `.env` in the repo; only create or update `.env.example` and document that users copy it to `.env` locally. |
| **Rationale** | One task saw `.env` “disappear” and worked around it with in-code defaults; another created `frontend/.env` during the run, which can risk committing secrets. Clear rules avoid both. |
| **Priority** | **Medium** |
| **Implementation guidance** | Two short bullets; optionally add “Never commit .env” and “Use env-based bcrypt cost (e.g. BCRYPT_ROUNDS) for dev vs prod so tests can be fast without editing source.” |

---

### 2.7 Agent-Browser / Screenshot-Handling

| Attribute | Detail |
|-----------|--------|
| **Description** | For web tasks: (1) Require that at least one browser action (open, navigate, submit, or capture) is performed before the task can be marked complete, unless explicitly documented as impossible (e.g. backend down, with fallback). (2) When saving screenshots, use project root or absolute path for the screenshot directory so CWD does not cause wrong locations. (3) For scaffold-only tasks, at least open the app URL and capture one screenshot to confirm the shell renders. |
| **Rationale** | Several tasks loaded agent-browser but never used it and completed anyway; others had screenshot path issues due to CWD. Making “at least one browser step” and “save to known path” explicit improves consistency. |
| **Priority** | **Medium** |
| **Implementation guidance** | Add a “Pre-completion” note: “For web tasks, do not skip browser verification; if you load agent-browser, you must use it for at least one flow matching the task.” Add “Screenshot path: use absolute path or ensure CWD is project root when saving to `screenshots/`.” |

---

### 2.8 Skill Discovery (Limiting Search Breadth)

| Attribute | Detail |
|-----------|--------|
| **Description** | After one or two unfruitful skill searches (e.g. “backend auth logout”, “backend authentication”), proceed with generic skills (e.g. progress-tracking, pre-implementation-check) instead of additional broad queries like `search_skills("backend")`. Encode in instructions or a short “skill discovery” note. |
| **Rationale** | At least one task ran four skill searches in sequence before loading the same generic skills; the extra MCP calls add latency without benefit when no domain-specific skill exists. |
| **Priority** | **Low** |
| **Implementation guidance** | One line in the mandatory workflow or skill-discovery section: “If two skill searches return no relevant match, load the standard set for the task type (e.g. progress-tracking, pre-implementation-check) and proceed.” |

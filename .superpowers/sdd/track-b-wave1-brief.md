# Track B Wave1 Brief — Tasks 6–7 (F-E docs)

Work from: `C:/Users/30381/Desktop/VitalSpan/.worktrees/grad-docs-e2e`
Branch: `feat/grad-docs-e2e`
Base commit: `f5b890b`
Plan: `docs/superpowers/plans/2026-07-09-graduation-dash-ux.md` Tasks 6–7
Report to: `C:/Users/30381/Desktop/VitalSpan/.superpowers/sdd/track-b-wave1-report.md`

## Unattended rules
- Do NOT ask the user questions. Proceed with best judgment.
- Commit on this branch only. Do not push.
- Do NOT modify fe/ dashboard components (Track A owns FE).
- You MAY update `docs/automate/plan.md` F-E checkboxes only after docs are done.

## Task 6 — API-007 auth public paths
1. Read `backend/app/auth/` middleware for public/exempt paths
2. Align `docs/api/README.md` so `/health`, `/docs`, `/redoc`, `/openapi.json` status matches reality
3. Commit: `docs(api): align public paths with AuthMiddleware (F-E)`

## Task 7 — DS-007 layout.md sync
1. Compare `docs/ui/layout.md` with `fe/src/config/nav-manifest.tsx` and connector taxonomy notes
2. Fix any drift (connectors redirect, 数据连接, F-B taxonomy labels)
3. Commit: `docs(ui): layout.md nav sync (F-E DS-007)`
4. If plan F-E rows can be checked, check them with `（完成于 2026-07-09）` and commit

## Return
Write full report to the report path. Return only: status, commit SHAs, summary, concerns.

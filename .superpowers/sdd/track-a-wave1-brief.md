# Track A Wave1 Brief — Tasks 1–2 (F-A + F-B)

Work from: `C:/Users/30381/Desktop/VitalSpan/.worktrees/grad-dash-ux`
Branch: `feat/grad-dash-ux`
Base commit: `f5b890b`
Plan: `docs/superpowers/plans/2026-07-09-graduation-dash-ux.md` Tasks 1–2
Report to: `C:/Users/30381/Desktop/VitalSpan/.superpowers/sdd/track-a-wave1-report.md`

## Unattended rules
- Do NOT ask the user questions. Make reasonable decisions and proceed.
- Commit on this branch only. Do not push unless asked.
- Do not touch docs/api, docs/ui (Track B owns those).
- Do not implement undo/filters yet (Tasks 3–4 are Wave2).

## Global Constraints
- Reuse `ChartRenderer` / `useChartExecute` / `ChartConfigPanel` — no new executors
- fe/ only; TailAdmin design system
- No F-F, no align/multi-select, no linkage, no AI

## Task 1 — F-A edit-mode live chart
1. TDD: fail test that edit+ready config must NOT show「保存布局后可在预览查看出图」; should render ChartRenderer path
2. Change `fe/src/components/dashboard/DashboardWidget.tsx`: when `mode==="edit"` && `isWidgetConfigReady(widget.chartConfig)` render `ChartRenderer` like view; else compact pending state
3. Pass `filterParameters` / `executeKey` through
4. Run focused vitest; commit `feat(dash): edit-mode live ChartRenderer (M-DASH-UX F-A)`

## Task 2 — F-B WidgetInspector ChartConfigPanel
1. Embed existing `ChartConfigPanel` into `WidgetInspector` (data/style via panel; keep Dataset/SQL binding)
2. Wire `onChange` to update chartConfig
3. Smoke test; commit `feat(dash): WidgetInspector ChartConfigPanel (F-B)`

## Return
Write full report to the report path. Return only: status DONE|DONE_WITH_CONCERNS|BLOCKED, commit SHAs, one-line test summary, concerns.

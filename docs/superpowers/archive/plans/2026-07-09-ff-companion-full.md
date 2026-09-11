# F-F Companion Full Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: subagent-driven-development

**Goal:** 完成 plan.md 剩余 20 项 companion + PRD 同步

**Architecture:** 5 git worktrees × 3 waves; minimal companion deliverables per explore report

## Global Constraints

- fe/ only FE; API `/api/v1/`; 零第三方 BI 运行时
- Companion = 可测最小链，非 DE 全量
- 每轨独立分支 `cursor/ff-track-*-e95d`；commit + push；禁止改 goal.md
- PRD 同步轨单独 merge 后执行

---

## Wave 1 (parallel)

### Track A — DASH optional
- Multi-select widgets (Shift+click) + snap guides minimal
- Linkage rules edit panel on DashboardEditPage → PUT global-filters
- Tests: dashboard.smoke

### Track B — META (001, 003 first)
- Field mapping API + FE dialog
- Dimension resolver `GET /metadata/dimensions/resolve`
- Tests: meta r244 extension

### Track D — CAT-002
- `GET /api/v1/stats/aggregate` IF-02 PoC
- docs/api/README.md 登记
- Tests: new test_cat002_if02

---

## Wave 2 (parallel)

### Track B — META (002,004,005,006)
### Track C — RPT (001,002,003,005)
### Track D — CAT-003, DASH-005, DASH-006

---

## Wave 3

### Track C — RPT-007
### Track E — VIEW-001, VIEW-003/002, NFR perf suites
### Track F (controller) — merge all + plan/prd sync

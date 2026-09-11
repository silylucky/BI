# Customer Delivery Graduation — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development. Unattended: do not ask the human; decide and proceed. No PRs — commit on track branch; controller merges locally.

**Goal:** Raise customer-delivery maturity to ≥8.0 by removing fake main-path capabilities (Dataset memory, fake filters, mock report export/delivery) and adding RLS/audit UI + H1 gov nav hide.

**Architecture:** Four isolated git worktrees (T1–T4) in parallel after Phase 0 on `dev-auto`. Merge order T4→T1→T2→T3. Honesty gate must pass before graduation claim.

**Tech Stack:** FastAPI/SQLAlchemy/Alembic · React/Vite/Vitest · existing TailAdmin patterns

**Spec:** `docs/superpowers/specs/2026-07-10-customer-delivery-graduation-design.md`

## Global Constraints

- Honesty bar **A**: no silent fake success on customer main path
- Scope **A1**: no real bus; governance not a delivery blocker
- Nav **H1**: governance section hidden unless `VITALSPAN_GOV_NAV=1`
- Do not touch other tracks' exclusive paths
- Do not create GitHub PRs
- Do not ask the human questions — escalate only if truly BLOCKED
- Model: inherit parent session (do not switch models)
- Commit on your track branch when green

## Track exclusive paths

| Track | Branch | Paths |
|-------|--------|-------|
| T1 | `depth/t1-dataset` | `backend/app/metadata/dataset/**`, `backend/app/query/dataset/**`, `backend/app/api/v1/datasets.py`, `fe/src/pages/admin/datasets/**`, new Alembic |
| T2 | `depth/t2-filters` | `fe/src/components/dashboard/layoutUtils.ts`, FilterWidget*, GlobalFilterBar, `backend/app/dashboard/schemas.py`, `global_filters/**` |
| T3 | `depth/t3-reports` | `backend/app/reports/**`, `backend/app/integration/reports_export.py`, `backend/app/api/v1/reports/**` |
| T4 | `depth/t4-auth-ia` | `fe/src/pages/admin/system/**` (new RLS/audit pages), `nav-manifest` gov hide, `layout.md`, `routes.tsx`/`capabilities.ts` only as needed for T4 |

---

### Task Phase0 — Honesty scaffold + H1 flag (on T4 or main before parallel)

- [ ] Add env `VITALSPAN_GOV_NAV` default off; hide 治理 in `resolve-nav` / manifest
- [ ] Add `tests/test_delivery_honesty_gate.py` skeleton (may fail until tracks land)
- [ ] Commit

### Task T1 — Dataset ORM + real execute + visual editor

- [ ] Replace `_store` dict with ORM + Alembic migration
- [ ] Real `dataset/execute` rows (main path)
- [ ] FE: SchemaBrowser editor + computed field rows (no raw JSON)
- [ ] pytest + vitest green; commit on `depth/t1-dataset`

### Task T2 — Filter widgets + GlobalFilterBar

- [ ] `type: "chart" | "filter"` layout compatibility
- [ ] FilterWidget + Palette; GlobalFilterBar select/date/multiselect
- [ ] Filter values drive chart execute
- [ ] Tests green; commit on `depth/t2-filters`

### Task T3 — Report honesty

- [ ] Ban customer-path `mock://` silent success; real bytes or explicit 501
- [ ] Unconfigured SMTP → failed/unconfigured, not delivered+mock
- [ ] Tests green; commit on `depth/t3-reports`

### Task T4 — RLS/audit UI + H1

- [ ] Admin UI for `/rls/groups*` + role dimension-groups
- [ ] Audit events page for `/audit/events`
- [ ] H1 gov nav default hidden; deep-link banner if opened
- [ ] Tests green; commit on `depth/t4-auth-ia`

### Task PhaseM — Local merge + gate

- [ ] Merge T4→T1→T2→T3 into `dev-auto` (no PR)
- [ ] Honesty gate green
- [ ] Update plan.md M-DEPTH checkboxes + PRD companion where done

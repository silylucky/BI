# M1B DATA/ETL companion 质量推分 r10 实现计划

> **执行模式：** subagent-driven-development (option 1)
> **范围框定：** `tests/test_ingestion_config.py`、`tests/test_ingestion_models_crypto.py`、`tests/test_ingestion_api.py`、`tests/test_sync_executor.py`、`tests/test_scheduler.py`、`tests/test_ingestion_l1_smoke.py`、`tests/test_etl_rules.py`、`fe/src/pages/admin/ingestion/SyncJobFormPage.tsx`、`fe/src/pages/admin/ingestion/EtlRulesPage.tsx`、`fe/src/pages/admin/ingestion/ingestion.smoke.test.tsx`
> **子项：** DATA-004、DATA-001、DATA-002、ETL-001、DATA-003
> **项目技能：** `.agents/skills/`（P3 按 Task **Files** 与 **Skills** 按需 Read）
> **项目规则：** `.cursor/rules/`（`vitalspan-project.mdc`、`common.mdc`、`prd-sync.mdc` alwaysApply；`backend-fastapi.mdc` 触及 `backend/**`、`tests/**`；`fe-ui.mdc` 触及 `fe/**`）
> **For agentic workers:** REQUIRED SUB-SKILL: `subagent-driven-development`（option 1，每 Task 独立 subagent + 任务间 review）

**Goal:** 以测试补强 + DATA-003 最小 UX 防重推动 DATA-004/001/002/ETL-001/003 加权总分由 85.4–88.1 向 ≥90 迈进，不扩大 M1B 能力边界。

**Architecture:** 执行顺序 DATA-004 连接池/Fernet 路径 → DATA-001 API 404/limit/OpenAPI/耗时 smoke → DATA-002 executor/scheduler/L1 性能预算 → ETL-001 规则边界与 executor 脏数据链 → DATA-003 handler 防重 + vitest T-ING-14/16~19 → 全量验证。后端用 sqlite 内存元库 + mock 隔离外部 DB；不修改生产 ingestion 模块逻辑（除 FE ≤3 行/页防重 guard）。

**Tech Stack:** Python 3.11+、pytest 8、FastAPI TestClient、`unittest.mock.patch`、Vitest 3、Testing Library、TailAdmin/shadcn Button loading

## Global Constraints

- 零第三方 BI 运行时依赖（NFR-08）
- 本轮为**质量推分**，禁止 L2 `dataSourceId`、postgres 源 executor、BOOT rotation、新功能立项
- API 前缀 `/api/v1/`；错误体 `{"code","message","detail"}`
- `analytics_database_url`：空白→`None`；仅 `postgresql://` / `postgresql+psycopg://` 合法
- 并发 run：`status=running` 存在时 `POST .../run` 返回 **409** `RUN_ALREADY_IN_PROGRESS`
- 禁止修改 `docs/automate/goal.md` 或 `plan.md` 结构；hub 8 维重评属 **P5**
- DATA-003 生产变更：每页 ≤3 行 handler 入口 `if (submitting/saving) return`
- 禁止重复 r8 已有用例（T-ING-06~13、T-D01-09~13、T-D02-01~11、T-ETL-01~08、T-D04-01~10）
- Shell：`cd backend && pytest tests/...`；`cd fe && pnpm test && pnpm build && pnpm run check:design`

---

## 文件结构总览

| 文件 | PRD | 动作 |
|------|-----|------|
| `tests/test_ingestion_config.py` | DATA-004 | 扩展 T-D04-11~12 |
| `tests/test_ingestion_models_crypto.py` | DATA-004 | 扩展 T-D04-13 |
| `tests/test_ingestion_api.py` | DATA-001 | 扩展 T-D01-14~18 |
| `tests/test_sync_executor.py` | DATA-002 | 扩展 T-D02-13~14 |
| `tests/test_scheduler.py` | DATA-002 | 扩展 T-D02-15 |
| `tests/test_ingestion_l1_smoke.py` | DATA-002 | 扩展 T-L1-04 |
| `tests/test_etl_rules.py` | ETL-001 | 扩展 T-ETL-09~12 |
| `fe/src/pages/admin/ingestion/SyncJobFormPage.tsx` | DATA-003 | `handleSubmit` 防重 guard |
| `fe/src/pages/admin/ingestion/EtlRulesPage.tsx` | DATA-003 | `handleSave` 防重 guard |
| `fe/src/pages/admin/ingestion/ingestion.smoke.test.tsx` | DATA-003 | 扩展 T-ING-14、T-ING-16~19 |

**预估总文件数：10**（≤20）

---

### Task 1: DATA-004 — 连接池 `pool_pre_ping` 与 Fernet 启用路径测试

**Files:**
- Modify: `tests/test_ingestion_config.py`
- Modify: `tests/test_ingestion_models_crypto.py`

**Skills:**
- Read `.agents/skills/fastapi/SKILL.md`
- Read `.agents/skills/test-driven-development/SKILL.md`
- Read `.agents/skills/verification-before-completion/SKILL.md`

**UI skill:** none

**触及域：** `tests/`、`backend/app/ingestion/sync_executor.py`（只读参照 `_write_analytics`）

**Interfaces:**
- Consumes: `tests/conftest.py` 的 `analytics_sqlite` fixture、`CREDENTIAL_FERNET_KEY` env
- Produces: T-D04-11~13 用例；`_write_analytics` 调用 `create_engine(..., pool_pre_ping=True)` 契约

- [ ] **Step 1: 在 `tests/test_ingestion_config.py` 追加 T-D04-11~12（红）**

文件末尾追加：

```python
from unittest.mock import MagicMock, patch

from app.ingestion.models import SyncJob, encrypt_password
from app.ingestion.sync_executor import _write_analytics


@patch("app.ingestion.sync_executor.create_engine")
@patch("app.ingestion.sync_executor.get_settings")
def test_write_analytics_uses_pool_pre_ping(mock_get_settings, mock_create_engine):
    """T-D04-11: _write_analytics 使用 pool_pre_ping=True。"""
    mock_get_settings.return_value.analytics_database_url = (
        "postgresql+psycopg://vitalspan:vitalspan@localhost:5433/analytics"
    )
    mock_engine = MagicMock()
    mock_conn = MagicMock()
    mock_create_engine.return_value = mock_engine
    mock_engine.begin.return_value.__enter__.return_value = mock_conn

    job = SyncJob(
        name="pool-ping-job",
        source_type="mysql",
        source_host="127.0.0.1",
        source_port=3307,
        source_database="db",
        source_username="u",
        source_password_encrypted=encrypt_password("p"),
        source_table="t",
        target_table="tgt_pool",
        enabled=True,
    )
    _write_analytics(job, [{"col": "val"}])

    mock_create_engine.assert_called_once_with(
        "postgresql+psycopg://vitalspan:vitalspan@localhost:5433/analytics",
        pool_pre_ping=True,
    )


def test_analytics_sqlite_fixture_contract(analytics_sqlite):
    """T-D04-12: analytics_sqlite fixture 返回内存 sqlite URL。"""
    assert analytics_sqlite == "sqlite+pysqlite:///:memory:"


def test_settings_rejects_sqlite_analytics_url(monkeypatch):
    """T-D04-12: Settings 校验拒绝 sqlite 托管库 URL（生产仅 postgresql）。"""
    monkeypatch.setenv("ANALYTICS_DATABASE_URL", "sqlite+pysqlite:///:memory:")
    with pytest.raises(ValidationError) as exc_info:
        Settings(
            database_url=os.environ["DATABASE_URL"],
            secret_key=os.environ["SECRET_KEY"],
            credential_fernet_key=os.environ["CREDENTIAL_FERNET_KEY"],
        )
    assert "托管分析库 URL" in str(exc_info.value)
```

- [ ] **Step 2: 运行测试确认 T-D04-11 失败（若尚未实现）**

Run: `cd backend && pytest tests/test_ingestion_config.py::test_write_analytics_uses_pool_pre_ping tests/test_ingestion_config.py::test_analytics_sqlite_fixture_contract tests/test_ingestion_config.py::test_settings_rejects_sqlite_analytics_url -v`
Expected: T-D04-11 PASS（`sync_executor.py` 已有 `pool_pre_ping=True`）；T-D04-12 两项 PASS

- [ ] **Step 3: 在 `tests/test_ingestion_models_crypto.py` 追加 T-D04-13**

```python
def test_encrypt_password_with_env_fernet_key_roundtrip():
    """T-D04-13: CREDENTIAL_FERNET_KEY 启用路径 encrypt ≠ 明文且 decrypt roundtrip。"""
    assert os.environ.get("CREDENTIAL_FERNET_KEY")
    plain = "analytics-source-password"
    cipher = encrypt_password(plain)
    assert cipher != plain
    assert decrypt_password(cipher) == plain
```

- [ ] **Step 4: 运行 DATA-004 测试套件**

Run: `cd backend && pytest tests/test_ingestion_config.py tests/test_ingestion_models_crypto.py -v`
Expected: 全部 PASS（含既有 T-D04-01~10 + 新增 T-D04-11~13）

- [ ] **Step 5: Commit**

```bash
git add tests/test_ingestion_config.py tests/test_ingestion_models_crypto.py
git commit -m "test(DATA-004): add pool_pre_ping, analytics_sqlite, Fernet roundtrip cases T-D04-11~13"
```

---

### Task 2: DATA-001 — API 404/limit/OpenAPI/并发 run/耗时 smoke

**Files:**
- Modify: `tests/test_ingestion_api.py`

**Skills:**
- Read `.agents/skills/fastapi/SKILL.md`
- Read `.agents/skills/test-driven-development/SKILL.md`

**UI skill:** none

**触及域：** `tests/`、`backend/app/api/v1/ingestion/sync.py`（只读）

**Interfaces:**
- Consumes: `client`、`auth_headers`、`job_payload` fixtures；`get_meta_session`、`SyncRun`
- Produces: T-D01-14~18 用例

- [ ] **Step 1: 追加 T-D01-14~18 测试（红）**

在 `tests/test_ingestion_api.py` 末尾追加：

```python
import time


def test_get_and_delete_job_not_found_404(client, auth_headers):
    """T-D01-14: GET/DELETE 不存在 job → 404 NOT_FOUND。"""
    missing = uuid.uuid4()
    get_resp = client.get(f"/api/v1/ingestion/sync-jobs/{missing}", headers=auth_headers)
    assert get_resp.status_code == 404
    assert get_resp.json()["detail"]["code"] == "NOT_FOUND"

    del_resp = client.delete(f"/api/v1/ingestion/sync-jobs/{missing}", headers=auth_headers)
    assert del_resp.status_code == 404
    assert del_resp.json()["detail"]["code"] == "NOT_FOUND"


def test_list_runs_respects_limit_param(client, auth_headers, job_payload):
    """T-D01-15: GET .../runs?limit=5 尊重 limit。"""
    create = client.post("/api/v1/ingestion/sync-jobs", json=job_payload, headers=auth_headers)
    job_id = uuid.UUID(create.json()["id"])
    db = get_meta_session()
    for i in range(6):
        db.add(
            SyncRun(
                job_id=job_id,
                status="succeeded",
                trace_id=f"seed-run-{i}",
                started_at=datetime.now(timezone.utc),
                finished_at=datetime.now(timezone.utc),
                rows_synced=i,
            )
        )
    db.commit()
    db.close()

    listed = client.get(
        f"/api/v1/ingestion/sync-jobs/{job_id}/runs?limit=5",
        headers=auth_headers,
    )
    assert listed.status_code == 200
    assert len(listed.json()["items"]) <= 5

    client.delete(f"/api/v1/ingestion/sync-jobs/{job_id}", headers=auth_headers)


@patch("app.api.v1.ingestion.sync.run_job")
def test_trigger_run_consecutive_post_second_409(mock_run_job, client, auth_headers, job_payload):
    """T-D01-16: 连续两次 POST run → 第二次 409（run_job mock 保持 running）。"""
    mock_run_job.return_value = None
    create = client.post("/api/v1/ingestion/sync-jobs", json=job_payload, headers=auth_headers)
    job_id = create.json()["id"]
    with patch("app.api.v1.ingestion.sync.get_settings") as mock_get:
        mock_get.return_value.analytics_database_url = "postgresql+psycopg://u:p@localhost:5433/a"
        first = client.post(
            f"/api/v1/ingestion/sync-jobs/{job_id}/run",
            headers=auth_headers,
        )
        assert first.status_code == 202
        second = client.post(
            f"/api/v1/ingestion/sync-jobs/{job_id}/run",
            headers=auth_headers,
        )
    assert second.status_code == 409
    assert second.json()["detail"]["code"] == "RUN_ALREADY_IN_PROGRESS"
    client.delete(f"/api/v1/ingestion/sync-jobs/{job_id}", headers=auth_headers)


def test_openapi_ingestion_tag_on_post_run(client):
    """T-D01-17: OpenAPI POST run operation 含 ingestion tag。"""
    spec = client.get("/openapi.json").json()
    run_path = next(
        p for p in spec["paths"] if p.endswith("/sync-jobs/{job_id}/run")
    )
    post_op = spec["paths"][run_path]["post"]
    assert "ingestion" in post_op.get("tags", [])


@patch("app.api.v1.ingestion.sync.run_job")
def test_trigger_run_accepts_within_one_second(mock_run_job, client, auth_headers, job_payload):
    """T-D01-18: 手动 run 接受响应耗时 <1.0s。"""
    mock_run_job.return_value = None
    create = client.post("/api/v1/ingestion/sync-jobs", json=job_payload, headers=auth_headers)
    job_id = create.json()["id"]
    with patch("app.api.v1.ingestion.sync.get_settings") as mock_get:
        mock_get.return_value.analytics_database_url = "postgresql+psycopg://u:p@localhost:5433/a"
        start = time.perf_counter()
        response = client.post(
            f"/api/v1/ingestion/sync-jobs/{job_id}/run",
            headers=auth_headers,
        )
        elapsed = time.perf_counter() - start
    assert response.status_code == 202
    assert elapsed < 1.0
    client.delete(f"/api/v1/ingestion/sync-jobs/{job_id}", headers=auth_headers)
```

- [ ] **Step 2: 运行新增用例**

Run: `cd backend && pytest tests/test_ingestion_api.py::test_get_and_delete_job_not_found_404 tests/test_ingestion_api.py::test_list_runs_respects_limit_param tests/test_ingestion_api.py::test_trigger_run_consecutive_post_second_409 tests/test_ingestion_api.py::test_openapi_ingestion_tag_on_post_run tests/test_ingestion_api.py::test_trigger_run_accepts_within_one_second -v`
Expected: 全部 PASS

- [ ] **Step 3: 运行完整 API 测试文件**

Run: `cd backend && pytest tests/test_ingestion_api.py -v`
Expected: ≥18 项全绿

- [ ] **Step 4: Commit**

```bash
git add tests/test_ingestion_api.py
git commit -m "test(DATA-001): add 404/limit/OpenAPI/409/perf smoke T-D01-14~18"
```

---

### Task 3: DATA-002 — executor/scheduler 性能预算与 L1 耗时 smoke

**Files:**
- Modify: `tests/test_sync_executor.py`
- Modify: `tests/test_scheduler.py`
- Modify: `tests/test_ingestion_l1_smoke.py`

**Skills:**
- Read `.agents/skills/fastapi/SKILL.md`
- Read `.agents/skills/test-driven-development/SKILL.md`

**UI skill:** none

**触及域：** `tests/`、`backend/app/ingestion/sync_executor.py`、`backend/app/ingestion/scheduler.py`（只读）

**Interfaces:**
- Consumes: `_seed_job`、`_seed_job_with_l1_rules` helpers；`apply_rules` from `etl_rules`
- Produces: T-D02-13~15、T-L1-04 用例

- [ ] **Step 1: 在 `tests/test_sync_executor.py` 追加 T-D02-13~14**

```python
import time

from app.ingestion.etl_rules import apply_rules


def test_apply_rules_5000_rows_under_two_seconds():
    """T-D02-13: 5000 行经 apply_rules（空规则）耗时 <2.0s。"""
    rows = [{"idx": i, "status": "active"} for i in range(5000)]
    start = time.perf_counter()
    result = apply_rules(rows, [])
    elapsed = time.perf_counter() - start
    assert len(result) == 5000
    assert elapsed < 2.0


@patch("app.ingestion.sync_executor._write_analytics", return_value=0)
@patch(
    "app.ingestion.sync_executor._fetch_mysql_rows",
    return_value=[
        {"status": "deleted", "amount": "1"},
        {"status": "deleted", "amount": "2"},
    ],
)
def test_run_job_filter_removes_all_rows_writes_empty(mock_fetch, mock_write):
    """T-D02-14: 过滤规则剔除全部行 → write 收到 []、rows_synced == 0。"""
    db = get_meta_session()
    job = SyncJob(
        name="filter-all-job",
        source_type="mysql",
        source_host="127.0.0.1",
        source_port=3307,
        source_database="db",
        source_username="u",
        source_password_encrypted=encrypt_password("p"),
        source_table="t",
        target_table="tgt_empty",
        enabled=True,
    )
    db.add(job)
    db.flush()
    db.add(
        EtlRuleSet(
            job_id=job.id,
            rules=[{"type": "filter_rows", "column": "status", "op": "ne", "value": "deleted"}],
        )
    )
    db.commit()
    job_id = job.id
    db.close()

    run_job(job_id, "trace-filter-all")
    run = _latest_run(job_id)
    assert run.status == "succeeded"
    assert run.rows_synced == 0
    written_rows = mock_write.call_args[0][1]
    assert written_rows == []
```

- [ ] **Step 2: 在 `tests/test_scheduler.py` 追加 T-D02-15**

```python
@patch("app.ingestion.scheduler.get_scheduler")
def test_refresh_all_jobs_removes_stale_registered_jobs(mock_get_scheduler):
    """T-D02-15: refresh_all_jobs 移除 scheduler 中陈旧 job。"""
    stale_id = "00000000-0000-0000-0000-000000000000"
    mock_scheduler = MagicMock()
    stale_job = MagicMock()
    stale_job.id = stale_id
    mock_scheduler.get_jobs.return_value = [stale_job]
    mock_get_scheduler.return_value = mock_scheduler

    refresh_all_jobs()

    mock_scheduler.remove_job.assert_called_with(stale_id)
```

- [ ] **Step 3: 在 `tests/test_ingestion_l1_smoke.py` 追加 T-L1-04**

```python
@patch("app.ingestion.sync_executor._write_analytics", return_value=2)
@patch("app.ingestion.sync_executor._fetch_mysql_rows", return_value=MOCK_ROWS)
def test_l1_mock_smoke_end_to_end_under_three_seconds(
    mock_fetch, mock_write, smoke_client, auth_headers
):
    """T-L1-04: mock L1 全流程 create+rules+run+history 耗时 <3.0s。"""
    payload = {
        "name": "l1-perf-smoke",
        "source": {
            "type": "mysql",
            "host": "127.0.0.1",
            "port": 3307,
            "database": "sample_db",
            "username": "sample",
            "password": "sample",
            "table": "dirty_orders",
        },
        "target_table": "orders_perf_l1",
        "schedule_cron": None,
    }
    start = time.perf_counter()

    create = smoke_client.post("/api/v1/ingestion/sync-jobs", json=payload, headers=auth_headers)
    assert create.status_code == 201
    job_id = create.json()["id"]

    put_rules = smoke_client.put(
        f"/api/v1/ingestion/sync-jobs/{job_id}/etl-rules",
        json={"rules": L1_RULES},
        headers=auth_headers,
    )
    assert put_rules.status_code == 200

    run = smoke_client.post(
        f"/api/v1/ingestion/sync-jobs/{job_id}/run",
        headers=auth_headers,
    )
    assert run.status_code == 202
    run_id = run.json()["run_id"]

    deadline = time.time() + 10
    final = None
    while time.time() < deadline:
        listed = smoke_client.get(
            f"/api/v1/ingestion/sync-jobs/{job_id}/runs",
            headers=auth_headers,
        )
        match = next((i for i in listed.json()["items"] if i["id"] == run_id), None)
        if match and match["status"] in ("succeeded", "failed"):
            final = match
            break
        time.sleep(0.05)

    elapsed = time.perf_counter() - start
    assert final is not None
    assert final["status"] == "succeeded"
    assert elapsed < 3.0

    smoke_client.delete(f"/api/v1/ingestion/sync-jobs/{job_id}", headers=auth_headers)
```

- [ ] **Step 4: 运行 DATA-002 测试**

Run: `cd backend && pytest tests/test_sync_executor.py::test_apply_rules_5000_rows_under_two_seconds tests/test_sync_executor.py::test_run_job_filter_removes_all_rows_writes_empty tests/test_scheduler.py::test_refresh_all_jobs_removes_stale_registered_jobs tests/test_ingestion_l1_smoke.py::test_l1_mock_smoke_end_to_end_under_three_seconds -v`
Expected: 全部 PASS

- [ ] **Step 5: Commit**

```bash
git add tests/test_sync_executor.py tests/test_scheduler.py tests/test_ingestion_l1_smoke.py
git commit -m "test(DATA-002): add perf budget, filter-empty, stale scheduler, L1 timing T-D02-13~15 T-L1-04"
```

---

### Task 4: ETL-001 — 规则边界与 executor 脏数据链

**Files:**
- Modify: `tests/test_etl_rules.py`
- Modify: `tests/test_sync_executor.py`（T-ETL-12 追加于同文件末尾）

**Skills:**
- Read `.agents/skills/fastapi/SKILL.md`
- Read `.agents/skills/test-driven-development/SKILL.md`
- Read `.agents/skills/bug-case-library/SKILL.md`

**UI skill:** none

**触及域：** `tests/`、`backend/app/ingestion/etl_rules.py`（只读）

**Interfaces:**
- Consumes: `apply_rules`；`_seed_job`、`_latest_run`、`run_job`
- Produces: T-ETL-09~12 用例

- [ ] **Step 1: 在 `tests/test_etl_rules.py` 追加 T-ETL-09~11**

```python
def test_filter_rows_unknown_op_keeps_row():
    """T-ETL-09: filter_rows 未知 op 默认保留行。"""
    rows = [{"status": "active"}]
    rules = [{"type": "filter_rows", "column": "status", "op": "regex", "value": "active"}]
    assert apply_rules(rows, rules) == [{"status": "active"}]


def test_cast_type_unknown_to_falls_back_to_str():
    """T-ETL-10: cast_type 未知 to 回退 str()。"""
    rows = [{"amount": 42}]
    rules = [{"type": "cast_type", "column": "amount", "to": "decimal"}]
    assert apply_rules(rows, rules)[0]["amount"] == "42"


def test_empty_rules_chain_preserves_rows():
    """T-ETL-11: rules: [] 不改变行集。"""
    rows = [{"a": 1}, {"a": 2}]
    assert apply_rules(rows, []) == [{"a": 1}, {"a": 2}]
```

- [ ] **Step 2: 在 `tests/test_sync_executor.py` 追加 T-ETL-12**

```python
@patch("app.ingestion.sync_executor._write_analytics", return_value=1)
@patch(
    "app.ingestion.sync_executor._fetch_mysql_rows",
    return_value=[{"amount": "bad", "note": None}],
)
def test_run_job_cast_fail_then_fill_null(mock_fetch, mock_write):
    """T-ETL-12: cast 失败变 None + fill_null 补救后 write 收到填充值。"""
    db = get_meta_session()
    job = SyncJob(
        name="dirty-cast-job",
        source_type="mysql",
        source_host="127.0.0.1",
        source_port=3307,
        source_database="db",
        source_username="u",
        source_password_encrypted=encrypt_password("p"),
        source_table="t",
        target_table="tgt_dirty",
        enabled=True,
    )
    db.add(job)
    db.flush()
    db.add(
        EtlRuleSet(
            job_id=job.id,
            rules=[
                {"type": "cast_type", "column": "amount", "to": "float"},
                {"type": "fill_null", "column": "note", "value": "无备注"},
            ],
        )
    )
    db.commit()
    job_id = job.id
    db.close()

    run_job(job_id, "trace-dirty-cast")
    run = _latest_run(job_id)
    assert run.status == "succeeded"
    written = mock_write.call_args[0][1][0]
    assert written["amount"] is None
    assert written["note"] == "无备注"
```

- [ ] **Step 3: 运行 ETL 测试**

Run: `cd backend && pytest tests/test_etl_rules.py tests/test_sync_executor.py::test_run_job_cast_fail_then_fill_null -v`
Expected: ≥16 项 etl_rules + T-ETL-12 PASS；T-ETL-08 保持绿

- [ ] **Step 4: Commit**

```bash
git add tests/test_etl_rules.py tests/test_sync_executor.py
git commit -m "test(ETL-001): add unknown op/cast/empty rules and dirty executor chain T-ETL-09~12"
```

---

### Task 5: DATA-003 — 表单防重 guard + vitest 扩展

**Files:**
- Modify: `fe/src/pages/admin/ingestion/SyncJobFormPage.tsx`
- Modify: `fe/src/pages/admin/ingestion/EtlRulesPage.tsx`
- Modify: `fe/src/pages/admin/ingestion/ingestion.smoke.test.tsx`

**Skills:**
- Read `.agents/skills/b-design-system-tailadmin-radix/SKILL.md`
- Read `.agents/skills/test-driven-development/SKILL.md`
- Read `.agents/skills/verification-before-completion/SKILL.md`

**UI Acceptance:**
- 复用 TailAdmin/shadcn `Button` `loading` + `variant="primary"`；错误态 `border-error-500 bg-error-50` 条 + `重试` outline 按钮
- desktop 1400 与 mobile 375 viewport smoke 无明显错位、重叠、文本溢出
- loading（Skeleton）、empty、error+重试、submitting/saving loading 态有实现
- `pnpm run check:design` 无硬编码 hex、无局部私有组件体系漂移

**触及域：** `fe/src/pages/admin/ingestion/`

**Interfaces:**
- Consumes: `mockApiFetch`、`setViewport` helpers（既有 smoke 文件）
- Produces: `handleSubmit`/`handleSave` 入口防重；T-ING-14、T-ING-16~19

- [ ] **Step 1: 在 `ingestion.smoke.test.tsx` 追加 T-ING-14、T-ING-16~19（红）**

在 `describe` 闭合 `});` 之前追加：

```typescript
  it("SyncJobHistoryPage_error_state (T-ING-14)", async () => {
    setViewport(375);
    mockApiFetch.mockRejectedValueOnce(new Error("加载历史失败"));
    render(
      <MemoryRouter initialEntries={["/admin/ingestion/sync-jobs/job-1/history"]}>
        <Routes>
          <Route
            path="/admin/ingestion/sync-jobs/:id/history"
            element={<SyncJobHistoryPage />}
          />
        </Routes>
      </MemoryRouter>,
    );
    expect(await screen.findByText("加载历史失败")).toBeInTheDocument();
    mockApiFetch.mockResolvedValueOnce({ items: [] });
    fireEvent.click(screen.getByRole("button", { name: "重试" }));
    await waitFor(() => {
      expect(mockApiFetch).toHaveBeenCalledTimes(2);
    });
  });

  it("SyncJobHistoryPage_requests_limit_20 (T-ING-16)", async () => {
    setViewport(1400);
    mockApiFetch.mockResolvedValueOnce({ items: [] });
    render(
      <MemoryRouter initialEntries={["/admin/ingestion/sync-jobs/job-1/history"]}>
        <Routes>
          <Route
            path="/admin/ingestion/sync-jobs/:id/history"
            element={<SyncJobHistoryPage />}
          />
        </Routes>
      </MemoryRouter>,
    );
    await screen.findByText("暂无运行记录");
    expect(mockApiFetch).toHaveBeenCalledWith(
      "/api/v1/ingestion/sync-jobs/job-1/runs?limit=20",
    );
  });

  it("EtlRulesPage_prevents_double_save (T-ING-17)", async () => {
    setViewport(1400);
    let resolveSave: () => void;
    const savePromise = new Promise<void>((r) => {
      resolveSave = r;
    });
    mockApiFetch
      .mockResolvedValueOnce({ rules: [] })
      .mockImplementationOnce(() => savePromise);
    render(
      <MemoryRouter initialEntries={["/admin/ingestion/sync-jobs/job-1/etl-rules"]}>
        <Routes>
          <Route
            path="/admin/ingestion/sync-jobs/:id/etl-rules"
            element={<EtlRulesPage />}
          />
        </Routes>
      </MemoryRouter>,
    );
    const saveBtn = await screen.findByRole("button", { name: "保存规则" });
    fireEvent.click(saveBtn);
    fireEvent.click(saveBtn);
    const putCalls = mockApiFetch.mock.calls.filter(
      (c) => typeof c[0] === "string" && c[0].includes("/etl-rules") && c[1]?.method === "PUT",
    );
    expect(putCalls).toHaveLength(1);
    resolveSave!();
  });

  it("SyncJobFormPage_prevents_double_submit (T-ING-18)", async () => {
    setViewport(375);
    let resolveCreate: () => void;
    const createPromise = new Promise<{ id: string }>((r) => {
      resolveCreate = () => r({ id: "new-job" });
    });
    mockApiFetch.mockImplementationOnce(() => createPromise);
    render(
      <MemoryRouter initialEntries={["/admin/ingestion/sync-jobs/new"]}>
        <Routes>
          <Route path="/admin/ingestion/sync-jobs/new" element={<SyncJobFormPage />} />
        </Routes>
      </MemoryRouter>,
    );
    await screen.findByLabelText("任务名称");
    fireEvent.change(screen.getByLabelText("任务名称"), { target: { value: "double-guard" } });
    const createBtn = screen.getAllByRole("button", { name: "创建" })[0];
    fireEvent.click(createBtn);
    fireEvent.click(createBtn);
    const postCalls = mockApiFetch.mock.calls.filter(
      (c) => c[0] === "/api/v1/ingestion/sync-jobs" && c[1]?.method === "POST",
    );
    expect(postCalls).toHaveLength(1);
    resolveCreate!();
  });

  it("SyncJobsPage_first_paint_under_500ms (T-ING-19)", async () => {
    setViewport(1400);
    const jobs = Array.from({ length: 10 }, (_, i) => ({
      id: `job-${i}`,
      name: `任务 ${i}`,
      source_type: "mysql",
      target_table: `t${i}`,
      enabled: true,
      schedule_cron: null,
    }));
    mockApiFetch.mockResolvedValueOnce({ items: jobs });
    const start = performance.now();
    render(
      <MemoryRouter initialEntries={["/admin/ingestion/sync-jobs"]}>
        <Routes>
          <Route path="/admin/ingestion/sync-jobs" element={<SyncJobsPage />} />
        </Routes>
      </MemoryRouter>,
    );
    await screen.findByText("任务 0");
    const elapsed = performance.now() - start;
    expect(elapsed).toBeLessThan(500);
  });
```

- [ ] **Step 2: 运行 vitest 确认 T-ING-17/18 失败**

Run: `cd fe && pnpm test -- ingestion.smoke.test.tsx -t "prevents_double"`
Expected: FAIL（尚无 handler 防重 guard）

- [ ] **Step 3: 在 `SyncJobFormPage.tsx` 添加防重 guard**

将 `handleSubmit` 改为：

```typescript
  const handleSubmit = async (event: FormEvent) => {
    event.preventDefault();
    if (submitting) return;
    setSubmitting(true);
    setError(null);
```

- [ ] **Step 4: 在 `EtlRulesPage.tsx` 添加防重 guard**

将 `handleSave` 改为：

```typescript
  const handleSave = async () => {
    if (!id) return;
    if (saving) return;
    setSaving(true);
    setError(null);
```

- [ ] **Step 5: 运行 vitest + design 检查**

Run: `cd fe && pnpm test -- ingestion.smoke.test.tsx -v`
Expected: ≥19 项全绿（T-ING-06~19）

Run: `cd fe && pnpm build && pnpm run check:design`
Expected: build 成功；check:design 全绿

- [ ] **Step 6: Commit**

```bash
git add fe/src/pages/admin/ingestion/SyncJobFormPage.tsx fe/src/pages/admin/ingestion/EtlRulesPage.tsx fe/src/pages/admin/ingestion/ingestion.smoke.test.tsx
git commit -m "feat(DATA-003): submit/save double-click guards + vitest T-ING-14/16~19"
```

---

### Task 6: 全量验证

**Files:**（只读验证，无修改）

**Skills:**
- Read `.agents/skills/verification-before-completion/SKILL.md`

**UI skill:** none

- [ ] **Step 1: 后端全量**

Run: `cd backend && ruff check . && pytest -v`
Expected: ruff 0 error；pytest 全绿

- [ ] **Step 2: 前端全量**

Run: `cd fe && pnpm install --frozen-lockfile && pnpm test && pnpm build && pnpm run check:design`
Expected: 全绿

- [ ] **Step 3: PRD 同步评估（本轮通常无需改 docs）**

本轮为质量推分、行为不变（除防重 guard），按 `prd-sync.mdc`：**通常无需**更新 PRD/域文档/API 登记。若 P5 评分器要求锚点更新，由 P5 对账。

- [ ] **Step 4: Commit（若有未提交变更）并准备 P5**

```bash
git status
```

Expected: working tree clean

---

## Spec self-review

| 检查项 | 结果 |
|--------|------|
| round-target 五项均有 Task | DATA-004→T1, DATA-001→T2, DATA-002→T3, ETL-001→T4, DATA-003→T5 |
| 无 TBD/TODO/适当处理 | 通过 |
| 每 Task 含验证命令 | 通过 |
| FE Task 含 UI skill + UI Acceptance | Task 5 通过 |
| 文件数 ≤20 | 10 文件 |
| 未超出 design 范围 | 通过 |

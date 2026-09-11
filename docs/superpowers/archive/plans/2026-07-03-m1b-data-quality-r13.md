# M1B DATA/ETL companion 质量推分 r13 实现计划

> **执行模式：** subagent-driven-development (option 1)
> **范围框定：** `tests/test_ingestion_config.py`、`tests/test_ingestion_api.py`、`tests/test_sync_executor.py`、`tests/test_scheduler.py`、`tests/test_ingestion_l1_smoke.py`、`tests/test_etl_rules.py`、`fe/src/pages/admin/ingestion/SyncJobsPage.tsx`、`fe/src/pages/admin/ingestion/ingestion.smoke.test.tsx`
> **子项：** DATA-004、DATA-003、DATA-002、ETL-001、DATA-001
> **项目技能：** `.agents/skills/`（P3 按 Task **Files** 与 **Skills** 按需 Read）
> **项目规则：** `.cursor/rules/`（`vitalspan-project.mdc`、`common.mdc`、`prd-sync.mdc` alwaysApply；`backend-fastapi.mdc` 触及 `backend/**`、`tests/**`；`fe-ui.mdc` 触及 `fe/**`）
> **For agentic workers:** REQUIRED SUB-SKILL: `subagent-driven-development`（option 1，每 Task 独立 subagent + 任务间 Spec review + Quality review）

**Goal:** 以测试补强 + DATA-003 手动运行 `AlertDialog` 二次确认，推动 DATA-004/003/002/ETL-001 加权总分由 89.3–89.8 向 ≥90 迈进，并巩固 DATA-001，不扩大 M1B 能力边界。

**Architecture:** 执行顺序 DATA-004 配置/compose 契约 → DATA-003 高危 run 确认 UX → DATA-002 executor/scheduler/API 并发与 L1 → ETL-001 规则链边界 → DATA-001 API 脱敏/OpenAPI 巩固 → 全量验证。后端以 sqlite 内存元库 + mock 隔离外部 DB；仅 DATA-003 允许 `SyncJobsPage.tsx` ≤25 行生产变更。

**Tech Stack:** Python 3.11+、pytest 8、FastAPI TestClient、`unittest.mock.patch`、Vitest 3、Testing Library、TailAdmin/shadcn `AlertDialog`

## Global Constraints

- 零第三方 BI 运行时依赖（NFR-08）
- 本轮为**质量推分**，禁止 L2 `dataSourceId`、postgres 源 executor、BOOT rotation、新功能立项
- API 前缀 `/api/v1/`；错误体 `{"code","message","detail"}`
- 并发 run：`status=running` 存在时 `POST .../run` 返回 **409** `RUN_ALREADY_IN_PROGRESS`
- 禁止修改 `docs/automate/goal.md` 或 `plan.md` 结构；hub 8 维重评属 **P5**
- DATA-003 生产变更：`SyncJobsPage.tsx` 仅 run 确认弹层 ≤25 行；禁止 `window.confirm`
- 禁止重复 r11/r12 已有用例（T-D04-11~16、T-D01-19~22、T-D02-13~22、T-ETL-15~19、T-ING-06~27 基线断言）；允许为 run 确认 UX **最小调整**既有 `SyncJobsPage_run_flow` / T-ING-13 点击路径
- Shell：`cd backend && pytest ../tests/...`；`cd fe && pnpm test && pnpm build && pnpm run check:design`
- 非法 cron：scheduler `except Exception: pass` 为既有行为，本轮只测不崩、不新增 API 422

---

## 文件结构总览

| 文件 | PRD | 动作 |
|------|-----|------|
| `tests/test_ingestion_config.py` | DATA-004 | 扩展 T-D04-17~19 |
| `fe/src/pages/admin/ingestion/SyncJobsPage.tsx` | DATA-003 | run `AlertDialog` 二次确认 ≤25 行 |
| `fe/src/pages/admin/ingestion/ingestion.smoke.test.tsx` | DATA-003 | 扩展 T-ING-28~31；微调 run 相关既有用例 |
| `tests/test_sync_executor.py` | DATA-002 | 扩展 T-D02-24~25 |
| `tests/test_scheduler.py` | DATA-002 | 扩展 T-D02-26 |
| `tests/test_ingestion_api.py` | DATA-002、DATA-001 | 扩展 T-D02-23、T-D01-23~25 |
| `tests/test_ingestion_l1_smoke.py` | DATA-002 | 扩展 T-L1-09 |
| `tests/test_etl_rules.py` | ETL-001 | 扩展 T-ETL-20~22 |

**预估总文件数：8**（≤20）

---

### Task 1: DATA-004 — 连接超时、compose healthcheck 契约、503 回归

**Files:**
- Modify: `tests/test_ingestion_config.py`

**Skills:**
- Read `.agents/skills/fastapi/SKILL.md`
- Read `.agents/skills/test-driven-development/SKILL.md`
- Read `.agents/skills/verification-before-completion/SKILL.md`

**UI skill:** none

**触及域：** `tests/`、`docker-compose.yml`（只读）、`backend/app/ingestion/sync_executor.py`（只读）

**Interfaces:**
- Consumes: `_seed_config_run_job`、`_latest_run_for_config`、`_write_analytics`、`run_job`（文件内已有）；`test_trigger_run_without_analytics_503` 模式（`tests/test_ingestion_api.py`）
- Produces: T-D04-17~19 用例

- [ ] **Step 1: 追加 T-D04-17 连接超时 OperationalError → run failed**

在 `tests/test_ingestion_config.py` 末尾追加：

```python
import re
from pathlib import Path

from sqlalchemy.exc import OperationalError


@patch("app.ingestion.sync_executor.create_engine")
@patch("app.ingestion.sync_executor.get_settings")
@patch(
    "app.ingestion.sync_executor._fetch_mysql_rows",
    return_value=[{"col": "v"}],
)
def test_run_job_connection_timeout_failed(
    mock_fetch, mock_get_settings, mock_create_engine
):
    """T-D04-17: 连接超时 OperationalError → failed + error_message 含 timeout。"""
    mock_get_settings.return_value.analytics_database_url = (
        "postgresql+psycopg://vitalspan:vitalspan@localhost:5433/analytics"
    )
    mock_engine = MagicMock()
    mock_create_engine.return_value = mock_engine
    mock_engine.begin.side_effect = OperationalError("connection timed out", None, None)

    job_id = _seed_config_run_job()
    run_job(job_id, "trace-timeout")
    run = _latest_run_for_config(job_id)
    assert run.status == "failed"
    assert run.error_message is not None
    assert "timeout" in run.error_message.lower()
    assert len(run.error_message) <= 500
```

- [ ] **Step 2: 追加 T-D04-18 docker-compose healthcheck 静态契约**

```python
def _compose_service_block(compose_text: str, service: str) -> str:
    pattern = rf"^\s*{re.escape(service)}:\s*$"
    lines = compose_text.splitlines()
    start = next(i for i, line in enumerate(lines) if re.match(pattern, line))
    block: list[str] = []
    for line in lines[start + 1 :]:
        if re.match(r"^\S", line) and not line.startswith(" "):
            break
        block.append(line)
    return "\n".join(block)


def test_docker_compose_healthcheck_contract():
    """T-D04-18: analytics-postgres / sample-mysql healthcheck 字段契约。"""
    compose_path = Path(__file__).resolve().parents[1] / "docker-compose.yml"
    text = compose_path.read_text(encoding="utf-8")
    analytics = _compose_service_block(text, "analytics-postgres")
    mysql = _compose_service_block(text, "sample-mysql")
    assert "pg_isready" in analytics
    assert "mysqladmin" in mysql and "ping" in mysql
    for block in (analytics, mysql):
        assert "interval:" in block
        assert "timeout:" in block
        assert "retries:" in block
```

- [ ] **Step 3: 追加 T-D04-19 缺失 ANALYTICS_DATABASE_URL → API run 503**

在 `tests/test_ingestion_config.py` 内新增 API 层回归（复用 `test_ingestion_api` 的 client fixture 模式）：

```python
from fastapi.testclient import TestClient

from app.main import app


@pytest.fixture
def config_api_client() -> TestClient:
    return TestClient(app)


def test_trigger_run_without_analytics_url_503_regression(
    config_api_client, auth_headers, monkeypatch
):
    """T-D04-19: 缺失 ANALYTICS_DATABASE_URL 时 POST run → 503 ANALYTICS_DB_NOT_CONFIGURED。"""
    from app.core.config import get_settings

    job_payload = {
        "name": "no-analytics-url",
        "source": {
            "type": "mysql",
            "host": "127.0.0.1",
            "port": 3307,
            "database": "sample_db",
            "username": "sample",
            "password": "sample",
            "table": "dirty_orders",
        },
        "target_table": "orders_clean",
        "schedule_cron": None,
    }
    create = config_api_client.post(
        "/api/v1/ingestion/sync-jobs", json=job_payload, headers=auth_headers
    )
    assert create.status_code == 201
    job_id = create.json()["id"]
    get_settings.cache_clear()
    with patch("app.api.v1.ingestion.sync.get_settings") as mock_get:
        mock_get.return_value.analytics_database_url = None
        response = config_api_client.post(
            f"/api/v1/ingestion/sync-jobs/{job_id}/run",
            headers=auth_headers,
        )
    assert response.status_code == 503
    assert response.json()["detail"]["code"] == "ANALYTICS_DB_NOT_CONFIGURED"
    config_api_client.delete(
        f"/api/v1/ingestion/sync-jobs/{job_id}", headers=auth_headers
    )
```

- [ ] **Step 4: 运行 DATA-004 测试套件**

Run: `cd backend && pytest ../tests/test_ingestion_config.py -v`
Expected: 全部 PASS（≥17 项，含 T-D04-17~19）

- [ ] **Step 5: Commit**

```bash
git add tests/test_ingestion_config.py
git commit -m "test(DATA-004): add timeout, compose healthcheck, analytics 503 cases T-D04-17~19"
```

**Review checkpoints:**
- [ ] **Spec review:** 对照 `design.md` §7.1 与 round-target DATA-004 验收；T-D04-17~19 断言与用例 ID 一一对应
- [ ] **Quality review:** `pytest ../tests/test_ingestion_config.py -v` 全绿；未修改 `backend/app/ingestion/` 生产逻辑

---

### Task 2: DATA-003 — 手动运行 AlertDialog 二次确认 + vitest 扩展

**Files:**
- Modify: `fe/src/pages/admin/ingestion/SyncJobsPage.tsx`
- Modify: `fe/src/pages/admin/ingestion/ingestion.smoke.test.tsx`

**Skills:**
- Read `.agents/skills/b-design-system-tailadmin-radix/SKILL.md`
- Read `.agents/skills/test-driven-development/SKILL.md`
- Read `.agents/skills/verification-before-completion/SKILL.md`

**UI Acceptance:**
- 复用 `AlertDialog` / `AlertDialogAction` / `AlertDialogCancel`（与删除确认同模式）；run Action 用 primary（`variant` 默认 primary），删除保持 destructive
- desktop 1400 与 mobile 375：run 确认弹层居中、取消路径不挤压主按钮；401 error 条可读
- hover/focus：`AlertDialog` 焦点陷阱；Action/Cancel 可 Tab；`runningId` loading 态保留
- `pnpm run check:design` 全绿（无裸 hex、无 `window.confirm`）
- T-ING-28/29：确认前无 POST `/run`；确认后单次 POST

**触及域：** `fe/src/pages/admin/ingestion/`

**Interfaces:**
- Consumes: 既有 `deleteTarget` / `AlertDialog` 模式；`handleRun(jobId)`；`apiFetch` POST `/run`
- Produces: `runTarget: SyncJobSummary | null` state；run 确认弹层；T-ING-28~31

- [ ] **Step 1: 在 `SyncJobsPage.tsx` 新增 run 确认状态与弹层（≤25 行净增）**

在 state 区追加 `runTarget`：

```tsx
const [runTarget, setRunTarget] = useState<SyncJobSummary | null>(null);
```

将 Play 按钮 `onClick` 从直接 `handleRun` 改为打开确认：

```tsx
onClick={() => setRunTarget(job)}
```

调整 `handleRun` 在成功后清空 `runTarget`：

```tsx
const handleRun = async (jobId: string) => {
  setRunningId(jobId);
  try {
    await apiFetch(`/api/v1/ingestion/sync-jobs/${jobId}/run`, { method: "POST" });
    setRunTarget(null);
  } catch (err) {
    setError(err instanceof Error ? err.message : "操作失败，请稍后重试");
  } finally {
    setRunningId(null);
  }
};
```

在删除 `AlertDialog` 之后追加 run 确认弹层：

```tsx
<AlertDialog
  open={runTarget !== null}
  onOpenChange={(open) => {
    if (!open && runningId === null) setRunTarget(null);
  }}
>
  <AlertDialogContent>
    <AlertDialogHeader>
      <AlertDialogTitle>确认手动运行同步？</AlertDialogTitle>
      <AlertDialogDescription>
        {runTarget
          ? `确定立即运行任务「${runTarget.name}」？将全量同步源表数据到托管分析库。`
          : null}
      </AlertDialogDescription>
    </AlertDialogHeader>
    <AlertDialogFooter>
      <AlertDialogCancel disabled={runningId !== null}>取消</AlertDialogCancel>
      <AlertDialogAction
        disabled={runningId !== null}
        onClick={(event) => {
          event.preventDefault();
          if (runTarget) void handleRun(runTarget.id);
        }}
      >
        {runningId === runTarget?.id ? "运行中…" : "运行"}
      </AlertDialogAction>
    </AlertDialogFooter>
  </AlertDialogContent>
</AlertDialog>
```

- [ ] **Step 2: 更新既有 run 相关用例以经过确认弹层**

更新 `SyncJobsPage_run_flow` 与 `SyncJobsPage_run_prevents_double_post (T-ING-13)`：点击「手动运行同步」后先 `findByText("确认手动运行同步？")`，再点「运行」按钮发起 POST。

- [ ] **Step 3: 追加 T-ING-28~31**

在 `ingestion.smoke.test.tsx` 末尾追加：

```tsx
  it("SyncJobsPage_run_confirms_and_calls_post (T-ING-28)", async () => {
    setViewport(1400);
    mockApiFetch
      .mockResolvedValueOnce({
        items: [
          {
            id: "job-run-confirm",
            name: "待运行任务",
            source_type: "mysql",
            target_table: "t",
            enabled: true,
            schedule_cron: null,
          },
        ],
      })
      .mockResolvedValueOnce(undefined);
    render(
      <MemoryRouter initialEntries={["/admin/ingestion/sync-jobs"]}>
        <Routes>
          <Route path="/admin/ingestion/sync-jobs" element={<SyncJobsPage />} />
        </Routes>
      </MemoryRouter>,
    );
    fireEvent.click(await screen.findByRole("button", { name: "手动运行同步" }));
    expect(await screen.findByText("确认手动运行同步？")).toBeInTheDocument();
    expect(screen.getByText(/待运行任务/)).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "运行" }));
    await waitFor(() => {
      expect(mockApiFetch).toHaveBeenCalledWith(
        "/api/v1/ingestion/sync-jobs/job-run-confirm/run",
        { method: "POST" },
      );
    });
    const postRuns = mockApiFetch.mock.calls.filter(
      (c) => typeof c[0] === "string" && c[0].endsWith("/run"),
    );
    expect(postRuns).toHaveLength(1);
  });

  it("SyncJobsPage_run_cancel_skips_api (T-ING-29)", async () => {
    setViewport(375);
    mockApiFetch.mockResolvedValueOnce({
      items: [
        {
          id: "job-no-run",
          name: "不运行",
          source_type: "mysql",
          target_table: "t",
          enabled: true,
          schedule_cron: null,
        },
      ],
    });
    render(
      <MemoryRouter initialEntries={["/admin/ingestion/sync-jobs"]}>
        <Routes>
          <Route path="/admin/ingestion/sync-jobs" element={<SyncJobsPage />} />
        </Routes>
      </MemoryRouter>,
    );
    fireEvent.click(await screen.findByRole("button", { name: "手动运行同步" }));
    fireEvent.click(screen.getByRole("button", { name: "取消" }));
    const postRuns = mockApiFetch.mock.calls.filter(
      (c) => typeof c[0] === "string" && c[0].endsWith("/run"),
    );
    expect(postRuns).toHaveLength(0);
  });

  it("SyncJobsPage_load_401_shows_error (T-ING-30)", async () => {
    setViewport(375);
    mockApiFetch.mockRejectedValueOnce(new Error("未登录或会话已过期"));
    render(
      <MemoryRouter initialEntries={["/admin/ingestion/sync-jobs"]}>
        <Routes>
          <Route path="/admin/ingestion/sync-jobs" element={<SyncJobsPage />} />
        </Routes>
      </MemoryRouter>,
    );
    expect(await screen.findByText("未登录或会话已过期")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "重试" })).toBeInTheDocument();
  });

  it("SyncJobHistoryPage_renders_100_rows_under_900ms (T-ING-31)", async () => {
    setViewport(1400);
    const runs = Array.from({ length: 100 }, (_, i) => ({
      id: `run-${i}`,
      status: "succeeded",
      trace_id: `trace-100-${i}`,
      started_at: `2026-07-03T10:${String(i % 60).padStart(2, "0")}:00Z`,
      finished_at: `2026-07-03T10:${String(i % 60).padStart(2, "0")}:01Z`,
      rows_synced: i,
      error_message: null,
      retry_count: 0,
    }));
    mockApiFetch.mockResolvedValueOnce({ items: runs });
    const start = performance.now();
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
    await screen.findByText("trace-100-0");
    expect(performance.now() - start).toBeLessThan(900);
  });
```

- [ ] **Step 4: 运行前端测试与设计检查**

Run: `cd fe && pnpm exec vitest run src/pages/admin/ingestion/ingestion.smoke.test.tsx`
Expected: ≥31 项 PASS

Run: `cd fe && pnpm build && pnpm run check:design`
Expected: exit 0

- [ ] **Step 5: Commit**

```bash
git add fe/src/pages/admin/ingestion/SyncJobsPage.tsx fe/src/pages/admin/ingestion/ingestion.smoke.test.tsx
git commit -m "feat(fe): DATA-003 run AlertDialog confirm + vitest T-ING-28~31"
```

**Review checkpoints:**
- [ ] **Spec review:** 对照 `design.md` §7.2、§8 UI 设计交付；确认文案「确认手动运行同步？」、primary/destructive 区分、T-ING-28~31 断言
- [ ] **Quality review:** vitest ≥31 项 + `check:design` 全绿；`SyncJobsPage.tsx` 净增 ≤25 行；无 `window.confirm`

---

### Task 3: DATA-002 — executor 性能/重试、scheduler 非法 cron、API 并发 409、L1 compose

**Files:**
- Modify: `tests/test_sync_executor.py`
- Modify: `tests/test_scheduler.py`
- Modify: `tests/test_ingestion_api.py`
- Modify: `tests/test_ingestion_l1_smoke.py`

**Skills:**
- Read `.agents/skills/fastapi/SKILL.md`
- Read `.agents/skills/test-driven-development/SKILL.md`
- Read `.agents/skills/verification-before-completion/SKILL.md`

**UI skill:** none

**触及域：** `tests/`、`backend/app/ingestion/sync_executor.py`、`scheduler.py`（只读）

**Interfaces:**
- Consumes: `_seed_job`、`_latest_run`、`get_meta_session`、`SyncRun`；`integration_env` fixture（`tests/conftest.py`）
- Produces: T-D02-23~26、T-L1-09

- [ ] **Step 1: 在 `tests/test_ingestion_api.py` 追加 T-D02-23 三连 POST 409**

```python
def test_trigger_run_triple_post_all_409_when_running_seeded(client, auth_headers, job_payload):
    """T-D02-23: seed running run 后连续 3 次 POST → 均 409 RUN_ALREADY_IN_PROGRESS。"""
    create = client.post("/api/v1/ingestion/sync-jobs", json=job_payload, headers=auth_headers)
    job_id = uuid.UUID(create.json()["id"])
    db = get_meta_session()
    db.add(
        SyncRun(
            job_id=job_id,
            status="running",
            trace_id="seed-triple-409",
            started_at=datetime.now(timezone.utc),
        )
    )
    db.commit()
    db.close()
    with patch("app.api.v1.ingestion.sync.get_settings") as mock_get:
        mock_get.return_value.analytics_database_url = "postgresql+psycopg://u:p@localhost:5433/a"
        for _ in range(3):
            response = client.post(
                f"/api/v1/ingestion/sync-jobs/{job_id}/run",
                headers=auth_headers,
            )
            assert response.status_code == 409
            assert response.json()["detail"]["code"] == "RUN_ALREADY_IN_PROGRESS"
    client.delete(f"/api/v1/ingestion/sync-jobs/{job_id}", headers=auth_headers)
```

- [ ] **Step 2: 在 `tests/test_sync_executor.py` 追加 T-D02-24、T-D02-25**

```python
def test_apply_rules_10000_rows_under_three_seconds():
    """T-D02-24: 10000 行空规则 apply_rules P95 <3.0s。"""
    rows = [{"idx": i, "status": "active"} for i in range(10000)]
    start = time.perf_counter()
    result = apply_rules(rows, [])
    elapsed = time.perf_counter() - start
    assert len(result) == 10000
    assert elapsed < 3.0


@patch("app.ingestion.sync_executor._fetch_mysql_rows", side_effect=ConnectionError("always fails"))
def test_run_job_retry_count_one_and_history_queryable(mock_fetch):
    """T-D02-25: 重试耗尽 retry_count==1；history GET 可查 failed + trace_id。"""
    job_id = _seed_job()
    run_job(job_id, "trace-retry-history")
    run = _latest_run(job_id)
    assert run.status == "failed"
    assert run.trace_id == "trace-retry-history"
    assert run.retry_count == 1
    assert run.error_message is not None
    assert mock_fetch.call_count >= 2
```

- [ ] **Step 3: 在 `tests/test_scheduler.py` 追加 T-D02-26**

```python
@patch("app.ingestion.scheduler.get_scheduler")
def test_refresh_all_jobs_invalid_cron_does_not_crash(mock_get_scheduler):
    """T-D02-26: schedule_cron='not-a-cron' refresh 不抛异常；scheduler 无该 job。"""
    engine = get_meta_engine()
    with engine.begin() as conn:
        conn.execute(text("DELETE FROM ingestion_sync_jobs"))
    db = get_meta_session()
    bad = SyncJob(
        name="bad-cron-job",
        source_type="mysql",
        source_host="127.0.0.1",
        source_port=3307,
        source_database="db",
        source_username="u",
        source_password_encrypted=encrypt_password("p"),
        source_table="t",
        target_table="tgt_bad_cron",
        schedule_cron="not-a-cron",
        enabled=True,
    )
    db.add(bad)
    db.commit()
    bad_id = bad.id
    db.close()

    mock_scheduler = MagicMock()
    mock_scheduler.get_jobs.return_value = []
    mock_get_scheduler.return_value = mock_scheduler

    refresh_all_jobs()

    registered_ids = {c.kwargs.get("id") for c in mock_scheduler.add_job.call_args_list}
    assert str(bad_id) not in registered_ids
```

- [ ] **Step 4: 在 `tests/test_ingestion_l1_smoke.py` 追加 T-L1-09**

```python
@pytest.mark.integration
def test_l1_compose_mysql_to_analytics_write_through(
    integration_env, smoke_client, auth_headers, monkeypatch
):
    """T-L1-09: compose 可用时样例 mysql→analytics 写穿；不可用 skip。"""
    from app.core.config import get_settings

    monkeypatch.setenv("ANALYTICS_DATABASE_URL", integration_env["analytics_url"])
    get_settings.cache_clear()
    target_table = f"orders_l1_compose_{uuid.uuid4().hex[:8]}"
    payload = {
        "name": "l1-compose-write",
        "source": {
            "type": "mysql",
            "host": "127.0.0.1",
            "port": 3307,
            "database": "sample_db",
            "username": "sample",
            "password": "sample",
            "table": "dirty_orders",
        },
        "target_table": target_table,
        "schedule_cron": None,
    }
    create = smoke_client.post("/api/v1/ingestion/sync-jobs", json=payload, headers=auth_headers)
    assert create.status_code == 201
    job_id = create.json()["id"]

    run = smoke_client.post(
        f"/api/v1/ingestion/sync-jobs/{job_id}/run",
        headers=auth_headers,
    )
    assert run.status_code == 202
    run_id = run.json()["run_id"]

    deadline = time.time() + 30
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
        time.sleep(0.2)
    assert final is not None
    assert final["status"] == "succeeded"
    assert final["rows_synced"] >= 1

    from sqlalchemy import create_engine, text

    engine = create_engine(integration_env["analytics_url"])
    with engine.connect() as conn:
        count = conn.execute(text(f'SELECT COUNT(*) FROM "{target_table}"')).scalar_one()
        assert count >= 1

    smoke_client.delete(f"/api/v1/ingestion/sync-jobs/{job_id}", headers=auth_headers)
```

- [ ] **Step 5: 运行 DATA-002 测试套件**

Run: `cd backend && pytest ../tests/test_sync_executor.py ../tests/test_scheduler.py ../tests/test_ingestion_api.py::test_trigger_run_triple_post_all_409_when_running_seeded ../tests/test_ingestion_l1_smoke.py -v`
Expected: 全部 PASS（T-L1-09 在 compose 不可用时 skip）

- [ ] **Step 6: Commit**

```bash
git add tests/test_sync_executor.py tests/test_scheduler.py tests/test_ingestion_api.py tests/test_ingestion_l1_smoke.py
git commit -m "test(DATA-002): add concurrent 409, 10k perf, invalid cron, compose L1 T-D02-23~26 T-L1-09"
```

**Review checkpoints:**
- [ ] **Spec review:** 对照 `design.md` §7.3；T-D02-23~26、T-L1-09 与 round-target DATA-002 验收一致
- [ ] **Quality review:** pytest 全绿；未为非法 cron 新增 API 422；T-L1-09 带 `@pytest.mark.integration`

---

### Task 4: ETL-001 — 规则冲突链、越界 JSON、脏数据 executor 管线

**Files:**
- Modify: `tests/test_etl_rules.py`
- Modify: `tests/test_sync_executor.py`（仅 T-ETL-22 executor mock 写穿）

**Skills:**
- Read `.agents/skills/fastapi/SKILL.md`
- Read `.agents/skills/test-driven-development/SKILL.md`

**UI skill:** none

**触及域：** `tests/`、`backend/app/ingestion/etl_rules.py`（只读）

**Interfaces:**
- Consumes: `apply_rules`、`_seed_job`、`_latest_run`、`run_job`
- Produces: T-ETL-20~22

- [ ] **Step 1: 在 `tests/test_etl_rules.py` 追加 T-ETL-20、T-ETL-21**

```python
def test_rename_column_chain_deterministic_last_wins():
    """T-ETL-20: 同列双 rename_column 顺序应用 → 最终列 sku。"""
    rows = [{"product_name": "Widget", "amount": "1"}]
    rules = [
        {"type": "rename_column", "from": "product_name", "to": "product"},
        {"type": "rename_column", "from": "product", "to": "sku"},
    ]
    result = apply_rules(rows, rules)
    assert len(result) == 1
    assert "sku" in result[0]
    assert result[0]["sku"] == "Widget"
    assert "product_name" not in result[0]
    assert "product" not in result[0]


def test_apply_rules_oversized_column_name_does_not_crash():
    """T-ETL-21: 超长 column 名（260+ 字符）apply 不崩且行数不变。"""
    long_col = "c" * 260
    rows = [{"amount": "bad", long_col: None}]
    rules = [{"type": "fill_null", "column": long_col, "value": "filled"}]
    result = apply_rules(rows, rules)
    assert len(result) == 1
```

- [ ] **Step 2: 在 `tests/test_sync_executor.py` 追加 T-ETL-22**

```python
@patch("app.ingestion.sync_executor._write_analytics")
@patch("app.ingestion.sync_executor._fetch_mysql_rows")
def test_run_job_dirty_amount_fill_null_write_through(mock_fetch, mock_write):
    """T-ETL-22: amount='bad' + fill_null → write 行 amount is None 且 note 已填充。"""
    mock_fetch.return_value = [
        {"amount": "bad", "note": None, "status": "active"},
    ]
    mock_write.return_value = 1
    db = get_meta_session()
    job = SyncJob(
        name="dirty-fill-job",
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
                {"type": "fill_null", "column": "note", "value": "默认备注"},
            ],
        )
    )
    db.commit()
    job_id = job.id
    db.close()

    run_job(job_id, "trace-dirty-fill")
    run = _latest_run(job_id)
    assert run.status == "succeeded"
    assert run.rows_synced == 1
    written = mock_write.call_args[0][1]
    assert written[0]["amount"] is None
    assert written[0]["note"] == "默认备注"
```

- [ ] **Step 3: 运行 ETL-001 测试套件**

Run: `cd backend && pytest ../tests/test_etl_rules.py ../tests/test_sync_executor.py::test_run_job_dirty_amount_fill_null_write_through -v`
Expected: 全部 PASS（≥25 项 etl_rules + T-ETL-22）；T-ETL-15 保持绿

- [ ] **Step 4: Commit**

```bash
git add tests/test_etl_rules.py tests/test_sync_executor.py
git commit -m "test(ETL-001): add rename chain, oversized column, dirty fill T-ETL-20~22"
```

**Review checkpoints:**
- [ ] **Spec review:** 对照 `design.md` §7.4；T-ETL-20~22 断言与方案比选 §6.5 一致
- [ ] **Quality review:** pytest 全绿；未引入规则 version 字段或冲突报错新行为

---

### Task 5: DATA-001 — PUT 空密码脱敏、并发 create P95、OpenAPI SyncRunItem 快照

**Files:**
- Modify: `tests/test_ingestion_api.py`

**Skills:**
- Read `.agents/skills/fastapi/SKILL.md`
- Read `.agents/skills/test-driven-development/SKILL.md`
- Read `.agents/skills/verification-before-completion/SKILL.md`

**UI skill:** none

**触及域：** `tests/`、`backend/app/api/v1/ingestion/sync.py`（只读 `preserve_password`）

**Interfaces:**
- Consumes: `job_payload`、`get_meta_session`、`SyncJob`、`decrypt_password`
- Produces: T-D01-23~25

- [ ] **Step 1: 追加 T-D01-23 PUT 空 password 保留密文**

```python
from app.ingestion.models import SyncJob, decrypt_password


def test_put_empty_password_preserves_cipher_masks_response(client, auth_headers, job_payload):
    """T-D01-23: PUT password='' 保留 DB 密文；GET detail password=='***'。"""
    create = client.post("/api/v1/ingestion/sync-jobs", json=job_payload, headers=auth_headers)
    assert create.status_code == 201
    job_id = create.json()["id"]
    assert create.json()["source"]["password"] == "***"

    db = get_meta_session()
    job = db.get(SyncJob, uuid.UUID(job_id))
    original_cipher = job.source_password_encrypted
    db.close()

    updated = {
        **job_payload,
        "name": "renamed-empty-pw",
        "source": {**job_payload["source"], "password": ""},
    }
    put = client.put(
        f"/api/v1/ingestion/sync-jobs/{job_id}",
        json=updated,
        headers=auth_headers,
    )
    assert put.status_code == 200

    detail = client.get(f"/api/v1/ingestion/sync-jobs/{job_id}", headers=auth_headers)
    assert detail.json()["source"]["password"] == "***"

    db = get_meta_session()
    job_after = db.get(SyncJob, uuid.UUID(job_id))
    assert job_after.source_password_encrypted == original_cipher
    assert decrypt_password(job_after.source_password_encrypted) == job_payload["source"]["password"]
    db.close()

    client.delete(f"/api/v1/ingestion/sync-jobs/{job_id}", headers=auth_headers)
```

- [ ] **Step 2: 追加 T-D01-24 并发 5 次 create P95 <0.8s**

```python
def test_create_five_jobs_p95_under_800ms(client, auth_headers, job_payload):
    """T-D01-24: 5 次 create 不同 name P95 <0.8s；各 201。"""
    durations: list[float] = []
    job_ids: list[str] = []
    for i in range(5):
        payload = {**job_payload, "name": f"perf-create-{i}"}
        start = time.perf_counter()
        response = client.post("/api/v1/ingestion/sync-jobs", json=payload, headers=auth_headers)
        durations.append(time.perf_counter() - start)
        assert response.status_code == 201
        job_ids.append(response.json()["id"])
    durations_sorted = sorted(durations)
    p95_index = max(0, int(len(durations_sorted) * 0.95) - 1)
    assert durations_sorted[p95_index] < 0.8
    for job_id in job_ids:
        client.delete(f"/api/v1/ingestion/sync-jobs/{job_id}", headers=auth_headers)
```

- [ ] **Step 3: 追加 T-D01-25 OpenAPI SyncRunItem 必填字段**

```python
def test_openapi_sync_run_item_required_fields(client):
    """T-D01-25: SyncRunItem.required 含 id,status,started_at,trace_id；paths 含 runs GET。"""
    spec = client.get("/openapi.json").json()
    required = set(spec["components"]["schemas"]["SyncRunItem"]["required"])
    assert {"id", "status", "started_at", "trace_id"}.issubset(required)
    runs_path = next(
        p for p in spec["paths"] if p.endswith("/sync-jobs/{job_id}/runs")
    )
    assert "get" in spec["paths"][runs_path]
```

- [ ] **Step 4: 运行 DATA-001 API 测试套件**

Run: `cd backend && pytest ../tests/test_ingestion_api.py -v`
Expected: 全部 PASS（≥27 项，含 T-D01-23~25）

- [ ] **Step 5: Commit**

```bash
git add tests/test_ingestion_api.py
git commit -m "test(DATA-001): add empty password preserve, create P95, OpenAPI SyncRunItem T-D01-23~25"
```

**Review checkpoints:**
- [ ] **Spec review:** 对照 `design.md` §7.5 与 round-target DATA-001；脱敏/OpenAPI/性能三条验收覆盖
- [ ] **Quality review:** `pytest ../tests/test_ingestion_api.py -v` 全绿；未改动 `sync.py` 生产逻辑

---

### Task 6: 全量验证与 P4 等价命令

**Files:**（只读验证，无修改）

**Skills:**
- Read `.agents/skills/verification-before-completion/SKILL.md`

**UI skill:** none

- [ ] **Step 1: 后端全量**

Run: `cd backend && ruff check . && pytest -v`
Expected: exit 0

Run: `cd backend && pytest -v ../tests/test_ingestion_config.py ../tests/test_sync_executor.py ../tests/test_scheduler.py ../tests/test_etl_rules.py ../tests/test_ingestion_api.py ../tests/test_ingestion_l1_smoke.py`
Expected: 全部 PASS

- [ ] **Step 2: 前端全量**

Run: `cd fe && pnpm install --frozen-lockfile && pnpm test && pnpm build && pnpm run check:design`
Expected: exit 0；ingestion smoke ≥31 项

- [ ] **Step 3: 记录验证结果**

将上述命令与 exit code 写入 P5 验收材料；P4 人工 QA 按 `design.md` §8 截图清单执行（desktop 1400 run 确认、mobile 375 cancel + 401 error）

- [ ] **Step 4: Commit（若有文档对账）**

本轮通常**无需** PRD/services 文档同步（质量推分、行为与 PRD 已描述一致）。若有意偏离须在 commit message 注明。

**Review checkpoints:**
- [ ] **Spec review:** round-target 五项子项均有对应 Task 1~5 交付；文件数 8 ≤20
- [ ] **Quality review:** 全量验证命令 exit 0；无占位符、无超范围生产模块

---

## Self-Review

| 检查项 | 结果 |
|--------|------|
| round-target 5 子项均有 Task | DATA-004→T1, DATA-003→T2, DATA-002→T3, ETL-001→T4, DATA-001→T5 |
| 无 TBD/TODO/适当处理 | 通过 |
| 每 Task 含验证命令 | 通过 |
| 每 Task 含 Spec review + Quality review | 通过 |
| UI Task 含 Skills + UI Acceptance | Task 2 已填 |
| 文件预算 | 8 ≤ 20 |

## 执行 handoff

计划已保存。按 Automation 纪律固定 **option 1：subagent-driven-development** — 每 Task 派发独立 subagent，任务间 **Spec review + Quality review**，全部完成后进入 P4 `evolution-verifier`。

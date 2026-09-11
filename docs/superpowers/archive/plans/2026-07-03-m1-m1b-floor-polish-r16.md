# M1+M1B cross-cluster floor polish r16 实现计划

> **执行模式：** subagent-driven-development (option 1)
> **范围框定：** `tests/test_health.py`, `tests/test_router.py`, `tests/test_ci_env_contract.py`, `.github/workflows/ci.yml`, `tests/test_config.py`, `tests/test_trace.py`, `tests/test_etl_rules.py`, `tests/test_sync_executor.py`, `fe/src/pages/admin/ingestion/ingestion.smoke.test.tsx`
> **子项：** BOOT-001, BOOT-006, BOOT-004, DATA-003, ETL-001
> **项目技能：** `.agents/skills/`（P3 按 Files 按需 Read；plan 预指定 **Skills:**）
> **项目规则：** `.cursor/rules/`（alwaysApply 自动注入；触及 `backend/**/*.py` / `fe/**` 时 P3 动态匹配 `backend-fastapi.mdc` / `fe-ui.mdc`）

**Goal:** 为 M1+M1B 五项地板 PRD 补齐 L1 smoke 测试与 CI 契约，零业务逻辑变更（仅 `ci.yml` 加 `timeout-minutes`），推升 8 维薄弱分。

**Architecture:** 按依赖链顺序实施——后端路由/CORS 壳（BOOT-001）→ Settings/trace（BOOT-004）→ CI 守卫拾取全量新测（BOOT-006）→ ingestion ETL 边界（ETL-001）→ FE ingestion vitest 收尾（DATA-003）。每 Task 独立可测、独立 commit。

**Tech Stack:** FastAPI + pytest + ruff；React + Vitest + pnpm；GitHub Actions `ci.yml`

## Global Constraints

- 默认**零**生产业务逻辑变更；允许 `ci.yml` ≤4 行（`timeout-minutes`）
- 不修改 `docs/automate/goal.md` / `plan.md` 结构
- 不重复 r13/r14/r15 已交付用例编号（T-HLT-01~22、T-RTR-01~02 等保持绿）
- 真理源：`round-target` > `prd/F01-BOOT.md` + `prd/F16-DATA.md` > design.md
- 预估修改文件 **9**（≤20）；无新建文件
- P5 完成后建议人工 `create-evolution-plan` 激活 M2（本轮不执行）

---

### Task 1: BOOT-001 — CORS 预检 + 公开文档 + 空路由壳

**Files:**
- Modify: `tests/test_health.py`（追加 T-HLT-23~25）
- Modify: `tests/test_router.py`（追加 T-RTR-03~04）

**Skills:**
- Read `.agents/skills/test-driven-development/SKILL.md`
- Read `.agents/skills/fastapi/SKILL.md`

**Interfaces:**
- Consumes: `client` fixture from `tests/conftest.py`
- Produces: `test_docs_cors_preflight_illegal_origin`, `test_openapi_cors_preflight_illegal_origin`, `test_docs_and_openapi_public_without_auth`, `test_empty_api_v1_router_not_500`, `test_api_v1_router_has_at_least_two_routes`

- [ ] **Step 1: 追加 T-HLT-23~25 到 `tests/test_health.py`**

在文件末尾（`test_health_consecutive_p95_smoke` 之后）追加：

```python
@pytest.mark.parametrize("path", ["/docs", "/openapi.json"])
def test_public_path_cors_preflight_illegal_origin(client, path):
    """T-HLT-23/24: OPTIONS /docs 与 /openapi.json 非法 Origin → 400 无 evil ACAO。"""
    response = client.options(
        path,
        headers={
            "Origin": "http://evil.example",
            "Access-Control-Request-Method": "GET",
        },
    )
    assert response.status_code == 400
    acao = response.headers.get("access-control-allow-origin")
    assert acao is None or acao != "http://evil.example"


def test_docs_and_openapi_public_without_auth(client):
    """T-HLT-25: GET /docs 与 /openapi.json 无 Authorization → 200；OpenAPI 含 openapi 键。"""
    docs = client.get("/docs")
    assert docs.status_code == 200

    openapi = client.get("/openapi.json")
    assert openapi.status_code == 200
    assert "openapi" in openapi.json()
```

- [ ] **Step 2: 运行 health 测试验证新用例可收集**

Run: `cd backend && python3 -m pytest ../tests/test_health.py -v --collect-only | grep -E "HLT-23|HLT-24|HLT-25|illegal_origin|public_without"`
Expected: 3 个新测试项出现在 collect 输出

- [ ] **Step 3: 追加 T-RTR-03~04 到 `tests/test_router.py`**

在文件顶部 import 区追加 `from fastapi import FastAPI` 与 `from fastapi.testclient import TestClient`；在文件末尾追加：

```python
def test_empty_api_v1_router_not_500():
    """T-RTR-03: 空 APIRouter 挂载 /api/v1 → 404/405，非 500。"""
    from fastapi import APIRouter

    app = FastAPI()
    empty = APIRouter(prefix="/api/v1")
    app.include_router(empty)
    isolated = TestClient(app)

    for path in ("/api/v1", "/api/v1/"):
        response = isolated.get(path)
        assert response.status_code in (404, 405)
        assert response.status_code != 500


def test_api_v1_router_has_at_least_two_routes():
    """T-RTR-04: 生产 api_v1_router 路由数 ≥2（/me + ingestion 段）。"""
    paths = _route_paths()
    assert len(paths) >= 2, paths
```

- [ ] **Step 4: 运行 BOOT-001 验证**

Run: `cd backend && ruff check ../tests/test_health.py ../tests/test_router.py && python3 -m pytest ../tests/test_health.py ../tests/test_router.py -v`
Expected: PASS；health ≥25 项、router ≥4 项

- [ ] **Step 5: Commit**

```bash
git add tests/test_health.py tests/test_router.py
git commit -m "test(BOOT-001): CORS preflight for docs/openapi + empty v1 router shell"
```

---

### Task 2: BOOT-004 — Settings 组合 + trace 隔离 + LOG_LEVEL 热切换

**Files:**
- Modify: `tests/test_config.py`（追加 T-CFG-11~13）
- Modify: `tests/test_trace.py`（追加 T-TRC-17~18）

**Skills:**
- Read `.agents/skills/test-driven-development/SKILL.md`
- Read `.agents/skills/fastapi/SKILL.md`

**Interfaces:**
- Consumes: `_BASE_KWARGS`, `get_settings`, `configure_logging`, `client` fixture, `JsonFormatter`
- Produces: `test_cors_origins_raw_empty_string`, `test_analytics_database_url_rejects_mysql`, `test_production_env_allows_sqlite_meta_url`, `test_consecutive_requests_trace_id_isolated`, `test_log_level_hot_switch_suppresses_info_after_reconfigure`

- [ ] **Step 1: 追加 T-CFG-11~13 到 `tests/test_config.py`**

在文件末尾追加：

```python
def test_cors_origins_raw_empty_string():
    """T-CFG-11: cors_origins_raw='' → cors_origins == []。"""
    settings = Settings(**_BASE_KWARGS, cors_origins_raw="")
    assert settings.cors_origins == []


def test_analytics_database_url_rejects_mysql():
    """T-CFG-12: analytics_database_url=mysql:// → ValidationError 含 postgresql 提示。"""
    with pytest.raises(ValidationError) as exc_info:
        Settings(**_BASE_KWARGS, analytics_database_url="mysql://bad")
    message = str(exc_info.value)
    assert "postgresql" in message


def test_production_env_allows_sqlite_meta_url():
    """T-CFG-13: vitalspan_env=production + sqlite database_url 可实例化（文档化现状）。"""
    settings = Settings(
        database_url="sqlite+pysqlite:///./meta.db",
        secret_key="ci-test-secret-key-min-32-chars-long!!",
        credential_fernet_key="AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA=",
        vitalspan_env="production",
    )
    assert settings.vitalspan_env == "production"
    assert settings.database_url.startswith("sqlite+")
```

- [ ] **Step 2: 追加 T-TRC-17~18 到 `tests/test_trace.py`**

在文件末尾追加：

```python
def test_consecutive_requests_trace_id_isolated(client):
    """T-TRC-17: 连续两请求不同 X-Trace-Id；响应头与 request_started 日志各自匹配。"""
    import io
    import json

    stream = io.StringIO()
    handler = logging.StreamHandler(stream)
    handler.setFormatter(JsonFormatter())
    logger = logging.getLogger("vitalspan.http")
    logger.addHandler(handler)
    logger.setLevel(logging.INFO)
    try:
        trace_a = "a" * 32
        trace_b = "b" * 32
        resp_a = client.get("/health", headers={"X-Trace-Id": trace_a})
        resp_b = client.get("/health", headers={"X-Trace-Id": trace_b})
        assert resp_a.status_code == 200
        assert resp_b.status_code == 200
        assert resp_a.headers.get("X-Trace-Id") == trace_a
        assert resp_b.headers.get("X-Trace-Id") == trace_b
        assert resp_a.headers.get("X-Trace-Id") != resp_b.headers.get("X-Trace-Id")

        payloads = [json.loads(line) for line in stream.getvalue().splitlines() if line.strip()]
        started = [p for p in payloads if p.get("message") == "request_started"]
        assert len(started) >= 2
        trace_ids_in_logs = [p["traceId"] for p in started]
        assert trace_a in trace_ids_in_logs
        assert trace_b in trace_ids_in_logs
    finally:
        logger.removeHandler(handler)


def test_log_level_hot_switch_suppresses_info_after_reconfigure(client, monkeypatch):
    """T-TRC-18: DEBUG 配置后切 ERROR 重配；第二次 GET /health 无 INFO request_started。"""
    monkeypatch.setenv("LOG_LEVEL", "DEBUG")
    get_settings.cache_clear()
    configure_logging(get_settings())

    monkeypatch.setenv("LOG_LEVEL", "ERROR")
    get_settings.cache_clear()
    configure_logging(get_settings())

    stream = io.StringIO()
    handler = logging.StreamHandler(stream)
    handler.setFormatter(JsonFormatter())
    http_logger = logging.getLogger("vitalspan.http")
    http_logger.addHandler(handler)
    http_logger.setLevel(logging.ERROR)
    try:
        response = client.get("/health")
        assert response.status_code == 200
        payloads = [json.loads(line) for line in stream.getvalue().splitlines() if line.strip()]
        started_rows = [p for p in payloads if p.get("message") == "request_started"]
        assert started_rows == []
    finally:
        http_logger.removeHandler(handler)
        monkeypatch.delenv("LOG_LEVEL", raising=False)
        get_settings.cache_clear()
        configure_logging(get_settings())
```

- [ ] **Step 3: 运行 BOOT-004 验证**

Run: `cd backend && ruff check ../tests/test_config.py ../tests/test_trace.py && python3 -m pytest ../tests/test_config.py ../tests/test_trace.py -v`
Expected: PASS；config ≥13 项、trace ≥18 项

- [ ] **Step 4: Commit**

```bash
git add tests/test_config.py tests/test_trace.py
git commit -m "test(BOOT-004): Settings combo edges + consecutive traceId isolation"
```

---

### Task 3: BOOT-006 — CI 守卫 + 收集率/耗时地板

**Files:**
- Modify: `.github/workflows/ci.yml`（backend `timeout-minutes: 15`；frontend `timeout-minutes: 20`）
- Modify: `tests/test_ci_env_contract.py`（追加 T-CI-10~14）

**Skills:**
- Read `.agents/skills/test-driven-development/SKILL.md`
- Read `.agents/skills/verification-before-completion/SKILL.md`

**Interfaces:**
- Consumes: `CI_YML`, `ci_yml_text` fixture, `CONFTEST_DEFAULTS`
- Produces: `test_pytest_collect_minimum_258`, `test_ci_jobs_have_timeout_minutes`, `test_ci_frontend_cache_dependency_path`, `test_ingestion_vitest_case_floor`, `test_ingestion_vitest_elapsed_under_budget`

- [ ] **Step 1: 修改 `.github/workflows/ci.yml`**

在 `backend:` job 的 `runs-on:` 行之后插入 `timeout-minutes: 15`；在 `frontend:` job 的 `runs-on:` 行之后插入 `timeout-minutes: 20`：

```yaml
  backend:
    runs-on: ubuntu-latest
    timeout-minutes: 15
    env:
      ...
  frontend:
    runs-on: ubuntu-latest
    timeout-minutes: 20
    defaults:
      ...
```

- [ ] **Step 2: 追加 T-CI-10~14 到 `tests/test_ci_env_contract.py`**

在文件末尾追加：

```python
def test_pytest_collect_minimum_258():
    """T-CI-10: pytest --collect-only 收集下限 ≥258。"""
    backend_dir = Path(__file__).resolve().parents[1] / "backend"
    result = subprocess.run(
        [sys.executable, "-m", "pytest", "--collect-only", "-q", "../tests"],
        cwd=backend_dir,
        capture_output=True,
        text=True,
        timeout=120,
    )
    assert result.returncode == 0, result.stderr
    last_line = result.stdout.strip().splitlines()[-1]
    count_str = last_line.split()[0]
    assert int(count_str) >= 258, f"expected ≥258 tests, got: {last_line}"


def test_ci_jobs_have_timeout_minutes(ci_yml_text):
    """T-CI-11: ci.yml backend/frontend job 各含 timeout-minutes。"""
    assert "timeout-minutes:" in ci_yml_text
    backend_block = ci_yml_text.split("frontend:")[0]
    frontend_block = ci_yml_text.split("frontend:")[1]
    assert "timeout-minutes:" in backend_block
    assert "timeout-minutes:" in frontend_block


def test_ci_frontend_cache_dependency_path(ci_yml_text):
    """T-CI-12: frontend job 含 cache-dependency-path: fe/pnpm-lock.yaml。"""
    assert "cache-dependency-path: fe/pnpm-lock.yaml" in ci_yml_text


def test_ingestion_vitest_case_floor():
    """T-CI-13: ingestion.smoke.test.tsx 中 it( 计数 ≥35。"""
    smoke_path = (
        Path(__file__).resolve().parents[1]
        / "fe"
        / "src"
        / "pages"
        / "admin"
        / "ingestion"
        / "ingestion.smoke.test.tsx"
    )
    source = smoke_path.read_text(encoding="utf-8")
    count = source.count("it(")
    assert count >= 35, f"expected ≥35 vitest cases, got {count}"


@pytest.mark.skipif(
    shutil.which("pnpm") is None
    or not (Path(__file__).resolve().parents[1] / "fe" / "node_modules").is_dir(),
    reason="T-CI-14: ingestion vitest budget requires pnpm + fe deps",
)
def test_ingestion_vitest_elapsed_under_budget():
    """T-CI-14: ingestion vitest 单文件 elapsed < 90s。"""
    fe_dir = Path(__file__).resolve().parents[1] / "fe"
    start = time.perf_counter()
    result = subprocess.run(
        [
            "pnpm",
            "exec",
            "vitest",
            "run",
            "src/pages/admin/ingestion/ingestion.smoke.test.tsx",
        ],
        cwd=fe_dir,
        capture_output=True,
        text=True,
        timeout=120,
    )
    elapsed = time.perf_counter() - start
    assert result.returncode == 0, result.stderr
    assert elapsed < 90.0, f"ingestion vitest took {elapsed:.1f}s"
```

- [ ] **Step 3: 运行 BOOT-006 验证**

Run: `cd backend && ruff check . && python3 -m pytest ../tests/test_ci_env_contract.py -v`
Expected: PASS（T-CI-14 在无 pnpm/node_modules 时 skip 属正常）

- [ ] **Step 4: Commit**

```bash
git add .github/workflows/ci.yml tests/test_ci_env_contract.py
git commit -m "ci(BOOT-006): job timeout-minutes + collect/vitest floor contracts"
```

---

### Task 4: ETL-001 — 规则边界 + 流水线降级

**Files:**
- Modify: `tests/test_etl_rules.py`（追加 T-ETL-23~24）
- Modify: `tests/test_sync_executor.py`（追加 T-ETL-25~26）

**Skills:**
- Read `.agents/skills/test-driven-development/SKILL.md`
- Read `.agents/skills/fastapi/SKILL.md`
- Read `.agents/skills/bug-case-library/SKILL.md`（修 bug 前检索；本轮为测边界）

**Interfaces:**
- Consumes: `apply_rules`, `run_job`, `_seed_job`, `_latest_run`, `get_meta_session`, `SyncJob`, `EtlRuleSet`, `encrypt_password`
- Produces: `test_numeric_rule_type_ignored`, `test_cast_type_missing_column_raises_keyerror`, `test_run_job_apply_rules_exception_failed_no_write`, `test_run_job_dirty_amount_none_with_fill_null_note`

- [ ] **Step 1: 追加 T-ETL-23~24 到 `tests/test_etl_rules.py`**

在文件末尾追加：

```python
def test_numeric_rule_type_ignored():
    """T-ETL-23: 规则 type 为数字 → apply_rules 不抛，行集不变。"""
    rows = [{"amount": "1"}]
    rules = [{"type": 123}]
    assert apply_rules(rows, rules) == [{"amount": "1"}]


def test_cast_type_missing_column_raises_keyerror():
    """T-ETL-24: cast_type 缺 column 键 → KeyError（与 executor failed 路径一致）。"""
    rows = [{"amount": "bad"}]
    rules = [{"type": "cast_type", "to": "float"}]
    with pytest.raises(KeyError):
        apply_rules(rows, rules)
```

- [ ] **Step 2: 追加 T-ETL-25~26 到 `tests/test_sync_executor.py`**

在文件末尾追加：

```python
@patch("app.ingestion.sync_executor._write_analytics")
@patch("app.ingestion.sync_executor._fetch_mysql_rows", return_value=[{"amount": "1"}])
@patch("app.ingestion.sync_executor.apply_rules", side_effect=RuntimeError("rules failed"))
def test_run_job_apply_rules_exception_failed_no_write(mock_apply, mock_fetch, mock_write):
    """T-ETL-25: apply_rules 异常 → status failed、error_message 含 rules failed、不写库。"""
    job_id = _seed_job()
    run_job(job_id, "trace-rules-fail")
    run = _latest_run(job_id)
    assert run.status == "failed"
    assert run.error_message is not None
    assert "rules failed" in run.error_message
    mock_write.assert_not_called()


@patch("app.ingestion.sync_executor._write_analytics")
@patch("app.ingestion.sync_executor._fetch_mysql_rows")
def test_run_job_dirty_amount_none_with_fill_null_note(mock_fetch, mock_write):
    """T-ETL-26: amount='bad' cast 失败 + fill_null note → write 行 amount is None 且 note 已填充。"""
    mock_fetch.return_value = [
        {"amount": "bad", "note": None, "status": "active"},
    ]
    mock_write.return_value = 1
    db = get_meta_session()
    job = SyncJob(
        name="dirty-amount-note-job",
        source_type="mysql",
        source_host="127.0.0.1",
        source_port=3307,
        source_database="db",
        source_username="u",
        source_password_encrypted=encrypt_password("p"),
        source_table="t",
        target_table="tgt_amount_note",
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

    run_job(job_id, "trace-dirty-amount-note")
    run = _latest_run(job_id)
    assert run.status == "succeeded"
    written = mock_write.call_args[0][1]
    assert written[0]["amount"] is None
    assert written[0]["note"] == "默认备注"
```

- [ ] **Step 3: 运行 ETL-001 验证**

Run: `cd backend && ruff check ../tests/test_etl_rules.py ../tests/test_sync_executor.py && python3 -m pytest ../tests/test_etl_rules.py ../tests/test_sync_executor.py -v`
Expected: PASS

- [ ] **Step 4: Commit**

```bash
git add tests/test_etl_rules.py tests/test_sync_executor.py
git commit -m "test(ETL-001): rule type edges + executor apply_rules failure isolation"
```

---

### Task 5: DATA-003 — ingestion Admin FE smoke

**Files:**
- Modify: `fe/src/pages/admin/ingestion/ingestion.smoke.test.tsx`（追加 T-ING-32~35）

**Skills:**
- Read `.agents/skills/b-design-system-tailadmin-radix/SKILL.md`
- Read `.agents/skills/test-driven-development/SKILL.md`

**UI Acceptance:**
- 复用 `Skeleton`、`Button`、`AlertDialog`、`Badge` 等 `@/components/ui/*` 组件；遵守 design.md §8 Token 与密度
- desktop（1400）与 mobile（375）截图无明显错位、重叠、文本溢出、空白失衡
- loading skeleton、error 401、run 确认后 disabled 等状态有断言覆盖
- `pnpm run check:design` 全绿；无硬编码 hex

- [ ] **Step 1: 追加 T-ING-32~35 到 `ingestion.smoke.test.tsx`**

在 `describe("ingestion admin smoke")` 闭合 `});` 之前（最后一个 `it` 之后）追加：

```tsx
  it("SyncJobHistoryPage_failed_row_shows_error_message (T-ING-32)", async () => {
    setViewport(1400);
    mockApiFetch.mockResolvedValueOnce({
      items: [
        {
          id: "run-fail",
          status: "failed",
          started_at: "2026-07-03T10:00:00Z",
          finished_at: "2026-07-03T10:00:02Z",
          rows_synced: null,
          error_message: "连接失败",
          trace_id: "trace-fail-32",
          retry_count: 1,
        },
      ],
    });
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
    expect(await screen.findByText("连接失败")).toBeInTheDocument();
  });

  it("SyncJobsPage_list_shows_skeleton_while_loading (T-ING-33)", async () => {
    setViewport(1400);
    let resolveList: (value: { items: unknown[] }) => void;
    const listPromise = new Promise<{ items: unknown[] }>((r) => {
      resolveList = r;
    });
    mockApiFetch.mockImplementationOnce(() => listPromise);
    render(
      <MemoryRouter initialEntries={["/admin/ingestion/sync-jobs"]}>
        <Routes>
          <Route path="/admin/ingestion/sync-jobs" element={<SyncJobsPage />} />
        </Routes>
      </MemoryRouter>,
    );
    const skeletons = document.querySelectorAll(
      '[class*="skeleton"], [data-slot="skeleton"], [class*="animate-pulse"]',
    );
    expect(skeletons.length).toBeGreaterThanOrEqual(1);
    resolveList!({ items: [] });
    expect(await screen.findByText("暂无同步任务")).toBeInTheDocument();
  });

  it("EtlRulesPage_save_401_shows_error_no_success (T-ING-34)", async () => {
    setViewport(375);
    mockApiFetch
      .mockResolvedValueOnce({
        rules: [{ type: "rename_column", from: "a", to: "b" }],
      })
      .mockRejectedValueOnce(new Error("未授权"));
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
    await screen.findByRole("button", { name: "保存规则" });
    fireEvent.click(screen.getByRole("button", { name: "保存规则" }));
    expect(await screen.findByText("未授权")).toBeInTheDocument();
    expect(screen.queryByText("已保存")).not.toBeInTheDocument();
  });

  it("SyncJobsPage_run_dialog_confirm_disables_controls_pending (T-ING-35)", async () => {
    setViewport(1400);
    let resolveRun: () => void;
    const runPromise = new Promise<void>((r) => {
      resolveRun = r;
    });
    mockApiFetch
      .mockResolvedValueOnce({
        items: [
          {
            id: "job-dialog-pending",
            name: "dialog-pending",
            source_type: "mysql",
            target_table: "t",
            enabled: true,
            schedule_cron: null,
          },
        ],
      })
      .mockImplementationOnce(() => runPromise);
    render(
      <MemoryRouter initialEntries={["/admin/ingestion/sync-jobs"]}>
        <Routes>
          <Route path="/admin/ingestion/sync-jobs" element={<SyncJobsPage />} />
        </Routes>
      </MemoryRouter>,
    );
    fireEvent.click(await screen.findByRole("button", { name: "手动运行同步" }));
    const dialog = await screen.findByRole("alertdialog");
    const runBtn = within(dialog).getByRole("button", { name: "运行" });
    fireEvent.click(runBtn);
    await waitFor(() => {
      expect(runBtn).toBeDisabled();
    });
    const cancelBtn = within(dialog).getByRole("button", { name: "取消" });
    expect(cancelBtn).toBeDisabled();
    resolveRun!();
  });
```

- [ ] **Step 2: 运行 FE 验证**

Run: `cd fe && pnpm test && pnpm build && pnpm run check:design`
Expected: vitest 全绿；ingestion.smoke ≥35 项；全仓 vitest ≥68

- [ ] **Step 3: 全量回归**

Run: `cd backend && ruff check . && python3 -m pytest -v`
Expected: ≥258 passed（2 skipped 保持）

- [ ] **Step 4: Commit**

```bash
git add fe/src/pages/admin/ingestion/ingestion.smoke.test.tsx
git commit -m "test(DATA-003): ingestion FE smoke for error_message, skeleton, 401, run disabled"
```

---

## 全量验收（P4 等价）

```bash
cd backend && ruff check . && python3 -m pytest -v
cd fe && pnpm install --frozen-lockfile && pnpm test && pnpm build && pnpm run check:design
```

**预期计数：** backend pytest **≥258 passed**（2 skipped 保持）；fe vitest **≥68**；node:test **≥4**；`test_ruff_contract.py` T-RUF-01~02 保持绿。

## Spec self-review

| 检查项 | 结果 |
|--------|------|
| 覆盖 round-target 五项 | Task 1~5 一一对应 |
| 无 TBD/TODO/适当处理 | 通过 |
| 每 Task 含验证命令 | 通过 |
| DATA-003 含 UI skill + UI Acceptance | 通过 |
| 预估文件数 9 ≤ 20 | 通过 |
| 不重复 r13/r14/r15 用例编号 | 通过 |

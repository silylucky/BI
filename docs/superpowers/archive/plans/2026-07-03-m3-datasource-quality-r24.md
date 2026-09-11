# M3 数据源平台 quality push r24 实现计划

> **执行模式：** subagent-driven-development (option 1)
> **范围框定：** `backend/app/datasources/`、`backend/app/api/v1/datasources.py`、`backend/migrations/versions/0010_datasources_connection_options.py`、`tests/test_datasources_quality_r24.py`、`tests/test_migrations.py`、`docs/api/README.md`、`docs/services/datasources.md`
> **子项：** CONN-001, DS-001, DS-002, DS-003, DS-005
> **项目技能：** `.agents/skills/`（P3 按 Files 按需 Read；plan 预指定 **Skills:**）
> **项目规则：** `.cursor/rules/`（alwaysApply 自动注入；触及 `backend/**/*.py` 时 P3 动态匹配 `backend-fastapi.mdc`）

**Goal:** M3 数据源质量推分 r24 — MySQL 方言完整度（collation/分层 timeout/结构化 `code`）、注册表并发安全、CRUD `connectionOptions` 持久化与软删 code 复用、连通测试 inflight release、Fernet 双钥轮换占位；约 30 项 `test_datasources_quality_r24.py` smoke + r23/L1 回归全绿。

**Architecture:** 延续 r22/r23 分层 — entry 薄、`service.py` 编排、`dialects`/`registry`/`credentials` domain；新增 `ConnectionOptions` Pydantic 模型与 ORM JSON 列；Alembic `0010` 调整 code 唯一约束；测试延续 sqlite shared memory + `patch("app.datasources.dialects.mysql.pymysql.connect")`。

**Tech Stack:** FastAPI · SQLAlchemy 2.x · Alembic · Pydantic v2 · pymysql · cryptography(Fernet) · pytest · ruff

## Global Constraints

- 纯后端质量推分；**不修改** `fe/`、`main.py`；**全 Task UI skill: none**
- 不修改 `docs/automate/goal.md` / `plan.md` 结构
- 不含 DS-004/006/007/008、CONN-002、Admin UI、ingestion 实现改动、`core/config.py` 强制改动
- 错误体：`{"code": "<SNAKE>", "message": "...", "detail": ...}`；OpenAPI **仅 additive** 字段
- 连通测试 HTTP 恒 200 + `ok` 字段（资源不存在 404 仅 `/{id}/test`）
- `CREDENTIAL_FERNET_KEY_PREVIOUS` 经 `os.getenv` 读取，不改 `Settings`
- 文件预算：新建 **2** + 修改 **12** + 文档 **2** = **16 ≤ 20**
- 验证基线：r23 `pytest` **449 passed** + 4 skipped；本轮目标 ≥479 passed
- 验证命令：`cd backend && python3 -m ruff check . && python3 -m pytest -v`

---

### Task 1: MySQL 方言结构化错误码与连接选项透传（CONN-001）

**Files:**
- Modify: `backend/app/datasources/dialects/base.py`
- Modify: `backend/app/datasources/dialects/errors.py`
- Modify: `backend/app/datasources/dialects/mysql.py`
- Test: `tests/test_datasources_quality_r24.py`（CONN 段，Step 1 先写失败测试）

**Skills:**
- Read `.agents/skills/test-driven-development/SKILL.md`
- Read `.agents/skills/fastapi/SKILL.md`
- Read `.agents/skills/bug-case-library/SKILL.md`

**UI skill:** none

**Interfaces:**
- Consumes: `pymysql.err.OperationalError`, `get_settings()`
- Produces: `TestConnectionResult(ok, message, latency_ms, code)`, `MYSQL_UNKNOWN_DATABASE`, `map_mysql_operational_error() -> tuple[str, str]`, `MysqlConnector.test_connection(..., charset, collation, ssl_mode, connect_timeout_sec, read_timeout_sec)`

- [ ] **Step 1: 在 `tests/test_datasources_quality_r24.py` 写入 CONN 失败测试（文件其余段后续 Task 追加）**

```python
from __future__ import annotations

import time
from unittest.mock import MagicMock, patch

import pymysql.err
import pytest

from app.datasources.dialects.errors import MYSQL_SSL_ERROR, MYSQL_UNKNOWN_DATABASE
from app.datasources.dialects.mysql import MysqlConnector


@patch("app.datasources.dialects.mysql.pymysql.connect")
def test_mysql_collation_sets_init_command(mock_connect):
    """T-CONN-M11: collation=utf8mb4_unicode_ci → init_command SET NAMES。"""
    mock_connect.return_value = MagicMock()
    MysqlConnector().test_connection(
        host="h",
        port=3306,
        database="d",
        username="u",
        password="p",
        charset="utf8mb4",
        collation="utf8mb4_unicode_ci",
    )
    kwargs = mock_connect.call_args.kwargs
    assert kwargs.get("init_command") == "SET NAMES utf8mb4 COLLATE utf8mb4_unicode_ci"


@patch("app.datasources.dialects.mysql.pymysql.connect")
def test_mysql_layered_timeouts(mock_connect):
    """T-CONN-M12: connect_timeout_sec=3, read_timeout_sec=10。"""
    mock_connect.return_value = MagicMock()
    MysqlConnector().test_connection(
        host="h",
        port=3306,
        database="d",
        username="u",
        password="p",
        connect_timeout_sec=3.0,
        read_timeout_sec=10.0,
    )
    kwargs = mock_connect.call_args.kwargs
    assert kwargs["connect_timeout"] == 3
    assert kwargs["read_timeout"] == 10


@patch("app.datasources.dialects.mysql.pymysql.connect")
def test_mysql_ssl_preferred_omits_ssl_kwarg(mock_connect):
    """T-CONN-M13: ssl_mode=preferred 不传 ssl。"""
    mock_connect.return_value = MagicMock()
    MysqlConnector().test_connection(
        host="h", port=3306, database="d", username="u", password="p", ssl_mode="preferred",
    )
    assert "ssl" not in mock_connect.call_args.kwargs


@patch("app.datasources.dialects.mysql.pymysql.connect")
def test_mysql_errno_1049_maps_unknown_database(mock_connect):
    """T-CONN-M14: errno 1049 → code MYSQL_UNKNOWN_DATABASE。"""
    mock_connect.side_effect = pymysql.err.OperationalError(1049, "Unknown database 'missing'")
    result = MysqlConnector().test_connection(
        host="h", port=3306, database="missing", username="u", password="p",
    )
    assert result.ok is False
    assert result.code == MYSQL_UNKNOWN_DATABASE
    assert MYSQL_UNKNOWN_DATABASE in result.message


@patch("app.datasources.dialects.mysql.pymysql.connect")
def test_mysql_ssl_handshake_maps_ssl_error(mock_connect):
    """T-CONN-M15: SSL 握手失败 → MYSQL_SSL_ERROR。"""
    mock_connect.side_effect = pymysql.err.OperationalError(2026, "SSL connection error")
    result = MysqlConnector().test_connection(
        host="h", port=3306, database="d", username="u", password="p", ssl_mode="required",
    )
    assert result.code == MYSQL_SSL_ERROR


@patch("app.datasources.dialects.mysql.pymysql.connect")
def test_mysql_success_has_no_code(mock_connect):
    """T-CONN-M16: 成功 ok=True, code is None。"""
    mock_connect.return_value = MagicMock()
    result = MysqlConnector().test_connection(
        host="h", port=3306, database="d", username="u", password="p",
    )
    assert result.ok is True
    assert result.code is None
    assert result.latency_ms is not None
```

- [ ] **Step 2: 运行 CONN 测试确认失败**

Run: `cd backend && python3 -m pytest ../tests/test_datasources_quality_r24.py -k "CONN or mysql_" -v`
Expected: FAIL — `TestConnectionResult` 无 `code` 字段；`mysql.py` 无 `collation`/`connect_timeout_sec` 参数

- [ ] **Step 3: 修改 `backend/app/datasources/dialects/base.py`**

```python
@dataclass(frozen=True)
class TestConnectionResult:
    ok: bool
    message: str
    latency_ms: int | None
    code: str | None = None
```

- [ ] **Step 4: 修改 `backend/app/datasources/dialects/errors.py`**

```python
MYSQL_UNKNOWN_DATABASE = "MYSQL_UNKNOWN_DATABASE"

_CODE_MAP: dict[int, str] = {
    2003: MYSQL_CONN_REFUSED,
    1045: MYSQL_AUTH_FAILED,
    2013: MYSQL_TIMEOUT,
    1049: MYSQL_UNKNOWN_DATABASE,
}


def map_mysql_operational_error(exc: pymysql.err.OperationalError) -> tuple[str, str]:
    errno = int(exc.args[0]) if exc.args else 0
    detail = str(exc.args[1]) if len(exc.args) > 1 else str(exc)
    if errno == 2026:
        return MYSQL_SSL_ERROR, detail
    code = _CODE_MAP.get(errno, MYSQL_UNKNOWN)
    if "ssl" in detail.lower():
        code = MYSQL_SSL_ERROR
    return code, detail
```

- [ ] **Step 5: 修改 `backend/app/datasources/dialects/mysql.py`**

```python
import re

_COLLATION_RE = re.compile(r"^[\w-]+$")


def _collation_init_command(charset: str, collation: str | None) -> str | None:
    if collation is None:
        return None
    if not _COLLATION_RE.match(charset) or not _COLLATION_RE.match(collation):
        raise ValueError(f"invalid charset/collation: {charset}/{collation}")
    return f"SET NAMES {charset} COLLATE {collation}"


class MysqlConnector:
    # ... existing properties ...

    def test_connection(
        self,
        *,
        host: str,
        port: int,
        database: str,
        username: str,
        password: str,
        timeout_sec: float = 5.0,
        charset: str = "utf8mb4",
        collation: str | None = None,
        ssl_mode: Literal["disabled", "preferred", "required"] = "preferred",
        connect_timeout_sec: float | None = None,
        read_timeout_sec: float | None = None,
    ) -> TestConnectionResult:
        if ssl_mode not in _SSL_MODES:
            raise ValueError(f"invalid ssl_mode: {ssl_mode}")
        settings = get_settings()
        connect_raw = connect_timeout_sec if connect_timeout_sec is not None else timeout_sec
        clamped_connect = max(1.0, min(float(connect_raw), float(min(30, settings.query_timeout_seconds))))
        connect_timeout = int(clamped_connect)
        read_raw = read_timeout_sec if read_timeout_sec is not None else clamped_connect
        clamped_read = max(1.0, min(float(read_raw), float(min(30, settings.query_timeout_seconds))))
        read_timeout = int(clamped_read)
        connect_kwargs: dict = {
            "host": host,
            "port": port,
            "user": username,
            "password": password,
            "database": database,
            "charset": charset,
            "connect_timeout": connect_timeout,
            "read_timeout": read_timeout,
            "write_timeout": connect_timeout,
        }
        init_cmd = _collation_init_command(charset, collation)
        if init_cmd:
            connect_kwargs["init_command"] = init_cmd
        if ssl_mode == "required":
            connect_kwargs["ssl"] = {"ssl": {}}
        elif ssl_mode == "disabled":
            connect_kwargs["ssl"] = None
        started = time.perf_counter()
        try:
            connection = pymysql.connect(**connect_kwargs)
            try:
                connection.ping(reconnect=False)
            finally:
                connection.close()
        except pymysql.err.OperationalError as exc:
            code, detail = map_mysql_operational_error(exc)
            latency_ms = int((time.perf_counter() - started) * 1000)
            return TestConnectionResult(
                ok=False,
                message=f"[{code}] {detail}",
                latency_ms=latency_ms,
                code=code,
            )
        except Exception as exc:
            latency_ms = int((time.perf_counter() - started) * 1000)
            return TestConnectionResult(ok=False, message=str(exc), latency_ms=latency_ms, code=None)
        latency_ms = int((time.perf_counter() - started) * 1000)
        return TestConnectionResult(ok=True, message="Connection successful", latency_ms=latency_ms, code=None)
```

- [ ] **Step 6: 运行 CONN 测试确认通过**

Run: `cd backend && python3 -m pytest ../tests/test_datasources_quality_r24.py -k "CONN or mysql_" -v`
Expected: **6 passed**

- [ ] **Step 7: r23 CONN 回归**

Run: `cd backend && python3 -m pytest ../tests/test_datasources_quality_r23.py -k "CONN or mysql_" -v`
Expected: 全绿（`message` 仍含 `[CODE]` 前缀）

- [ ] **Step 8: Commit**

```bash
git add backend/app/datasources/dialects/base.py backend/app/datasources/dialects/errors.py backend/app/datasources/dialects/mysql.py tests/test_datasources_quality_r24.py
git commit -m "feat(datasources): CONN-001 mysql collation, layered timeout, structured code"
```

---

### Task 2: ConnectorRegistry 线程安全与类型目录导出（DS-001）

**Files:**
- Modify: `backend/app/datasources/registry.py`
- Test: `tests/test_datasources_quality_r24.py`（DS-001 段）

**Skills:**
- Read `.agents/skills/test-driven-development/SKILL.md`

**UI skill:** none

**Interfaces:**
- Consumes: `DialectConnector`, `ConnectorDescriptor`
- Produces: `ConnectorRegistry`（`threading.RLock` 保护）、`export_type_catalog() -> list[dict]`

- [ ] **Step 1: 追加 DS-001 失败测试**

```python
import threading

from app.datasources import register_builtin_dialects
from app.datasources.dialects.base import TestConnectionResult
from app.datasources.registry import (
    ConnectorAlreadyRegisteredError,
    ConnectorRegistry,
    export_type_catalog,
    registry,
    register_dialect,
    unregister,
)


class _StubConnector:
    def __init__(self, type: str) -> None:
        self._type = type

    @property
    def type(self) -> str:
        return self._type

    @property
    def category(self) -> str:
        return "stub"

    @property
    def capabilities(self) -> tuple[str, ...]:
        return ("connectivity_test",)

    def test_connection(self, **kwargs) -> TestConnectionResult:
        return TestConnectionResult(ok=True, message="ok", latency_ms=0)


def test_concurrent_register_unregister_stub_connectors():
    """T-DS-R09: 10 线程交替 register/unregister stub，最终含 mysql。"""
    registry._connectors.clear()
    register_builtin_dialects()
    errors: list[Exception] = []

    def worker(i: int) -> None:
        name = f"stub_{i % 3}"
        try:
            if name in registry._connectors:
                unregister(name)
            else:
                register_dialect(_StubConnector(name))
        except Exception as exc:
            errors.append(exc)

    threads = [threading.Thread(target=worker, args=(i,)) for i in range(10)]
    for t in threads:
        t.start()
    for t in threads:
        t.join()
    assert not errors
    types = {item.type for item in registry.list_types()}
    assert "mysql" in types


def test_duplicate_register_raises():
    """T-DS-R10: 重复 register 同 type → ConnectorAlreadyRegisteredError。"""
    registry._connectors.clear()
    register_dialect(_StubConnector("dup_test"))
    with pytest.raises(ConnectorAlreadyRegisteredError):
        register_dialect(_StubConnector("dup_test"))


def test_export_type_catalog_matches_list_types():
    """T-DS-R11: export_type_catalog 与 list_types 一致。"""
    registry._connectors.clear()
    register_builtin_dialects()
    catalog = export_type_catalog()
    listed = registry.list_types()
    assert len(catalog) == len(listed)
    for entry, desc in zip(catalog, listed, strict=True):
        assert entry["type"] == desc.type
        assert entry["category"] == desc.category
        assert entry["capabilities"] == list(desc.capabilities)


def test_ingestion_mysql_type_in_catalog():
    """T-DS-R12: mysql ∈ catalog；postgres 未注册为已知差距（CONN-002）。"""
    registry._connectors.clear()
    register_builtin_dialects()
    types = {entry["type"] for entry in export_type_catalog()}
    assert "mysql" in types
    assert "postgres" not in types  # CONN-002 待实现
```

- [ ] **Step 2: 运行 DS-001 测试确认失败**

Run: `cd backend && python3 -m pytest ../tests/test_datasources_quality_r24.py -k "R09 or R10 or R11 or R12 or concurrent_register" -v`
Expected: FAIL — `export_type_catalog` 未定义；并发可能偶发脏状态

- [ ] **Step 3: 修改 `backend/app/datasources/registry.py`**

```python
import threading


class ConnectorRegistry:
    def __init__(self) -> None:
        self._connectors: dict[str, DialectConnector] = {}
        self._lock = threading.RLock()

    def register(self, connector: DialectConnector) -> None:
        with self._lock:
            if connector.type in self._connectors:
                raise ConnectorAlreadyRegisteredError(
                    f"connector type already registered: {connector.type}"
                )
            self._connectors[connector.type] = connector

    def get(self, type: str) -> DialectConnector:
        with self._lock:
            try:
                return self._connectors[type]
            except KeyError as exc:
                raise ConnectorNotFoundError(type) from exc

    def list_types(self) -> list[ConnectorDescriptor]:
        with self._lock:
            return [
                ConnectorDescriptor(
                    type=c.type,
                    category=c.category,
                    capabilities=c.capabilities,
                )
                for c in self._connectors.values()
            ]


def unregister(type: str) -> None:
    with registry._lock:
        if type not in registry._connectors:
            raise ConnectorNotFoundError(type)
        if any(checker(type) for checker in _usage_checkers):
            raise ConnectorInUseError(f"connector type in use: {type}")
        del registry._connectors[type]


def export_type_catalog() -> list[dict]:
    return [
        {
            "type": item.type,
            "category": item.category,
            "capabilities": list(item.capabilities),
        }
        for item in registry.list_types()
    ]
```

- [ ] **Step 4: 运行 DS-001 测试确认通过**

Run: `cd backend && python3 -m pytest ../tests/test_datasources_quality_r24.py -k "R09 or R10 or R11 or R12 or concurrent_register" -v`
Expected: **4 passed**

- [ ] **Step 5: r23 DS-001 回归**

Run: `cd backend && python3 -m pytest ../tests/test_datasources_quality_r23.py -k "unregister or R05 or R06 or R07 or R08" -v`
Expected: 全绿

- [ ] **Step 6: Commit**

```bash
git add backend/app/datasources/registry.py tests/test_datasources_quality_r24.py
git commit -m "feat(datasources): DS-001 registry RLock and export_type_catalog"
```

---

### Task 3: Fernet 双钥轮换占位（DS-005）

**Files:**
- Modify: `backend/app/datasources/credentials.py`
- Test: `tests/test_datasources_quality_r24.py`（DS-005 段）

**Skills:**
- Read `.agents/skills/test-driven-development/SKILL.md`
- Read `.agents/skills/bug-case-library/SKILL.md`

**UI skill:** none

**Interfaces:**
- Consumes: `CREDENTIAL_FERNET_KEY`（Settings）、`CREDENTIAL_FERNET_KEY_PREVIOUS`（`os.getenv`）
- Produces: `decrypt_credential()` 双钥尝试路径

- [ ] **Step 1: 追加 DS-005 失败测试**

```python
import logging
import os

from app.core.config import get_settings
from app.datasources.credentials import CredentialDecryptError, decrypt_credential, encrypt_credential
from app.datasources.schemas import DataSourceCreate
from app.datasources.service import create_data_source
from app.datasources.models import get_meta_session
from cryptography.fernet import Fernet


def test_decrypt_with_previous_key_roundtrip(monkeypatch):
    """T-DS-K09: PREVIOUS key 可解密旧密文。"""
    old_key = Fernet.generate_key().decode()
    new_key = Fernet.generate_key().decode()
    plain = "rotate-me"
    cipher = Fernet(old_key.encode()).encrypt(plain.encode()).decode()
    monkeypatch.setenv("CREDENTIAL_FERNET_KEY", new_key)
    monkeypatch.setenv("CREDENTIAL_FERNET_KEY_PREVIOUS", old_key)
    get_settings.cache_clear()
    assert decrypt_credential(cipher) == plain


def test_decrypt_both_keys_fail_raises(monkeypatch):
    """T-DS-K10: 双钥均失败 → CredentialDecryptError。"""
    monkeypatch.setenv("CREDENTIAL_FERNET_KEY", Fernet.generate_key().decode())
    monkeypatch.setenv("CREDENTIAL_FERNET_KEY_PREVIOUS", Fernet.generate_key().decode())
    get_settings.cache_clear()
    with pytest.raises(CredentialDecryptError):
        decrypt_credential("not-valid-fernet-token")


def test_settings_fails_without_credential_fernet_key(monkeypatch):
    """T-DS-K11: 缺 CREDENTIAL_FERNET_KEY → Settings 构造失败。"""
    monkeypatch.delenv("CREDENTIAL_FERNET_KEY", raising=False)
    get_settings.cache_clear()
    with pytest.raises(Exception):
        get_settings()


def test_test_failure_path_logs_no_secrets(caplog, client, auth_headers):
    """T-DS-K12: test 失败路径 caplog 无 password 明文与完整 cipher。"""
    caplog.set_level(logging.INFO)
    created = client.post(
        "/api/v1/datasources",
        json={
            "name": "Log DS",
            "code": "log_ds",
            "type": "mysql",
            "host": "127.0.0.1",
            "port": 3306,
            "database": "demo",
            "username": "root",
            "password": "plain-secret",
        },
        headers=auth_headers,
    )
    ds_id = created.json()["id"]
    session = get_meta_session()
    row = session.get(__import__("app.datasources.models", fromlist=["DataSource"]).DataSource, __import__("uuid").UUID(ds_id))
    cipher = row.password_encrypted
    row.password_encrypted = "corrupt-cipher"
    session.commit()
    session.close()
    with patch("app.datasources.dialects.mysql.pymysql.connect") as mock_connect:
        mock_connect.side_effect = pymysql.err.OperationalError(2003, "refused")
        client.post(f"/api/v1/datasources/{ds_id}/test", headers=auth_headers)
    assert "plain-secret" not in caplog.text
    assert "password=" not in caplog.text.lower()
    assert cipher not in caplog.text
```

- [ ] **Step 2: 运行 DS-005 测试确认失败**

Run: `cd backend && python3 -m pytest ../tests/test_datasources_quality_r24.py -k "K09 or K10 or K11 or K12" -v`
Expected: FAIL — `decrypt_credential` 不尝试 previous key

- [ ] **Step 3: 修改 `backend/app/datasources/credentials.py`**

```python
import os

from cryptography.fernet import Fernet, InvalidToken

from app.core.config import get_settings


def _fernet_for_key(key: str) -> Fernet:
    return Fernet(key.encode())


def _candidate_keys() -> list[str]:
    keys = [get_settings().credential_fernet_key]
    previous = os.getenv("CREDENTIAL_FERNET_KEY_PREVIOUS")
    if previous:
        keys.append(previous)
    return keys


def encrypt_credential(plain: str) -> str:
    return _fernet_for_key(get_settings().credential_fernet_key).encrypt(plain.encode()).decode()


def decrypt_credential(cipher: str) -> str:
    last_error: InvalidToken | None = None
    for key in _candidate_keys():
        try:
            return _fernet_for_key(key).decrypt(cipher.encode()).decode()
        except InvalidToken as exc:
            last_error = exc
    raise CredentialDecryptError() from last_error
```

- [ ] **Step 4: 运行 DS-005 测试确认通过**

Run: `cd backend && python3 -m pytest ../tests/test_datasources_quality_r24.py -k "K09 or K10 or K11 or K12" -v`
Expected: **4 passed**

- [ ] **Step 5: r23 DS-005 回归**

Run: `cd backend && python3 -m pytest ../tests/test_datasources_quality_r23.py -k "K05 or K06 or K07 or K08" -v`
Expected: 全绿

- [ ] **Step 6: Commit**

```bash
git add backend/app/datasources/credentials.py tests/test_datasources_quality_r24.py
git commit -m "feat(datasources): DS-005 Fernet previous key rotation placeholder"
```

---

### Task 4: ConnectionOptions 模型、ORM 与迁移 0010（DS-002 数据层）

**Files:**
- Modify: `backend/app/datasources/schemas.py`
- Modify: `backend/app/datasources/models.py`
- Create: `backend/migrations/versions/0010_datasources_connection_options.py`
- Test: `tests/test_datasources_quality_r24.py`（schemas 单元段）

**Skills:**
- Read `.agents/skills/test-driven-development/SKILL.md`
- Read `.agents/skills/fastapi/SKILL.md`

**UI skill:** none

**Interfaces:**
- Produces: `ConnectionOptions`, `DataSourceOut.connection_options`, `DataSource.connection_options` JSON 列、Alembic revision `0010`

- [ ] **Step 1: 追加 schemas 失败测试**

```python
from app.datasources.schemas import ConnectionOptions, DataSourceCreate


def test_connection_options_defaults():
  opts = ConnectionOptions()
  assert opts.charset == "utf8mb4"
  assert opts.ssl_mode == "preferred"
  assert opts.connect_timeout_sec == 5.0


def test_datasource_create_accepts_connection_options():
  payload = DataSourceCreate(
      name="Opts DS",
      code="opts_ds",
      type="mysql",
      host="127.0.0.1",
      port=3306,
      database="demo",
      username="root",
      password="secret",
      connection_options=ConnectionOptions(ssl_mode="required", connect_timeout_sec=3.0),
  )
  assert payload.connection_options is not None
  assert payload.connection_options.ssl_mode == "required"
```

- [ ] **Step 2: 运行 schemas 测试确认失败**

Run: `cd backend && python3 -m pytest ../tests/test_datasources_quality_r24.py -k "connection_options" -v`
Expected: FAIL — `ConnectionOptions` 未定义

- [ ] **Step 3: 修改 `backend/app/datasources/schemas.py`**

```python
from typing import Literal


class ConnectionOptions(BaseModel):
    charset: str = "utf8mb4"
    collation: str | None = None
    ssl_mode: Literal["disabled", "preferred", "required"] = "preferred"
    connect_timeout_sec: float = Field(default=5.0, ge=1.0, le=30.0)
    read_timeout_sec: float | None = None

    model_config = {"populate_by_name": True}


class DataSourceCreate(BaseModel):
    # ... existing fields ...
    connection_options: ConnectionOptions | None = Field(default=None, serialization_alias="connectionOptions")

    model_config = {"populate_by_name": True}


class DataSourceUpdate(BaseModel):
    # ... existing fields ...
    connection_options: ConnectionOptions | None = Field(default=None, serialization_alias="connectionOptions")

    model_config = {"populate_by_name": True}


class DataSourcePatch(BaseModel):
    # ... existing fields ...
    connection_options: ConnectionOptions | None = Field(default=None, serialization_alias="connectionOptions")

    model_config = {"populate_by_name": True}


class DataSourceOut(BaseModel):
    # ... existing fields ...
    connection_options: ConnectionOptions | None = Field(default=None, serialization_alias="connectionOptions")

    model_config = {"populate_by_name": True}


class TestConnectionOut(BaseModel):
    ok: bool
    message: str
    latency_ms: int | None = Field(serialization_alias="latencyMs")
    trace_id: str | None = Field(default=None, serialization_alias="traceId")
    code: str | None = None

    model_config = {"populate_by_name": True}

    @classmethod
    def from_result(cls, result: TestConnectionResult, *, trace_id: str | None = None) -> TestConnectionOut:
        return cls(
            ok=result.ok,
            message=result.message,
            latency_ms=result.latency_ms,
            trace_id=trace_id,
            code=result.code,
        )
```

- [ ] **Step 4: 修改 `backend/app/datasources/models.py`**

```python
from sqlalchemy import JSON, DateTime, Integer, String, Text, Uuid, create_engine, func

class DataSource(Base):
    # ... existing columns ...
    connection_options: Mapped[dict | None] = mapped_column(JSON, nullable=True)
```

- [ ] **Step 5: 创建 `backend/migrations/versions/0010_datasources_connection_options.py`**

```python
"""data_sources connection_options and active code uniqueness

Revision ID: 0010
Revises: 0009
"""

from typing import Sequence, Union

import sqlalchemy as sa
from alembic import op

revision: str = "0010"
down_revision: Union[str, None] = "0009"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.add_column(
        "data_sources",
        sa.Column("connection_options", sa.JSON(), nullable=True),
    )
    with op.batch_alter_table("data_sources") as batch_op:
        batch_op.drop_constraint("data_sources_code_key", type_="unique")
    bind = op.get_bind()
    if bind.dialect.name == "postgresql":
        op.create_index(
            "uq_data_sources_code_active",
            "data_sources",
            ["code"],
            unique=True,
            postgresql_where=sa.text("deleted_at IS NULL"),
        )


def downgrade() -> None:
    bind = op.get_bind()
    if bind.dialect.name == "postgresql":
        op.drop_index("uq_data_sources_code_active", table_name="data_sources")
    with op.batch_alter_table("data_sources") as batch_op:
        batch_op.create_unique_constraint("data_sources_code_key", ["code"])
    op.drop_column("data_sources", "connection_options")
```

- [ ] **Step 6: 运行 schemas 测试确认通过**

Run: `cd backend && python3 -m pytest ../tests/test_datasources_quality_r24.py -k "connection_options" -v`
Expected: **2 passed**

- [ ] **Step 7: Commit**

```bash
git add backend/app/datasources/schemas.py backend/app/datasources/models.py backend/migrations/versions/0010_datasources_connection_options.py tests/test_datasources_quality_r24.py
git commit -m "feat(datasources): DS-002 ConnectionOptions schema, ORM JSON, migration 0010"
```

---

### Task 5: Service 层 CRUD、列表性能与连通测试（DS-002 + DS-003）

**Files:**
- Modify: `backend/app/datasources/service.py`
- Test: `tests/test_datasources_quality_r24.py`（CRUD + test 段；复用 r23 fixtures 模式）

**Skills:**
- Read `.agents/skills/fastapi/SKILL.md`
- Read `.agents/skills/test-driven-development/SKILL.md`

**UI skill:** none

**Interfaces:**
- Consumes: `ConnectionOptions`, `TestConnectionResult.code`, `registry`, `decrypt_credential`
- Produces: `_resolve_connection_options()`, `_release_test_slot()`, 优化 `list_data_sources` count、create/patch 持久化 options、`_run_test` 分层 timeout + 日志

- [ ] **Step 1: 在 `tests/test_datasources_quality_r24.py` 追加模块级 fixtures（与 r23 同模式）并写 CRUD/test 失败测试**

```python
import os
import uuid
from concurrent.futures import ThreadPoolExecutor

from fastapi.testclient import TestClient
from sqlalchemy import text

from app.main import app
from app.datasources.models import Base, DataSource, get_meta_engine, get_meta_session

_DS_SQLITE_URL = "sqlite+pysqlite:///file:ds_r24_test?mode=memory&cache=shared&uri=true"


@pytest.fixture(scope="module", autouse=True)
def ds_r24_sqlite_env():
    previous = os.environ.get("DATABASE_URL")
    os.environ["DATABASE_URL"] = _DS_SQLITE_URL
    get_settings.cache_clear()
    from app.auth.models import get_meta_engine as auth_get_meta_engine
    from app.datasources.models import get_meta_engine as ds_get_meta_engine

    ds_get_meta_engine.cache_clear()
    auth_get_meta_engine.cache_clear()
    yield
    if previous is None:
        os.environ.pop("DATABASE_URL", None)
    else:
        os.environ["DATABASE_URL"] = previous
    get_settings.cache_clear()
    ds_get_meta_engine.cache_clear()
    auth_get_meta_engine.cache_clear()


@pytest.fixture(scope="module", autouse=True)
def ensure_data_sources_table_r24():
    get_meta_engine.cache_clear()
    engine = get_meta_engine()
    Base.metadata.create_all(engine)
    yield
    with engine.begin() as conn:
        conn.execute(text("DELETE FROM data_sources"))


@pytest.fixture(autouse=True)
def clean_data_sources_r24():
    yield
    with get_meta_engine().begin() as conn:
        conn.execute(text("DELETE FROM data_sources"))


@pytest.fixture
def client() -> TestClient:
    return TestClient(app)


@pytest.fixture
def auth_headers() -> dict[str, str]:
    return {"Authorization": "Bearer dev"}


def _payload(**overrides) -> dict:
    base = {
        "name": "Demo MySQL",
        "code": "demo_mysql",
        "type": "mysql",
        "host": "127.0.0.1",
        "port": 3306,
        "database": "demo",
        "username": "root",
        "password": "plain-secret",
    }
    base.update(overrides)
    return base


def test_list_offset_beyond_total(client, auth_headers):
    """T-DS-C17: offset=9999 → items=[], total 不变。"""
    client.post("/api/v1/datasources", json=_payload(), headers=auth_headers)
    resp = client.get("/api/v1/datasources?offset=9999", headers=auth_headers)
    body = resp.json()
    assert body["items"] == []
    assert body["total"] >= 1
    assert body["offset"] == 9999


def test_soft_delete_code_reuse(client, auth_headers):
    """T-DS-C18: 软删后同 code 再 POST → 201。"""
    created = client.post("/api/v1/datasources", json=_payload(code="reuse_code"), headers=auth_headers)
    ds_id = created.json()["id"]
    assert client.delete(f"/api/v1/datasources/{ds_id}", headers=auth_headers).status_code == 204
    resp = client.post("/api/v1/datasources", json=_payload(code="reuse_code", name="Reused"), headers=auth_headers)
    assert resp.status_code == 201


def test_create_with_connection_options_echoed(client, auth_headers):
    """T-DS-C19: POST connectionOptions → GET 回显。"""
    payload = _payload(
        code="opts_echo",
        connectionOptions={"sslMode": "required", "connectTimeoutSec": 3.0},
    )
    created = client.post("/api/v1/datasources", json=payload, headers=auth_headers)
    assert created.status_code == 201
    body = created.json()
    assert body["connectionOptions"]["sslMode"] == "required"
    got = client.get(f"/api/v1/datasources/{body['id']}", headers=auth_headers)
    assert got.json()["connectionOptions"]["connectTimeoutSec"] == 3.0


def test_patch_connection_options_only(client, auth_headers):
    """T-DS-C20: PATCH 仅 connectionOptions.sslMode。"""
    created = client.post("/api/v1/datasources", json=_payload(code="patch_opts"), headers=auth_headers)
    ds_id = created.json()["id"]
    before_name = created.json()["name"]
    patched = client.patch(
        f"/api/v1/datasources/{ds_id}",
        json={"connectionOptions": {"sslMode": "disabled"}},
        headers=auth_headers,
    )
    assert patched.status_code == 200
    assert patched.json()["name"] == before_name
    assert patched.json()["connectionOptions"]["sslMode"] == "disabled"


def test_list_query_count_bounded(client, auth_headers, monkeypatch):
    """T-DS-C21: list 路径 DB execute/scalar 调用 ≤ 3。"""
    for i in range(3):
        client.post("/api/v1/datasources", json=_payload(code=f"cnt_{i}", name=f"C {i}"), headers=auth_headers)
    calls = {"n": 0}
    real_scalar = __import__("sqlalchemy.orm", fromlist=["Session"]).Session.scalar
    real_scalars = __import__("sqlalchemy.orm", fromlist=["Session"]).Session.scalars

    def counting_scalar(self, *args, **kwargs):
        calls["n"] += 1
        return real_scalar(self, *args, **kwargs)

    def counting_scalars(self, *args, **kwargs):
        calls["n"] += 1
        return real_scalars(self, *args, **kwargs)

    monkeypatch.setattr(__import__("sqlalchemy.orm", fromlist=["Session"]).Session, "scalar", counting_scalar)
    monkeypatch.setattr(__import__("sqlalchemy.orm", fromlist=["Session"]).Session, "scalars", counting_scalars)
    client.get("/api/v1/datasources?limit=2", headers=auth_headers)
    assert calls["n"] <= 3


def test_responses_exclude_encrypted_password(client, auth_headers):
    """T-DS-C22: 响应无 password_encrypted 与明文。"""
    created = client.post("/api/v1/datasources", json=_payload(code="no_cipher"), headers=auth_headers)
    assert "password_encrypted" not in created.text
    assert "plain-secret" not in created.text
    listed = client.get("/api/v1/datasources", headers=auth_headers)
    assert "password_encrypted" not in listed.text


@patch("app.datasources.dialects.mysql.pymysql.connect")
def test_failed_test_includes_code(mock_connect, client, auth_headers):
    """T-DS-T11: 失败含 code MYSQL_*。"""
    mock_connect.side_effect = pymysql.err.OperationalError(1045, "Access denied")
    resp = client.post("/api/v1/datasources/test", json=_payload(), headers=auth_headers)
    body = resp.json()
    assert body["ok"] is False
    assert body["code"] == "MYSQL_AUTH_FAILED"


@patch("app.datasources.dialects.mysql.pymysql.connect")
def test_back_to_back_test_without_waiting(mock_connect, client, auth_headers):
    """T-DS-T12: 连续两次 test 均 200（release 后）。"""
    mock_connect.return_value = MagicMock()
    created = client.post("/api/v1/datasources", json=_payload(code="dbl_test"), headers=auth_headers)
    ds_id = created.json()["id"]
    first = client.post(f"/api/v1/datasources/{ds_id}/test", headers=auth_headers)
    second = client.post(f"/api/v1/datasources/{ds_id}/test", headers=auth_headers)
    assert first.status_code == 200
    assert second.status_code == 200


@patch("app.datasources.dialects.mysql.pymysql.connect")
def test_concurrent_test_same_id(mock_connect, client, auth_headers):
    """T-DS-T13: 3 线程并行 test → 无 500。"""
    mock_connect.return_value = MagicMock()

    def slow(**kwargs):
        time.sleep(0.05)
        return MagicMock()

    mock_connect.side_effect = slow
    created = client.post("/api/v1/datasources", json=_payload(code="conc_test"), headers=auth_headers)
    ds_id = created.json()["id"]

    def run_test():
        return client.post(f"/api/v1/datasources/{ds_id}/test", headers=auth_headers).status_code

    with ThreadPoolExecutor(max_workers=3) as pool:
        codes = list(pool.map(lambda _: run_test(), range(3)))
    assert all(c in (200, 429) for c in codes)
    assert 500 not in codes


@patch("app.datasources.dialects.mysql.pymysql.connect")
def test_test_logs_trace_id(mock_connect, client, auth_headers, caplog):
    """T-DS-T14: caplog 含 traceId / datasource_test。"""
    import logging

    caplog.set_level(logging.INFO)
    mock_connect.side_effect = pymysql.err.OperationalError(2003, "refused")
    client.post("/api/v1/datasources/test", json=_payload(), headers=auth_headers)
    assert "datasource_test" in caplog.text or any("traceId" in str(r.__dict__) for r in caplog.records)


@patch("app.datasources.dialects.mysql.pymysql.connect")
def test_draft_test_passes_connection_options(mock_connect, client, auth_headers):
    """T-DS-T15: draft test 传 connectionOptions → connect kwargs。"""
    mock_connect.return_value = MagicMock()
    client.post(
        "/api/v1/datasources/test",
        json=_payload(connectionOptions={"sslMode": "required", "charset": "utf8mb4"}),
        headers=auth_headers,
    )
    kwargs = mock_connect.call_args.kwargs
    assert kwargs.get("ssl") == {"ssl": {}}
    assert kwargs["charset"] == "utf8mb4"
```

- [ ] **Step 2: 运行 CRUD/test 测试确认失败**

Run: `cd backend && python3 -m pytest ../tests/test_datasources_quality_r24.py -k "C17 or C18 or C19 or C20 or C21 or C22 or T11 or T12 or T13 or T14 or T15" -v`
Expected: 多数 FAIL

- [ ] **Step 3: 修改 `backend/app/datasources/service.py` 核心片段**

```python
import logging

from app.datasources.schemas import ConnectionOptions

logger = logging.getLogger("vitalspan.datasources")


def _connection_options_to_json(opts: ConnectionOptions | None) -> dict | None:
    if opts is None:
        return None
    return opts.model_dump(by_alias=False, exclude_none=True)


def _resolve_connection_options(
    *,
    row: DataSource | None = None,
    payload: ConnectionOptions | None = None,
) -> ConnectionOptions:
    if payload is not None:
        return payload
    if row is not None and row.connection_options:
        return ConnectionOptions.model_validate(row.connection_options)
    return ConnectionOptions()


def _to_out(row: DataSource) -> DataSourceOut:
    opts = None
    if row.connection_options is not None:
        opts = ConnectionOptions.model_validate(row.connection_options)
    return DataSourceOut(
        id=row.id,
        name=row.name,
        code=row.code,
        type=row.type,
        host=row.host,
        port=row.port,
        database=row.database,
        username=row.username,
        password="***",
        description=row.description,
        connection_options=opts,
    )


def _release_test_slot(key: str) -> None:
    with _test_lock:
        _test_inflight.pop(key, None)


def _acquire_test_slot(key: str) -> None:
    now = time.monotonic()
    with _test_lock:
        expired = [k for k, exp in _test_inflight.items() if exp <= now]
        for k in expired:
            del _test_inflight[k]
        expires = _test_inflight.get(key)
        if expires is not None and expires > now:
            raise DataSourceError("TEST_IN_PROGRESS", "Connection test already in progress", 429)
        _test_inflight[key] = now + _INFLIGHT_TTL_SEC


def _run_test(
    connector,
    *,
    host: str,
    port: int,
    database: str,
    username: str,
    password: str,
    options: ConnectionOptions | None = None,
    data_source_id: uuid.UUID | None = None,
) -> TestConnectionOut:
    opts = options or ConnectionOptions()
    result = connector.test_connection(
        host=host,
        port=port,
        database=database,
        username=username,
        password=password,
        timeout_sec=opts.connect_timeout_sec,
        charset=opts.charset,
        collation=opts.collation,
        ssl_mode=opts.ssl_mode,
        connect_timeout_sec=opts.connect_timeout_sec,
        read_timeout_sec=opts.read_timeout_sec,
    )
    trace = trace_id_var.get() or ""
    out = TestConnectionOut.from_result(result, trace_id=trace)
    extra: dict = {"traceId": trace, "ok": result.ok}
    if data_source_id is not None:
        extra["dataSourceId"] = str(data_source_id)
    logger.info("datasource_test", extra=extra)
    return out


def list_data_sources(...) -> DataSourceListResponse:
  # ... filters unchanged ...
  count_stmt = select(func.count()).select_from(DataSource)
  count_stmt = _active_filter(count_stmt)
  if type:
      count_stmt = count_stmt.where(DataSource.type == type)
  if q:
      pattern = f"%{q}%"
      count_stmt = count_stmt.where(or_(DataSource.name.ilike(pattern), DataSource.code.ilike(pattern)))
  total = session.scalar(count_stmt) or 0
  # ... rest unchanged ...


def create_data_source(session, payload):
  # ... conflict checks ...
  row = DataSource(
      # ... existing fields ...
      connection_options=_connection_options_to_json(payload.connection_options),
  )
  # ...


def patch_data_source(session, data_source_id, payload):
  data = payload.model_dump(exclude_unset=True, by_alias=False)
  if "connection_options" in data:
      raw = data.pop("connection_options")
      row.connection_options = _connection_options_to_json(
          ConnectionOptions.model_validate(raw) if raw is not None else None
      )
  for field, value in data.items():
      # ... existing password/name logic ...


def test_connection_draft(payload):
    key = _inflight_key_draft(payload)
    _acquire_test_slot(key)
    try:
        connector = _resolve_connector(payload.type)
        return _run_test(
            connector,
            host=payload.host,
            port=payload.port,
            database=payload.database,
            username=payload.username,
            password=payload.password,
            options=payload.connection_options,
        )
    finally:
        _release_test_slot(key)


def test_connection_by_id(session, data_source_id):
    key = _inflight_key_saved(data_source_id)
    _acquire_test_slot(key)
    try:
        row = session.get(DataSource, data_source_id)
        if row is None or row.deleted_at is not None:
            raise DataSourceError("DATASOURCE_NOT_FOUND", "Data source not found", 404)
        connector = _resolve_connector(row.type)
        password = decrypt_credential(row.password_encrypted)
        return _run_test(
            connector,
            host=row.host,
            port=row.port,
            database=row.database,
            username=row.username,
            password=password,
            options=_resolve_connection_options(row=row),
            data_source_id=data_source_id,
        )
    finally:
        _release_test_slot(key)
```

- [ ] **Step 4: 运行 CRUD/test 测试确认通过**

Run: `cd backend && python3 -m pytest ../tests/test_datasources_quality_r24.py -k "C17 or C18 or C19 or C20 or C21 or C22 or T11 or T12 or T13 or T14 or T15" -v`
Expected: **11 passed**

- [ ] **Step 5: r23 CRUD/test 回归**

Run: `cd backend && python3 -m pytest ../tests/test_datasources_quality_r23.py -k "C09 or C10 or T06 or T07 or duplicate_test" -v`
Expected: 全绿（T-DS-T07 行为变化：release 后第二次 200 而非 429 — r23 `duplicate_test` 仍可通过 sleep 2.1s 或单独断言 release 路径）

- [ ] **Step 6: Commit**

```bash
git add backend/app/datasources/service.py tests/test_datasources_quality_r24.py
git commit -m "feat(datasources): DS-002 CRUD options + DS-003 inflight release and test code"
```

---

### Task 6: 迁移 head 断言与全量 r24 smoke 收口

**Files:**
- Modify: `tests/test_migrations.py`
- Test: `tests/test_datasources_quality_r24.py`（完整性校验）

**Skills:**
- Read `.agents/skills/verification-before-completion/SKILL.md`

**UI skill:** none

- [ ] **Step 1: 更新 `tests/test_migrations.py` 中 head 断言（所有 `0009` → `0010`）**

将以下测试中的 revision 集合与 head 期望改为包含 `0010`：

```python
# test_revision_chain_unique_and_single_head (T-MIG-15)
assert set(revisions.keys()) == {"0001", "0002", "0003", "0004", "0005", "0006", "0007", "0008", "0009", "0010"}
assert revisions["0010"] == "0009"
assert heads == ["0010"]

# test_alembic_heads_subprocess (T-MIG-25)
assert "0010" in result.stdout

# test_revision_chain_head_is_0009 → 重命名为语义等价或改断言
assert heads == ["0010"]
mod = importlib.import_module("migrations.versions.0010_datasources_connection_options")
assert mod.down_revision == "0009"
```

- [ ] **Step 2: 运行迁移测试**

Run: `cd backend && python3 -m pytest ../tests/test_migrations.py -k "revision or head or MIG-15 or MIG-25 or MIG-30 or MIG-34 or MIG-36" -v`
Expected: 全绿

- [ ] **Step 3: 运行完整 r24 套件**

Run: `cd backend && python3 -m pytest ../tests/test_datasources_quality_r24.py -v`
Expected: **≥30 passed**（CONN 6 + DS-001 4 + DS-005 4 + schemas 2 + CRUD/test 11 + 余量）

- [ ] **Step 4: 全量回归 + ruff**

Run: `cd backend && python3 -m ruff check . && python3 -m pytest ../tests/test_datasources_quality_r23.py ../tests/test_datasources_l1.py -v`
Expected: 全绿

Run: `cd backend && python3 -m pytest -q`
Expected: **≥479 passed**, 4 skipped（不低于 r23 449 基线）

- [ ] **Step 5: Commit**

```bash
git add tests/test_migrations.py tests/test_datasources_quality_r24.py
git commit -m "test(datasources): r24 quality smoke and migration head 0010"
```

---

### Task 7: API 与服务域文档同步（P3 文档触发表）

**Files:**
- Modify: `docs/api/README.md`
- Modify: `docs/services/datasources.md`

**Skills:**
- Read `.cursor/rules/prd-sync.mdc`（评估触发表）

**UI skill:** none

- [ ] **Step 1: 更新 `docs/api/README.md`**

在 datasources 路由表追加 additive 字段说明：

```markdown
| POST | `/api/v1/datasources` | 已实现 | create 请求/响应可选 `connectionOptions`（charset/collation/sslMode/connectTimeoutSec/readTimeoutSec） |
| GET | `/api/v1/datasources` | 已实现 | 列表项含 `connectionOptions` |
| GET | `/api/v1/datasources/{id}` | 已实现 | 详情含 `connectionOptions` |
| PATCH | `/api/v1/datasources/{id}` | 已实现 | 支持部分更新 `connectionOptions` |
| POST | `/api/v1/datasources/test` | 已实现 | 响应含可选 `code`（`MYSQL_*` 稳定常量）；`traceId` |
| POST | `/api/v1/datasources/{id}/test` | 已实现 | 同上；inflight 测试完成即释放槽位 |
```

- [ ] **Step 2: 更新 `docs/services/datasources.md`**

在能力/边界节追加 r24 注记：

```markdown
### r24 质量推分（2026-07-03）

- **CONN-001**：MySQL `connection_options` 消费 — SSL 三态、charset/collation、connect/read 分层 timeout；`TestConnectionResult.code` 结构化 `MYSQL_*`
- **DS-001**：`ConnectorRegistry` `RLock`；`export_type_catalog()` DS-007 预留形状
- **DS-002**：`connection_options` JSON 列；软删后 `code` 可复用（PostgreSQL 部分唯一索引 + service 层检测）
- **DS-003**：inflight acquire + finally release；测试日志 `datasource_test` + `traceId`
- **DS-005**：`CREDENTIAL_FERNET_KEY_PREVIOUS` 双钥解密占位
```

- [ ] **Step 3: 验证文档无断链**

Run: `cd backend && python3 -m ruff check . && python3 -m pytest -q`
Expected: 全绿

- [ ] **Step 4: Commit**

```bash
git add docs/api/README.md docs/services/datasources.md
git commit -m "docs(datasources): r24 connectionOptions and test code contract"
```

---

## Self-Review（P2 自检）

| 检查项 | 结果 |
|--------|------|
| design 五项均有 Task | Task1 CONN-001 · Task2 DS-001 · Task3 DS-005 · Task4-5 DS-002/003 · Task6 测试 · Task7 文档 |
| 无 TBD/TODO 占位 | 通过 |
| 每 Task 含 Files + 验证命令 + 代码片段 | 通过 |
| 全 Task UI skill: none | 通过 |
| 文件数 16 ≤ 20 | 通过 |
| CONN-001 STUCK 破线路径 | collation + code 字段 + 1049/SSL |

## P3 执行提示

- 按 Task 1→7 顺序；每 Task 结束运行该 Task 验证命令
- `api/v1/datasources.py` 预期**无需修改**（Pydantic schema 自动透传）
- r23 `test_duplicate_test_returns_429` 依赖 2s TTL：实现 release 后，**不 sleep** 的连续请求第二次为 200；r23 用例仍 sleep 2.1s 或 inflight 内并发触发 429 — 回归应保持绿
- 触及 `backend/**/*.py` 时 P3 动态 `@` `backend-fastapi.mdc`

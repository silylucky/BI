import os

from crypto_test_env import TEST_JWT_SM2_PRIVATE, TEST_JWT_SM2_PUBLIC, TEST_SM4_KEY

os.environ.setdefault(
    "DATABASE_URL",
    "postgresql+psycopg://vitalspan:vitalspan@localhost:5432/vitalspan",
)
os.environ.setdefault("JWT_SM2_PRIVATE_KEY", TEST_JWT_SM2_PRIVATE)
os.environ.setdefault("JWT_SM2_PUBLIC_KEY", TEST_JWT_SM2_PUBLIC)
os.environ.setdefault("CREDENTIAL_SM4_KEY", TEST_SM4_KEY)
os.environ.setdefault("VITALSPAN_ENV", "development")

import socket
import uuid

import pytest
from fastapi.testclient import TestClient
from sqlalchemy.orm import Session

from app.main import app

_META_SQLITE_URL = "sqlite+pysqlite:///file:vitalspan_meta_test?mode=memory&cache=shared&uri=true"
_ADMIN_USER_ID = uuid.UUID("00000000-0000-0000-0000-000000000001")


def _clear_meta_engine_caches() -> None:
    from app.core.config import get_settings
    from app.core.db.meta import get_meta_engine

    get_settings.cache_clear()
    get_meta_engine.cache_clear()


def _seed_ci_admin_user() -> None:
    """幂等 seed：唯一 admin root 角色 + 启用 admin 用户 + 绑定（部署门禁前置）。"""
    from app.auth.models import AuthRole, AuthUser, AuthUserRole, Base, get_meta_engine

    engine = get_meta_engine()
    Base.metadata.create_all(engine)
    with Session(engine) as session:
        admin_role = session.query(AuthRole).filter(AuthRole.code == "admin").first()
        if admin_role is None:
            admin_role = AuthRole(
                code="admin",
                name="管理员",
                is_active=True,
                is_system=True,
                is_root=True,
            )
            session.add(admin_role)
            session.flush()
        else:
            admin_role.is_active = True
            admin_role.is_system = True
            admin_role.is_root = True

        admin_user = session.get(AuthUser, _ADMIN_USER_ID)
        if admin_user is None:
            admin_user = session.query(AuthUser).filter(AuthUser.username == "admin").first()
        if admin_user is None:
            password = os.environ.get("VITALSPAN_DEV_ADMIN_PASSWORD", "changeme")
            from app.auth.password.service import hash_password

            hashed = hash_password(password)
            admin_user = AuthUser(
                id=_ADMIN_USER_ID,
                username="admin",
                display_name="Admin",
                email="admin@vitalspan.local",
                password_hash=hashed,
                is_active=True,
                token_version=1,
            )
            session.add(admin_user)
            session.flush()
        else:
            admin_user.is_active = True

        binding = session.get(
            AuthUserRole, {"user_id": admin_user.id, "role_id": admin_role.id}
        )
        if binding is None:
            session.add(AuthUserRole(user_id=admin_user.id, role_id=admin_role.id))

        session.commit()


def _ensure_admin_role_binding() -> None:
    """确保用户名为 admin 的启用用户绑定到启用的 admin(root) 角色。

    兼容两种后端：postgres（迁移 seed 的 admin 用户 id 与 _ADMIN_USER_ID 不同，
    且 rbac/生命周期用例会删除 root 绑定）与 sqlite（id 即 _ADMIN_USER_ID）。
    以用户名而非固定 id 定位，避免向已存在的 admin 用户名再插入冲突。

    国密迁移后：若 admin 仍为 bcrypt 或账户被锁定，幂等重算 SM3 并解锁，
    以便 ``/api/v1/auth/login`` 契约测试可登录。
    """
    from app.auth.models import AuthRole, AuthUser, AuthUserRole, Base, get_meta_engine
    from app.auth.password.service import hash_password, needs_password_rehash

    engine = get_meta_engine()
    Base.metadata.create_all(engine)
    dev_password = os.environ.get("VITALSPAN_DEV_ADMIN_PASSWORD", "changeme")
    dirty = False
    with Session(engine) as session:
        admin_user = session.query(AuthUser).filter(AuthUser.username == "admin").first()
        if admin_user is None:
            admin_user = AuthUser(
                id=_ADMIN_USER_ID,
                username="admin",
                display_name="Admin",
                email="admin@vitalspan.local",
                password_hash=hash_password(dev_password),
                is_active=True,
                token_version=1,
            )
            session.add(admin_user)
            session.flush()
            dirty = True
        admin_role = session.query(AuthRole).filter(AuthRole.code == "admin").first()
        if admin_role is None:
            admin_role = AuthRole(
                code="admin", name="管理员", is_active=True, is_system=True, is_root=True
            )
            session.add(admin_role)
            session.flush()
        else:
            admin_role.is_active = True
            admin_role.is_root = True
        binding = session.get(
            AuthUserRole, {"user_id": admin_user.id, "role_id": admin_role.id}
        )
        if binding is None:
            session.add(AuthUserRole(user_id=admin_user.id, role_id=admin_role.id))
            dirty = True

        if not admin_user.is_active:
            admin_user.is_active = True
            dirty = True
        if admin_user.failed_login_count or admin_user.locked_until is not None:
            admin_user.failed_login_count = 0
            admin_user.locked_until = None
            dirty = True
        if os.environ.get("VITALSPAN_ENV", "development") == "development":
            admin_user.password_hash = hash_password(dev_password)
            dirty = True
        elif admin_user.password_hash and needs_password_rehash(admin_user.password_hash):
            admin_user.password_hash = hash_password(dev_password)
            dirty = True
        elif not admin_user.password_hash:
            admin_user.password_hash = hash_password(dev_password)
            dirty = True

        if dirty:
            session.commit()

# Fixture contract (BOOT-006):
# - client: TestClient(app) for all backend HTTP tests
# - auth_headers: JWT Bearer for protected routes (login or signed fallback)
# - unauthorized_headers: {"Authorization": "Bearer invalid"} for 401 negative cases
# - trace_id_headers: {"X-Trace-Id": "<32-hex>"} for TraceId passthrough tests
# - combined_auth_trace_headers: auth_headers ∪ trace_id_headers for me+trace combo tests
# - lowercase_bearer_headers: {"Authorization": "bearer dev"} for RFC scheme case sensitivity tests
# - malformed_auth_headers: {"Authorization": "Bearerde"} for missing space separator tests
# - basic_auth_headers: {"Authorization": "Basic dev"} for non-Bearer scheme tests


@pytest.fixture
def client() -> TestClient:
    return TestClient(app)


@pytest.fixture
def auth_headers() -> dict[str, str]:
    """JWT as dev user (replaces legacy Bearer dev)."""
    _ensure_admin_role_binding()
    from jwt_auth import jwt_auth_headers

    return jwt_auth_headers()


@pytest.fixture
def admin_auth_headers() -> dict[str, str]:
    """JWT as admin user for /me and login contract tests."""
    # 部署门禁与 RBAC 用例会清空 root 绑定；登录前先幂等修复 admin 角色绑定，
    # 确保 /me 返回的 roles 含 "admin"（postgres 迁移 seed 的 admin id 与
    # _ADMIN_USER_ID 不同，须按用户名修复）。
    _ensure_admin_role_binding()
    try:
        from fastapi.testclient import TestClient

        from app.main import app

        client = TestClient(app)
        response = client.post(
            "/api/v1/auth/login",
            json={"username": "admin", "password": os.environ.get("VITALSPAN_DEV_ADMIN_PASSWORD", "changeme")},
        )
        if response.status_code == 200:
            token = response.json()["accessToken"]
            return {"Authorization": f"Bearer {token}"}
    except Exception:
        pass
    from jwt_auth import jwt_auth_headers

    return jwt_auth_headers()


@pytest.fixture
def authenticated_no_permission_user() -> dict[str, object]:
    """已登录但零功能权限的真实用户（绑定一个无权限的启用角色）。Task 7 越权矩阵复用。"""
    import uuid as _uuid

    from app.auth.models import AuthRole, AuthUser, AuthUserRole, Base, get_meta_engine

    engine = get_meta_engine()
    Base.metadata.create_all(engine)
    suffix = _uuid.uuid4().hex[:10]
    with Session(engine) as session:
        role = AuthRole(code=f"noperm_{suffix}", name="无权限角色", is_active=True)
        session.add(role)
        session.flush()
        user = AuthUser(
            username=f"noperm_{suffix}",
            display_name="No Permission",
            is_active=True,
            token_version=1,
        )
        session.add(user)
        session.flush()
        session.add(AuthUserRole(user_id=user.id, role_id=role.id))
        session.commit()
        return {
            "id": str(user.id),
            "username": user.username,
            "role_id": str(role.id),
            "token_version": user.token_version,
        }


@pytest.fixture
def authenticated_no_permission_headers(
    authenticated_no_permission_user: dict[str, object],
) -> dict[str, str]:
    from jwt_auth import jwt_auth_headers

    return jwt_auth_headers(
        user_id=str(authenticated_no_permission_user["id"]),
        username=str(authenticated_no_permission_user["username"]),
        token_version=int(authenticated_no_permission_user["token_version"]),
    )


@pytest.fixture
def unauthorized_headers() -> dict[str, str]:
    return {"Authorization": "Bearer invalid"}


@pytest.fixture
def trace_id_headers() -> dict[str, str]:
    return {"X-Trace-Id": "a1b2c3d4e5f6789012345678abcdef01"}


@pytest.fixture
def combined_auth_trace_headers(
    admin_auth_headers: dict[str, str],
    trace_id_headers: dict[str, str],
) -> dict[str, str]:
    return {**admin_auth_headers, **trace_id_headers}


@pytest.fixture
def lowercase_bearer_headers() -> dict[str, str]:
    return {"Authorization": "bearer dev"}


@pytest.fixture
def malformed_auth_headers() -> dict[str, str]:
    return {"Authorization": "Bearerde"}


@pytest.fixture
def basic_auth_headers() -> dict[str, str]:
    return {"Authorization": "Basic dev"}


def _port_open(host: str, port: int, timeout: float = 1.0) -> bool:
    try:
        with socket.create_connection((host, port), timeout=timeout):
            return True
    except OSError:
        return False


def _meta_postgres_available() -> bool:
    """平台元库是否走 postgres。设 VITALSPAN_TEST_FORCE_SQLITE 可强制 sqlite（CI 平价，
    便于本地开着 postgres 时按 CI 方式跑 meta 相关测试）。"""
    if os.environ.get("VITALSPAN_TEST_FORCE_SQLITE"):
        return False
    return _port_open("127.0.0.1", 5432)


@pytest.fixture(scope="session", autouse=True)
def ci_meta_sqlite_when_no_postgres():
    """CI and local runs without compose postgres: in-memory sqlite + demo admin seed."""
    if _meta_postgres_available():
        yield
        return

    previous = os.environ.get("DATABASE_URL")
    os.environ["DATABASE_URL"] = _META_SQLITE_URL
    _clear_meta_engine_caches()
    _seed_ci_admin_user()
    yield
    if previous is None:
        os.environ.pop("DATABASE_URL", None)
    else:
        os.environ["DATABASE_URL"] = previous
    _clear_meta_engine_caches()


def _ensure_ci_admin_user_present() -> None:
    # 部署门禁：每个测试都需要至少一个启用 root 用户存在。权限/根不变量测试
    # 会在用例内删除 root 绑定，故这里每次幂等重建 admin root 角色、用户与绑定。
    _seed_ci_admin_user()


@pytest.fixture(autouse=True)
def _refresh_jwt_auth_module_constant():
    """刷新 jwt_auth.AUTH，兼容独立 sqlite 模块在 import 时捕获的过期 token。"""
    import jwt_auth as ja

    if os.environ.get("DATABASE_URL", "").startswith("sqlite"):
        _seed_ci_admin_user()
    elif _meta_postgres_available():
        _ensure_admin_role_binding()
    else:
        _seed_ci_admin_user()
    ja.AUTH.clear()
    ja.AUTH.update(ja.jwt_auth_headers())


@pytest.fixture(autouse=True)
def _ensure_report_meta_tables():
    """Ensure report ORM tables exist when rpt_*_store defaults to db."""
    from app.datasources.models import Base, get_meta_engine
    import app.reports.models  # noqa: F401
    import app.reports.persistence.models  # noqa: F401
    import app.integration.models  # noqa: F401
    import app.metadata.entity.models  # noqa: F401
    import app.metadata.physical.models  # noqa: F401

    engine = get_meta_engine()
    Base.metadata.create_all(engine)
    yield


@pytest.fixture(autouse=True)
def _clear_view_user_overrides():
    """Each test starts without persisted user view overrides."""
    from app.datasources.models import Base, get_meta_engine
    import app.views.models  # noqa: F401
    from app.views import user_override_repo

    engine = get_meta_engine()
    Base.metadata.create_all(engine)
    with Session(engine) as session:
        user_override_repo.clear_user_overrides(session)
    yield
    with Session(engine) as session:
        user_override_repo.clear_user_overrides(session)


@pytest.fixture(autouse=True)
def _reapply_sqlite_meta_when_no_postgres():
    """Other test modules may restore postgres DATABASE_URL on teardown."""
    if _meta_postgres_available():
        _ensure_admin_role_binding()
        yield
        return
    if not os.environ.get("DATABASE_URL", "").startswith("sqlite"):
        os.environ["DATABASE_URL"] = _META_SQLITE_URL
        _clear_meta_engine_caches()
    _ensure_ci_admin_user_present()
    yield


@pytest.fixture(scope="session")
def integration_env():
    mysql_ok = _port_open("127.0.0.1", 3307)
    pg_ok = _port_open("127.0.0.1", 5433)
    if not (mysql_ok and pg_ok):
        pytest.skip("compose services not running — start: docker compose up -d sample-mysql analytics-postgres")
    return {
        "analytics_url": "postgresql+psycopg://vitalspan:vitalspan@localhost:5433/analytics",
    }


@pytest.fixture(scope="session")
def connector_compose_env():
    if not (_port_open("127.0.0.1", 3307) and _port_open("127.0.0.1", 5433)):
        pytest.skip("compose not running — docker compose up -d sample-mysql analytics-postgres")
    return {
        "mysql": {
            "host": "127.0.0.1",
            "port": 3307,
            "database": "sample_db",
            "username": "sample",
            "password": "sample",
        },
        "postgresql": {
            "host": "127.0.0.1",
            "port": 5433,
            "database": "analytics",
            "username": "vitalspan",
            "password": "vitalspan",
        },
    }


from pathlib import Path

_FIXTURES_M7 = Path(__file__).resolve().parent / "fixtures" / "m7"


@pytest.fixture(scope="session")
def m7_compose_env():
    """M7 optional compose: mariadb:3308, clickhouse:8124, sqlite fixture file."""
    mariadb_ok = _port_open("127.0.0.1", 3308)
    clickhouse_ok = _port_open("127.0.0.1", 8124)
    sqlite_path = _FIXTURES_M7 / "sample.db"
    if not sqlite_path.is_file():
        pytest.skip(f"sqlite fixture missing: {sqlite_path}")
    return {
        "mariadb": {
            "host": "127.0.0.1",
            "port": 3308,
            "database": "sample_db",
            "username": "sample",
            "password": "sample",
            "_available": mariadb_ok,
        },
        "clickhouse": {
            "host": "127.0.0.1",
            "port": 8124,
            "database": "sample_db",
            "username": "default",
            "password": "",
            "_available": clickhouse_ok,
        },
        "sqlite": {
            "host": str(sqlite_path.resolve()),
            "port": 1,
            "database": "main",
            "username": "sqlite",
            "password": "x",
            "_available": True,
        },
    }


@pytest.fixture(scope="session")
def m7_mariadb_env(m7_compose_env):
    if not m7_compose_env["mariadb"]["_available"]:
        pytest.skip("sample-mariadb:3308 not running — docker compose up -d sample-mariadb")
    return m7_compose_env["mariadb"]


@pytest.fixture(scope="session")
def m7_clickhouse_env(m7_compose_env):
    if not m7_compose_env["clickhouse"]["_available"]:
        pytest.skip("sample-clickhouse:8124 not running — docker compose up -d sample-clickhouse")
    return m7_compose_env["clickhouse"]


@pytest.fixture(scope="session")
def m7_sqlite_env(m7_compose_env):
    return m7_compose_env["sqlite"]


@pytest.fixture(scope="session")
def m11_compose_env():
    """M11 optional compose ports — per-service _available; missing ports do not fail session."""
    return {
        "starrocks": {
            "host": "127.0.0.1",
            "port": 9030,
            "database": "test",
            "username": "root",
            "password": "",
            "_available": _port_open("127.0.0.1", 9030),
        },
        "trino": {
            "host": "127.0.0.1",
            "port": 8080,
            "database": "hive",
            "username": "trino",
            "password": "",
            "_available": _port_open("127.0.0.1", 8080),
        },
        "influxdb": {
            "host": "127.0.0.1",
            "port": 8086,
            "database": "metrics",
            "username": "myorg",
            "password": "token",
            "_available": _port_open("127.0.0.1", 8086),
        },
        "tdengine": {
            "host": "127.0.0.1",
            "port": 6041,
            "database": "power",
            "username": "root",
            "password": "taosdata",
            "_available": _port_open("127.0.0.1", 6041),
        },
        "timescaledb": {
            "host": "127.0.0.1",
            "port": 5434,
            "database": "ops_tsdb",
            "username": "vitalspan",
            "password": "vitalspan",
            "_available": _port_open("127.0.0.1", 5434),
        },
    }


@pytest.fixture(scope="session")
def alembic_meta_sqlite_url(tmp_path_factory: pytest.TempPathFactory) -> str:
    """File-backed sqlite migrated with Alembic head for persistence round-trip tests."""
    import subprocess
    import sys
    from crypto_test_env import TEST_JWT_SM2_PRIVATE, TEST_JWT_SM2_PUBLIC, TEST_SM4_KEY

    db_path = tmp_path_factory.mktemp("alembic-meta") / "meta.db"
    url = f"sqlite+pysqlite:///{db_path.as_posix()}"
    backend_root = Path(__file__).resolve().parents[1] / "backend"
    env = os.environ.copy()
    env["DATABASE_URL"] = url
    env.setdefault("JWT_SM2_PRIVATE_KEY", TEST_JWT_SM2_PRIVATE)
    env.setdefault("JWT_SM2_PUBLIC_KEY", TEST_JWT_SM2_PUBLIC)
    env.setdefault("CREDENTIAL_SM4_KEY", TEST_SM4_KEY)
    env.setdefault("VITALSPAN_ENV", "development")
    result = subprocess.run(
        [sys.executable, "-m", "alembic", "upgrade", "head"],
        cwd=backend_root,
        env=env,
        capture_output=True,
        text=True,
    )
    assert result.returncode == 0, result.stderr or result.stdout
    return url


@pytest.fixture
def alembic_meta_engine(alembic_meta_sqlite_url: str, monkeypatch: pytest.MonkeyPatch):
    """Bind app meta engine to Alembic-initialized sqlite for one test."""
    previous = os.environ.get("DATABASE_URL")
    monkeypatch.setenv("DATABASE_URL", alembic_meta_sqlite_url)
    _clear_meta_engine_caches()
    from app.datasources.models import get_meta_engine

    engine = get_meta_engine()
    yield engine
    if previous is None:
        monkeypatch.delenv("DATABASE_URL", raising=False)
    else:
        monkeypatch.setenv("DATABASE_URL", previous)
    _clear_meta_engine_caches()


@pytest.fixture
def l1_analytics_engine(analytics_sqlite: str):
    """Yield SQLAlchemy engine bound to in-memory analytics; drop test tables after."""
    from sqlalchemy import create_engine, text

    engine = create_engine(analytics_sqlite)
    yield engine
    with engine.begin() as conn:
        conn.execute(text('DROP TABLE IF EXISTS "orders_l1_write"'))
        conn.execute(text('DROP TABLE IF EXISTS "orders_l1_order_r11"'))

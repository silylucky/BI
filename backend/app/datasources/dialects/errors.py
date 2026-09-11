from __future__ import annotations

import pymysql.err

MYSQL_CONN_REFUSED = "MYSQL_CONN_REFUSED"
MYSQL_AUTH_FAILED = "MYSQL_AUTH_FAILED"
MYSQL_TIMEOUT = "MYSQL_TIMEOUT"
MYSQL_SSL_ERROR = "MYSQL_SSL_ERROR"
MYSQL_UNKNOWN = "MYSQL_UNKNOWN"
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


PG_CONN_REFUSED = "PG_CONN_REFUSED"
PG_AUTH_FAILED = "PG_AUTH_FAILED"
PG_TIMEOUT = "PG_TIMEOUT"
PG_UNKNOWN_DATABASE = "PG_UNKNOWN_DATABASE"
PG_SSL_ERROR = "PG_SSL_ERROR"
PG_UNKNOWN = "PG_UNKNOWN"

_SSL_MODE_TO_PG = {
    "disabled": "disable",
    "preferred": "prefer",
    "required": "require",
}


def pg_sslmode(ssl_mode: str) -> str:
    return _SSL_MODE_TO_PG.get(ssl_mode, "prefer")


def map_postgres_operational_error(exc: Exception) -> tuple[str, str]:
    detail = str(exc)
    sqlstate = getattr(exc, "sqlstate", None) or getattr(exc, "pgcode", None)
    if sqlstate == "28P01":
        return PG_AUTH_FAILED, detail
    if sqlstate == "3D000":
        return PG_UNKNOWN_DATABASE, detail
    lowered = detail.lower()
    if "timeout" in lowered or "timed out" in lowered:
        return PG_TIMEOUT, detail
    if "ssl" in lowered:
        return PG_SSL_ERROR, detail
    if "connection refused" in lowered or "could not connect" in lowered:
        return PG_CONN_REFUSED, detail
    return PG_UNKNOWN, detail


# TiDB aliases (mapped from MYSQL_* at connector layer)
TIDB_CONN_REFUSED = "TIDB_CONN_REFUSED"
TIDB_AUTH_FAILED = "TIDB_AUTH_FAILED"
TIDB_TIMEOUT = "TIDB_TIMEOUT"
TIDB_UNKNOWN_DATABASE = "TIDB_UNKNOWN_DATABASE"
TIDB_UNKNOWN = "TIDB_UNKNOWN"


SQLSERVER_CONN_REFUSED = "SQLSERVER_CONN_REFUSED"
SQLSERVER_AUTH_FAILED = "SQLSERVER_AUTH_FAILED"
SQLSERVER_TIMEOUT = "SQLSERVER_TIMEOUT"
SQLSERVER_UNKNOWN_DATABASE = "SQLSERVER_UNKNOWN_DATABASE"
SQLSERVER_SSL_ERROR = "SQLSERVER_SSL_ERROR"
SQLSERVER_UNKNOWN = "SQLSERVER_UNKNOWN"

_SQLSERVER_CODE_MAP: dict[int, str] = {
    20009: SQLSERVER_CONN_REFUSED,
    18456: SQLSERVER_AUTH_FAILED,
    4060: SQLSERVER_UNKNOWN_DATABASE,
}


def map_sqlserver_operational_error(exc: Exception) -> tuple[str, str]:
    detail = str(exc)
    errno = int(exc.args[0]) if getattr(exc, "args", None) and exc.args else 0
    if errno in (20002, 20003):
        return SQLSERVER_TIMEOUT, detail
    if "ssl" in detail.lower() or "encrypt" in detail.lower():
        return SQLSERVER_SSL_ERROR, detail
    code = _SQLSERVER_CODE_MAP.get(errno, SQLSERVER_UNKNOWN)
    if "timeout" in detail.lower():
        return SQLSERVER_TIMEOUT, detail
    return code, detail


ORACLE_CONN_REFUSED = "ORACLE_CONN_REFUSED"
ORACLE_AUTH_FAILED = "ORACLE_AUTH_FAILED"
ORACLE_TIMEOUT = "ORACLE_TIMEOUT"
ORACLE_UNKNOWN_SERVICE = "ORACLE_UNKNOWN_SERVICE"
ORACLE_UNKNOWN = "ORACLE_UNKNOWN"

_SYSTEM_OWNERS = frozenset({"SYS", "SYSTEM"})


def map_oracle_error(exc: Exception) -> tuple[str, str]:
    detail = str(exc)
    lowered = detail.lower()
    if "ora-01017" in lowered:
        return ORACLE_AUTH_FAILED, detail
    if "ora-12514" in lowered or "ora-12505" in lowered or "unknown service" in lowered:
        return ORACLE_UNKNOWN_SERVICE, detail
    if "timeout" in lowered or "timed out" in lowered:
        return ORACLE_TIMEOUT, detail
    if "refused" in lowered or isinstance(exc, ConnectionRefusedError):
        return ORACLE_CONN_REFUSED, detail
    return ORACLE_UNKNOWN, detail


# Hive
HIVE_CONN_REFUSED = "HIVE_CONN_REFUSED"
HIVE_AUTH_FAILED = "HIVE_AUTH_FAILED"
HIVE_TIMEOUT = "HIVE_TIMEOUT"
HIVE_UNKNOWN_DATABASE = "HIVE_UNKNOWN_DATABASE"
HIVE_UNKNOWN = "HIVE_UNKNOWN"


def map_hive_error(exc: Exception) -> tuple[str, str]:
    detail = str(exc)
    lowered = detail.lower()
    if "auth" in lowered or "denied" in lowered or "password" in lowered:
        return HIVE_AUTH_FAILED, detail
    if "timeout" in lowered or "timed out" in lowered:
        return HIVE_TIMEOUT, detail
    if "refused" in lowered or "could not connect" in lowered:
        return HIVE_CONN_REFUSED, detail
    if "database" in lowered and "not" in lowered:
        return HIVE_UNKNOWN_DATABASE, detail
    return HIVE_UNKNOWN, detail


# ClickHouse
CLICKHOUSE_CONN_REFUSED = "CLICKHOUSE_CONN_REFUSED"
CLICKHOUSE_AUTH_FAILED = "CLICKHOUSE_AUTH_FAILED"
CLICKHOUSE_TIMEOUT = "CLICKHOUSE_TIMEOUT"
CLICKHOUSE_UNKNOWN_DATABASE = "CLICKHOUSE_UNKNOWN_DATABASE"
CLICKHOUSE_UNKNOWN = "CLICKHOUSE_UNKNOWN"


def map_clickhouse_error(exc: Exception) -> tuple[str, str]:
    detail = str(exc)
    lowered = detail.lower()
    if "401" in detail or "unauthorized" in lowered or "auth" in lowered:
        return CLICKHOUSE_AUTH_FAILED, detail
    if "timeout" in lowered or "timed out" in lowered:
        return CLICKHOUSE_TIMEOUT, detail
    if "refused" in lowered or isinstance(exc, ConnectionRefusedError):
        return CLICKHOUSE_CONN_REFUSED, detail
    if "database" in lowered and ("unknown" in lowered or "doesn't exist" in lowered):
        return CLICKHOUSE_UNKNOWN_DATABASE, detail
    return CLICKHOUSE_UNKNOWN, detail


# Doris (MySQL protocol alias)
DORIS_TIMEOUT = "DORIS_TIMEOUT"
DORIS_CONN_REFUSED = "DORIS_CONN_REFUSED"
DORIS_AUTH_FAILED = "DORIS_AUTH_FAILED"
DORIS_UNKNOWN_DATABASE = "DORIS_UNKNOWN_DATABASE"
DORIS_UNKNOWN = "DORIS_UNKNOWN"


# StarRocks (MySQL protocol alias)
STARROCKS_TIMEOUT = "STARROCKS_TIMEOUT"
STARROCKS_CONN_REFUSED = "STARROCKS_CONN_REFUSED"
STARROCKS_AUTH_FAILED = "STARROCKS_AUTH_FAILED"
STARROCKS_UNKNOWN_DATABASE = "STARROCKS_UNKNOWN_DATABASE"
STARROCKS_UNKNOWN = "STARROCKS_UNKNOWN"


def map_doris_operational_error(exc: pymysql.err.OperationalError) -> tuple[str, str]:
    code, detail = map_mysql_operational_error(exc)
    mapping = {
        "MYSQL_TIMEOUT": DORIS_TIMEOUT,
        "MYSQL_CONN_REFUSED": DORIS_CONN_REFUSED,
        "MYSQL_AUTH_FAILED": DORIS_AUTH_FAILED,
        "MYSQL_UNKNOWN_DATABASE": DORIS_UNKNOWN_DATABASE,
    }
    return mapping.get(code, DORIS_UNKNOWN), detail


# GaussDB (PostgreSQL-compatible alias)
GAUSSDB_CONN_REFUSED = "GAUSSDB_CONN_REFUSED"
GAUSSDB_AUTH_FAILED = "GAUSSDB_AUTH_FAILED"
GAUSSDB_TIMEOUT = "GAUSSDB_TIMEOUT"
GAUSSDB_UNKNOWN_DATABASE = "GAUSSDB_UNKNOWN_DATABASE"
GAUSSDB_UNKNOWN = "GAUSSDB_UNKNOWN"

_GAUSSDB_FROM_PG = {
    PG_CONN_REFUSED: GAUSSDB_CONN_REFUSED,
    PG_AUTH_FAILED: GAUSSDB_AUTH_FAILED,
    PG_TIMEOUT: GAUSSDB_TIMEOUT,
    PG_UNKNOWN_DATABASE: GAUSSDB_UNKNOWN_DATABASE,
    PG_SSL_ERROR: GAUSSDB_UNKNOWN,
    PG_UNKNOWN: GAUSSDB_UNKNOWN,
}


def map_gaussdb_error(exc: Exception) -> tuple[str, str]:
    # PG_TIMEOUT → GAUSSDB_TIMEOUT via _GAUSSDB_FROM_PG; PG_AUTH_FAILED → GAUSSDB_AUTH_FAILED
    if hasattr(exc, "sqlstate") or "OperationalError" in type(exc).__name__:
        pg_code, detail = map_postgres_operational_error(exc)
        return _GAUSSDB_FROM_PG.get(pg_code, GAUSSDB_UNKNOWN), detail
    detail = str(exc)
    lowered = detail.lower()
    if "auth" in lowered or "password" in lowered:
        return GAUSSDB_AUTH_FAILED, detail
    if "timeout" in lowered or "timed out" in lowered:
        return GAUSSDB_TIMEOUT, detail
    if "refused" in lowered:
        return GAUSSDB_CONN_REFUSED, detail
    if "database" in lowered and "not" in lowered:
        return GAUSSDB_UNKNOWN_DATABASE, detail
    return GAUSSDB_UNKNOWN, detail


# DM (Dameng)
DM_CONN_REFUSED = "DM_CONN_REFUSED"
DM_AUTH_FAILED = "DM_AUTH_FAILED"
DM_TIMEOUT = "DM_TIMEOUT"
DM_UNKNOWN_DATABASE = "DM_UNKNOWN_DATABASE"
DM_UNKNOWN = "DM_UNKNOWN"
DM_DRIVER_MISSING = "DM_DRIVER_MISSING"


def map_dm_error(exc: Exception) -> tuple[str, str]:
    # auth: password/login/-2501 → DM_AUTH_FAILED; timeout → DM_TIMEOUT
    detail = str(exc)
    lowered = detail.lower()
    if "dmpython" in lowered or "no module named" in lowered and "dm" in lowered:
        return DM_DRIVER_MISSING, detail
    if "password" in lowered or "login" in lowered or "-2501" in detail:
        return DM_AUTH_FAILED, detail
    if "timeout" in lowered or "timed out" in lowered:
        return DM_TIMEOUT, detail
    if "refused" in lowered or isinstance(exc, ConnectionRefusedError):
        return DM_CONN_REFUSED, detail
    if "database" in lowered and ("unknown" in lowered or "not exist" in lowered):
        return DM_UNKNOWN_DATABASE, detail
    return DM_UNKNOWN, detail


# Trino
TRINO_CONN_REFUSED = "TRINO_CONN_REFUSED"
TRINO_AUTH_FAILED = "TRINO_AUTH_FAILED"
TRINO_TIMEOUT = "TRINO_TIMEOUT"
TRINO_UNKNOWN_CATALOG = "TRINO_UNKNOWN_CATALOG"
TRINO_UNKNOWN = "TRINO_UNKNOWN"
TRINO_DRIVER_MISSING = "TRINO_DRIVER_MISSING"


def map_trino_error(exc: Exception) -> tuple[str, str]:
    # auth: 401/unauthorized → TRINO_AUTH_FAILED; timeout → TRINO_TIMEOUT
    detail = str(exc)
    lowered = detail.lower()
    if "no module named" in lowered and "trino" in lowered:
        return TRINO_DRIVER_MISSING, detail
    if "unauthorized" in lowered or "401" in detail or "access denied" in lowered:
        return TRINO_AUTH_FAILED, detail
    if "timeout" in lowered or "timed out" in lowered:
        return TRINO_TIMEOUT, detail
    if "refused" in lowered or isinstance(exc, ConnectionRefusedError):
        return TRINO_CONN_REFUSED, detail
    if "catalog" in lowered and ("not found" in lowered or "does not exist" in lowered):
        return TRINO_UNKNOWN_CATALOG, detail
    if type(exc).__name__ == "TrinoUserError":
        if "catalog" in lowered:
            return TRINO_UNKNOWN_CATALOG, detail
    return TRINO_UNKNOWN, detail


# r39 companion: GAUSSDB_/DM_/TRINO_ timeout/auth 映射由 map_* 统一出口；
# connector test_connection 与 HTTP test 链均消费本模块常量（勿在 dialect 文件内复制错误码）。
# r41 companion: MONGODB_/INFLUX_/TDENGINE_/SQLITE_/TIMESCALE_ timeout/auth/unknown_database
# 映射由 map_* 统一出口；connector test_connection 与 HTTP test 链均消费本模块常量。

# GBase 8a (MySQL protocol)
GBASE_CONN_REFUSED = "GBASE_CONN_REFUSED"
GBASE_AUTH_FAILED = "GBASE_AUTH_FAILED"
GBASE_TIMEOUT = "GBASE_TIMEOUT"
GBASE_UNKNOWN_DATABASE = "GBASE_UNKNOWN_DATABASE"
GBASE_UNKNOWN = "GBASE_UNKNOWN"


def map_gbase_error(exc: Exception) -> tuple[str, str]:
    if isinstance(exc, pymysql.err.OperationalError):
        errno = int(exc.args[0]) if exc.args else 0
        detail = str(exc.args[1]) if len(exc.args) > 1 else str(exc)
        if errno == 2002 or "timed out" in detail.lower():
            return GBASE_TIMEOUT, detail
        if errno == 1049:
            return GBASE_UNKNOWN_DATABASE, detail
        code, detail = map_mysql_operational_error(exc)
        mapping = {
            "MYSQL_TIMEOUT": GBASE_TIMEOUT,
            "MYSQL_CONN_REFUSED": GBASE_CONN_REFUSED,
            "MYSQL_AUTH_FAILED": GBASE_AUTH_FAILED,
            "MYSQL_UNKNOWN_DATABASE": GBASE_UNKNOWN_DATABASE,
        }
        return mapping.get(code, GBASE_UNKNOWN), detail
    return GBASE_UNKNOWN, str(exc)


# OceanBase (MySQL protocol)
OCEANBASE_CONN_REFUSED = "OCEANBASE_CONN_REFUSED"
OCEANBASE_AUTH_FAILED = "OCEANBASE_AUTH_FAILED"
OCEANBASE_TIMEOUT = "OCEANBASE_TIMEOUT"
OCEANBASE_UNKNOWN_DATABASE = "OCEANBASE_UNKNOWN_DATABASE"
OCEANBASE_UNKNOWN = "OCEANBASE_UNKNOWN"


def map_oceanbase_error(exc: Exception) -> tuple[str, str]:
    if isinstance(exc, pymysql.err.OperationalError):
        errno = int(exc.args[0]) if exc.args else 0
        detail = str(exc.args[1]) if len(exc.args) > 1 else str(exc)
        if errno == 2002 or "timed out" in detail.lower():
            return OCEANBASE_TIMEOUT, detail
        if errno == 1049:
            return OCEANBASE_UNKNOWN_DATABASE, detail
        code, detail = map_mysql_operational_error(exc)
        mapping = {
            "MYSQL_TIMEOUT": OCEANBASE_TIMEOUT,
            "MYSQL_CONN_REFUSED": OCEANBASE_CONN_REFUSED,
            "MYSQL_AUTH_FAILED": OCEANBASE_AUTH_FAILED,
            "MYSQL_UNKNOWN_DATABASE": OCEANBASE_UNKNOWN_DATABASE,
        }
        return mapping.get(code, OCEANBASE_UNKNOWN), detail
    return OCEANBASE_UNKNOWN, str(exc)


# KingbaseES (PostgreSQL protocol)
KINGBASE_CONN_REFUSED = "KINGBASE_CONN_REFUSED"
KINGBASE_AUTH_FAILED = "KINGBASE_AUTH_FAILED"
KINGBASE_TIMEOUT = "KINGBASE_TIMEOUT"
KINGBASE_UNKNOWN_DATABASE = "KINGBASE_UNKNOWN_DATABASE"
KINGBASE_UNKNOWN = "KINGBASE_UNKNOWN"
KINGBASE_INVALID_PARAMS = "KINGBASE_INVALID_PARAMS"
KINGBASE_PORT_OUT_OF_RANGE = "KINGBASE_PORT_OUT_OF_RANGE"

_KINGBASE_FROM_PG = {
    PG_CONN_REFUSED: KINGBASE_CONN_REFUSED,
    PG_AUTH_FAILED: KINGBASE_AUTH_FAILED,
    PG_TIMEOUT: KINGBASE_TIMEOUT,
    PG_UNKNOWN_DATABASE: KINGBASE_UNKNOWN_DATABASE,
    PG_SSL_ERROR: KINGBASE_UNKNOWN,
    PG_UNKNOWN: KINGBASE_UNKNOWN,
}


def map_kingbase_error(exc: Exception) -> tuple[str, str]:
    if hasattr(exc, "sqlstate") or "OperationalError" in type(exc).__name__:
        pg_code, detail = map_postgres_operational_error(exc)
        return _KINGBASE_FROM_PG.get(pg_code, KINGBASE_UNKNOWN), detail
    detail = str(exc)
    lowered = detail.lower()
    if "auth" in lowered or "password" in lowered:
        return KINGBASE_AUTH_FAILED, detail
    if "timeout" in lowered or "timed out" in lowered:
        return KINGBASE_TIMEOUT, detail
    if "refused" in lowered:
        return KINGBASE_CONN_REFUSED, detail
    if "database" in lowered and "not" in lowered:
        return KINGBASE_UNKNOWN_DATABASE, detail
    return KINGBASE_UNKNOWN, detail


# MongoDB
MONGODB_CONN_REFUSED = "MONGODB_CONN_REFUSED"
MONGODB_AUTH_FAILED = "MONGODB_AUTH_FAILED"
MONGODB_TIMEOUT = "MONGODB_TIMEOUT"
MONGODB_UNKNOWN_DATABASE = "MONGODB_UNKNOWN_DATABASE"
MONGODB_INVALID_HOST = "MONGODB_INVALID_HOST"
MONGODB_DRIVER_MISSING = "MONGODB_DRIVER_MISSING"
MONGODB_UNKNOWN = "MONGODB_UNKNOWN"


def map_mongodb_error(exc: Exception) -> tuple[str, str]:
    detail = str(exc)
    name = type(exc).__name__
    lowered = detail.lower()
    if "ServerSelectionTimeout" in name or "timeout" in lowered or "timed out" in lowered:
        return MONGODB_TIMEOUT, detail
    # NamespaceNotFound / unknown database — 须在 auth 泛化匹配之前
    exc_code = getattr(exc, "code", None)
    if exc_code == 26:
        return MONGODB_UNKNOWN_DATABASE, detail
    if "database" in lowered and (
        "not found" in lowered or "does not exist" in lowered or "ns not found" in lowered
    ):
        return MONGODB_UNKNOWN_DATABASE, detail
    if "OperationFailure" in name or "authentication" in lowered or "code: 18" in lowered or "code: 13" in lowered:
        return MONGODB_AUTH_FAILED, detail
    if "refused" in lowered or isinstance(exc, ConnectionRefusedError):
        return MONGODB_CONN_REFUSED, detail
    if "invalid" in lowered and "host" in lowered:
        return MONGODB_INVALID_HOST, detail
    return MONGODB_UNKNOWN, detail


# InfluxDB 2.x
INFLUX_CONN_REFUSED = "INFLUX_CONN_REFUSED"
INFLUX_AUTH_FAILED = "INFLUX_AUTH_FAILED"
INFLUX_TIMEOUT = "INFLUX_TIMEOUT"
INFLUX_UNKNOWN_ORG = "INFLUX_UNKNOWN_ORG"
INFLUX_UNKNOWN_BUCKET = "INFLUX_UNKNOWN_BUCKET"
INFLUX_DRIVER_MISSING = "INFLUX_DRIVER_MISSING"
INFLUX_UNKNOWN = "INFLUX_UNKNOWN"


def map_influx_error(exc: Exception) -> tuple[str, str]:
    detail = str(exc)
    lowered = detail.lower()
    if "401" in detail or "403" in detail or "unauthorized" in lowered or "forbidden" in lowered:
        return INFLUX_AUTH_FAILED, detail
    if "timeout" in lowered or "timed out" in lowered:
        return INFLUX_TIMEOUT, detail
    if "refused" in lowered or isinstance(exc, ConnectionRefusedError):
        return INFLUX_CONN_REFUSED, detail
    if "org" in lowered and ("not found" in lowered or "unknown" in lowered):
        return INFLUX_UNKNOWN_ORG, detail
    if "bucket" in lowered and ("not found" in lowered or "unknown" in lowered):
        return INFLUX_UNKNOWN_BUCKET, detail
    return INFLUX_UNKNOWN, detail


# TDengine (taospy REST)
TDENGINE_CONN_REFUSED = "TDENGINE_CONN_REFUSED"
TDENGINE_AUTH_FAILED = "TDENGINE_AUTH_FAILED"
TDENGINE_TIMEOUT = "TDENGINE_TIMEOUT"
TDENGINE_UNKNOWN_DATABASE = "TDENGINE_UNKNOWN_DATABASE"
TDENGINE_DRIVER_MISSING = "TDENGINE_DRIVER_MISSING"
TDENGINE_UNKNOWN = "TDENGINE_UNKNOWN"


def map_tdengine_error(exc: Exception) -> tuple[str, str]:
    detail = str(exc)
    lowered = detail.lower()
    if "auth" in lowered or "password" in lowered or "login" in lowered:
        return TDENGINE_AUTH_FAILED, detail
    if "timeout" in lowered or "timed out" in lowered:
        return TDENGINE_TIMEOUT, detail
    if "refused" in lowered or isinstance(exc, ConnectionRefusedError):
        return TDENGINE_CONN_REFUSED, detail
    if "database" in lowered and ("not" in lowered or "unknown" in lowered):
        return TDENGINE_UNKNOWN_DATABASE, detail
    return TDENGINE_UNKNOWN, detail


# SQLite (file path)
SQLITE_FILE_NOT_FOUND = "SQLITE_FILE_NOT_FOUND"
SQLITE_PATH_TRAVERSAL = "SQLITE_PATH_TRAVERSAL"
SQLITE_PERMISSION_DENIED = "SQLITE_PERMISSION_DENIED"
SQLITE_READONLY = "SQLITE_READONLY"
SQLITE_CORRUPT = "SQLITE_CORRUPT"
SQLITE_UNKNOWN = "SQLITE_UNKNOWN"


def map_sqlite_error(exc: Exception) -> tuple[str, str]:
    detail = str(exc)
    lowered = detail.lower()
    if "unable to open" in lowered or "no such file" in lowered:
        return SQLITE_FILE_NOT_FOUND, detail
    if "readonly" in lowered or "read-only" in lowered:
        return SQLITE_READONLY, detail
    if "malformed" in lowered or "corrupt" in lowered:
        return SQLITE_CORRUPT, detail
    if "permission" in lowered or "denied" in lowered:
        return SQLITE_PERMISSION_DENIED, detail
    return SQLITE_UNKNOWN, detail


# TimescaleDB (PG delegate)
TIMESCALE_CONN_REFUSED = "TIMESCALE_CONN_REFUSED"
TIMESCALE_AUTH_FAILED = "TIMESCALE_AUTH_FAILED"
TIMESCALE_TIMEOUT = "TIMESCALE_TIMEOUT"
TIMESCALE_UNKNOWN_DATABASE = "TIMESCALE_UNKNOWN_DATABASE"
TIMESCALE_EXTENSION_MISSING = "TIMESCALE_EXTENSION_MISSING"
TIMESCALE_UNKNOWN = "TIMESCALE_UNKNOWN"

_TIMESCALE_FROM_PG = {
    PG_CONN_REFUSED: TIMESCALE_CONN_REFUSED,
    PG_AUTH_FAILED: TIMESCALE_AUTH_FAILED,
    PG_TIMEOUT: TIMESCALE_TIMEOUT,
    PG_UNKNOWN_DATABASE: TIMESCALE_UNKNOWN_DATABASE,
    PG_SSL_ERROR: TIMESCALE_UNKNOWN,
    PG_UNKNOWN: TIMESCALE_UNKNOWN,
}


def map_timescale_error(exc: Exception) -> tuple[str, str]:
    if hasattr(exc, "sqlstate") or "OperationalError" in type(exc).__name__:
        pg_code, detail = map_postgres_operational_error(exc)
        return _TIMESCALE_FROM_PG.get(pg_code, TIMESCALE_UNKNOWN), detail
    detail = str(exc)
    lowered = detail.lower()
    if "auth" in lowered or "password" in lowered:
        return TIMESCALE_AUTH_FAILED, detail
    if "timeout" in lowered or "timed out" in lowered:
        return TIMESCALE_TIMEOUT, detail
    if "refused" in lowered:
        return TIMESCALE_CONN_REFUSED, detail
    if "database" in lowered and "not" in lowered:
        return TIMESCALE_UNKNOWN_DATABASE, detail
    return TIMESCALE_UNKNOWN, detail


OPENSEARCH_INVALID_HOST = "OPENSEARCH_INVALID_HOST"
OPENSEARCH_CONNECTION_REFUSED = "OPENSEARCH_CONNECTION_REFUSED"
OPENSEARCH_AUTH_FAILED = "OPENSEARCH_AUTH_FAILED"
OPENSEARCH_TIMEOUT = "OPENSEARCH_TIMEOUT"
OPENSEARCH_UNKNOWN = "OPENSEARCH_UNKNOWN"
OPENSEARCH_INDEX_NOT_FOUND = "OPENSEARCH_INDEX_NOT_FOUND"


def map_opensearch_error(exc: Exception) -> tuple[str, str]:
    msg = str(exc).lower()
    if "index_not_found" in msg or "index not found" in msg or "404" in msg:
        return OPENSEARCH_INDEX_NOT_FOUND, str(exc)
    if "timeout" in msg or "timed out" in msg:
        return OPENSEARCH_TIMEOUT, str(exc)
    if "connection refused" in msg or "failed to establish" in msg:
        return OPENSEARCH_CONNECTION_REFUSED, str(exc)
    if "authentication" in msg or "401" in msg or "403" in msg:
        return OPENSEARCH_AUTH_FAILED, str(exc)
    if "host is required" in msg:
        return OPENSEARCH_INVALID_HOST, str(exc)
    return OPENSEARCH_UNKNOWN, str(exc)


REST_API_INVALID_URL = "REST_API_INVALID_URL"
REST_API_AUTH_FAILED = "REST_API_AUTH_FAILED"
REST_API_TIMEOUT = "REST_API_TIMEOUT"
REST_API_PROBE_FAILED = "REST_API_PROBE_FAILED"


def map_rest_api_error(exc: Exception) -> tuple[str, str]:
    detail = str(exc)
    lowered = detail.lower()
    if "401" in lowered or "unauthorized" in lowered:
        return REST_API_AUTH_FAILED, detail
    if "timeout" in lowered or "timed out" in lowered:
        return REST_API_TIMEOUT, detail
    if "invalid url" in lowered or "missing scheme" in lowered:
        return REST_API_INVALID_URL, detail
    return REST_API_PROBE_FAILED, detail


ROAPI_INVALID_URL = "ROAPI_INVALID_URL"
ROAPI_AUTH_FAILED = "ROAPI_AUTH_FAILED"
ROAPI_TIMEOUT = "ROAPI_TIMEOUT"
ROAPI_PROBE_FAILED = "ROAPI_PROBE_FAILED"
ROAPI_QUERY_FAILED = "ROAPI_QUERY_FAILED"
ROAPI_TABLE_NOT_FOUND = "ROAPI_TABLE_NOT_FOUND"


def map_roapi_error(exc: Exception) -> tuple[str, str]:
    detail = str(exc)
    lowered = detail.lower()
    if "401" in lowered or "unauthorized" in lowered:
        return ROAPI_AUTH_FAILED, detail
    if "timeout" in lowered or "timed out" in lowered:
        return ROAPI_TIMEOUT, detail
    if "invalid url" in lowered or "missing scheme" in lowered:
        return ROAPI_INVALID_URL, detail
    if "404" in lowered or "not found" in lowered:
        return ROAPI_TABLE_NOT_FOUND, detail
    return ROAPI_PROBE_FAILED, detail


FILE_NOT_FOUND = "FILE_NOT_FOUND"
FILE_PARSE_ERROR = "FILE_PARSE_ERROR"
FILE_REMOTE_HTTP_ERROR = "FILE_REMOTE_HTTP_ERROR"
FILE_EXTENSION_DENIED = "FILE_EXTENSION_DENIED"
FILE_PATH_TRAVERSAL = "FILE_PATH_TRAVERSAL"
FILE_DRIVER_MISSING = "FILE_DRIVER_MISSING"


def map_file_error(exc: Exception) -> tuple[str, str]:
    detail = str(exc)
    lowered = detail.lower()
    if "traversal" in lowered or ".." in detail:
        return FILE_PATH_TRAVERSAL, detail
    if "404" in detail or "not found" in lowered:
        return FILE_NOT_FOUND, detail
    if "extension" in lowered:
        return FILE_EXTENSION_DENIED, detail
    if "openpyxl" in lowered or "driver" in lowered:
        return FILE_DRIVER_MISSING, detail
    if "http" in lowered and ("ssl" in lowered or "remote" in lowered):
        return FILE_REMOTE_HTTP_ERROR, detail
    return FILE_PARSE_ERROR, detail


DB2_AUTH_FAILED = "DB2_AUTH_FAILED"
DB2_CONN_REFUSED = "DB2_CONN_REFUSED"
DB2_UNKNOWN_DATABASE = "DB2_UNKNOWN_DATABASE"
DB2_TIMEOUT = "DB2_TIMEOUT"
DB2_DRIVER_MISSING = "DB2_DRIVER_MISSING"


def map_db2_error(exc: Exception) -> tuple[str, str]:
    detail = str(exc)
    lowered = detail.lower()
    if "security" in lowered or "28000" in detail or "sql30082" in lowered:
        return DB2_AUTH_FAILED, detail
    if "timeout" in lowered:
        return DB2_TIMEOUT, detail
    if "connection refused" in lowered or "sql30081" in lowered:
        return DB2_CONN_REFUSED, detail
    if "unknown database" in lowered or "sql1013" in lowered:
        return DB2_UNKNOWN_DATABASE, detail
    if "import" in lowered or "ibm_db" in lowered:
        return DB2_DRIVER_MISSING, detail
    return DB2_CONN_REFUSED, detail


IMPALA_AUTH_FAILED = "IMPALA_AUTH_FAILED"
IMPALA_CONN_REFUSED = "IMPALA_CONN_REFUSED"
IMPALA_UNKNOWN_DATABASE = "IMPALA_UNKNOWN_DATABASE"
IMPALA_TIMEOUT = "IMPALA_TIMEOUT"

map_impala_error = map_hive_error


# Redshift (Postgres-compatible; error codes remap to REDSHIFT_ prefix)
REDSHIFT_AUTH_FAILED = "REDSHIFT_AUTH_FAILED"
REDSHIFT_CONN_REFUSED = "REDSHIFT_CONN_REFUSED"
REDSHIFT_SSL_REQUIRED = "REDSHIFT_SSL_REQUIRED"
REDSHIFT_TIMEOUT = "REDSHIFT_TIMEOUT"
REDSHIFT_UNKNOWN_DATABASE = "REDSHIFT_UNKNOWN_DATABASE"
REDSHIFT_UNKNOWN = "REDSHIFT_UNKNOWN"

_PG_TO_REDSHIFT: dict[str, str] = {
    PG_CONN_REFUSED: REDSHIFT_CONN_REFUSED,
    PG_AUTH_FAILED: REDSHIFT_AUTH_FAILED,
    PG_TIMEOUT: REDSHIFT_TIMEOUT,
    PG_UNKNOWN_DATABASE: REDSHIFT_UNKNOWN_DATABASE,
    PG_SSL_ERROR: REDSHIFT_SSL_REQUIRED,
    PG_UNKNOWN: REDSHIFT_UNKNOWN,
}


def map_redshift_error(exc: Exception) -> tuple[str, str]:
    """Map psycopg/network exception to REDSHIFT_* error code."""
    import psycopg  # local import, avoids hard dep if psycopg unavailable

    if isinstance(exc, psycopg.OperationalError):
        pg_code, detail = map_postgres_operational_error(exc)
        if "ssl" in detail.lower():
            return REDSHIFT_SSL_REQUIRED, detail
        return _PG_TO_REDSHIFT.get(pg_code, REDSHIFT_UNKNOWN), detail
    detail = str(exc)
    if "ssl" in detail.lower():
        return REDSHIFT_SSL_REQUIRED, detail
    return REDSHIFT_UNKNOWN, detail


__all__ = [
    "DB2_AUTH_FAILED",
    "DB2_CONN_REFUSED",
    "DB2_DRIVER_MISSING",
    "DB2_TIMEOUT",
    "DB2_UNKNOWN_DATABASE",
    "CLICKHOUSE_CONN_REFUSED",
    "CLICKHOUSE_TIMEOUT",
    "CLICKHOUSE_UNKNOWN",
    "CLICKHOUSE_UNKNOWN_DATABASE",
    "DM_AUTH_FAILED",
    "DM_CONN_REFUSED",
    "DM_DRIVER_MISSING",
    "DM_TIMEOUT",
    "DM_UNKNOWN",
    "DM_UNKNOWN_DATABASE",
    "FILE_DRIVER_MISSING",
    "FILE_EXTENSION_DENIED",
    "FILE_NOT_FOUND",
    "FILE_PARSE_ERROR",
    "FILE_PATH_TRAVERSAL",
    "FILE_REMOTE_HTTP_ERROR",
    "DORIS_CONN_REFUSED",
    "DORIS_TIMEOUT",
    "DORIS_UNKNOWN",
    "DORIS_UNKNOWN_DATABASE",
    "STARROCKS_AUTH_FAILED",
    "STARROCKS_CONN_REFUSED",
    "STARROCKS_TIMEOUT",
    "STARROCKS_UNKNOWN",
    "STARROCKS_UNKNOWN_DATABASE",
    "GAUSSDB_AUTH_FAILED",
    "GAUSSDB_CONN_REFUSED",
    "GAUSSDB_TIMEOUT",
    "GAUSSDB_UNKNOWN",
    "GAUSSDB_UNKNOWN_DATABASE",
    "GBASE_AUTH_FAILED",
    "GBASE_CONN_REFUSED",
    "GBASE_TIMEOUT",
    "GBASE_UNKNOWN",
    "GBASE_UNKNOWN_DATABASE",
    "KINGBASE_AUTH_FAILED",
    "KINGBASE_CONN_REFUSED",
    "KINGBASE_TIMEOUT",
    "KINGBASE_UNKNOWN",
    "KINGBASE_UNKNOWN_DATABASE",
    "OCEANBASE_AUTH_FAILED",
    "OCEANBASE_CONN_REFUSED",
    "OCEANBASE_TIMEOUT",
    "OCEANBASE_UNKNOWN",
    "OCEANBASE_UNKNOWN_DATABASE",
    "IMPALA_AUTH_FAILED",
    "IMPALA_CONN_REFUSED",
    "IMPALA_TIMEOUT",
    "IMPALA_UNKNOWN_DATABASE",
    "HIVE_CONN_REFUSED",
    "HIVE_TIMEOUT",
    "HIVE_UNKNOWN",
    "HIVE_UNKNOWN_DATABASE",
    "INFLUX_AUTH_FAILED",
    "INFLUX_CONN_REFUSED",
    "INFLUX_DRIVER_MISSING",
    "INFLUX_TIMEOUT",
    "INFLUX_UNKNOWN",
    "INFLUX_UNKNOWN_BUCKET",
    "INFLUX_UNKNOWN_ORG",
    "MONGODB_AUTH_FAILED",
    "MONGODB_CONN_REFUSED",
    "MONGODB_DRIVER_MISSING",
    "MONGODB_INVALID_HOST",
    "MONGODB_TIMEOUT",
    "MONGODB_UNKNOWN",
    "MONGODB_UNKNOWN_DATABASE",
    "MYSQL_AUTH_FAILED",
    "MYSQL_CONN_REFUSED",
    "MYSQL_SSL_ERROR",
    "MYSQL_TIMEOUT",
    "MYSQL_UNKNOWN",
    "MYSQL_UNKNOWN_DATABASE",
    "ORACLE_AUTH_FAILED",
    "ORACLE_CONN_REFUSED",
    "ORACLE_TIMEOUT",
    "ORACLE_UNKNOWN",
    "ORACLE_UNKNOWN_SERVICE",
    "OPENSEARCH_AUTH_FAILED",
    "OPENSEARCH_CONNECTION_REFUSED",
    "OPENSEARCH_INDEX_NOT_FOUND",
    "OPENSEARCH_INVALID_HOST",
    "OPENSEARCH_TIMEOUT",
    "OPENSEARCH_UNKNOWN",
    "REST_API_AUTH_FAILED",
    "REST_API_INVALID_URL",
    "REST_API_PROBE_FAILED",
    "REST_API_TIMEOUT",
    "ROAPI_AUTH_FAILED",
    "ROAPI_INVALID_URL",
    "ROAPI_PROBE_FAILED",
    "ROAPI_QUERY_FAILED",
    "ROAPI_TABLE_NOT_FOUND",
    "ROAPI_TIMEOUT",
    "PG_CONN_REFUSED",
    "PG_SSL_ERROR",
    "PG_TIMEOUT",
    "PG_UNKNOWN",
    "PG_UNKNOWN_DATABASE",
    "SQLSERVER_AUTH_FAILED",
    "SQLSERVER_CONN_REFUSED",
    "SQLSERVER_SSL_ERROR",
    "SQLSERVER_TIMEOUT",
    "SQLSERVER_UNKNOWN",
    "SQLSERVER_UNKNOWN_DATABASE",
    "SQLITE_CORRUPT",
    "SQLITE_FILE_NOT_FOUND",
    "SQLITE_PATH_TRAVERSAL",
    "SQLITE_PERMISSION_DENIED",
    "SQLITE_READONLY",
    "SQLITE_UNKNOWN",
    "TDENGINE_AUTH_FAILED",
    "TDENGINE_CONN_REFUSED",
    "TDENGINE_DRIVER_MISSING",
    "TDENGINE_TIMEOUT",
    "TDENGINE_UNKNOWN",
    "TDENGINE_UNKNOWN_DATABASE",
    "TIDB_AUTH_FAILED",
    "TIMESCALE_AUTH_FAILED",
    "TIMESCALE_CONN_REFUSED",
    "TIMESCALE_EXTENSION_MISSING",
    "TIMESCALE_TIMEOUT",
    "TIMESCALE_UNKNOWN",
    "TIMESCALE_UNKNOWN_DATABASE",
    "TIDB_CONN_REFUSED",
    "TIDB_TIMEOUT",
    "TIDB_UNKNOWN",
    "TIDB_UNKNOWN_DATABASE",
    "TRINO_AUTH_FAILED",
    "TRINO_CONN_REFUSED",
    "TRINO_DRIVER_MISSING",
    "TRINO_TIMEOUT",
    "TRINO_UNKNOWN",
    "TRINO_UNKNOWN_CATALOG",
    "map_db2_error",
    "map_file_error",
    "map_dm_error",
    "map_doris_operational_error",
    "map_gaussdb_error",
    "map_gbase_error",
    "map_kingbase_error",
    "map_oceanbase_error",
    "map_hive_error",
    "map_impala_error",
    "map_influx_error",
    "map_mongodb_error",
    "map_mysql_operational_error",
    "map_opensearch_error",
    "map_oracle_error",
    "map_postgres_operational_error",
    "map_rest_api_error",
    "map_sqlserver_operational_error",
    "map_sqlite_error",
    "map_tdengine_error",
    "map_timescale_error",
    "map_trino_error",
    "pg_sslmode",
    "REDSHIFT_AUTH_FAILED",
    "REDSHIFT_CONN_REFUSED",
    "REDSHIFT_SSL_REQUIRED",
    "REDSHIFT_TIMEOUT",
    "REDSHIFT_UNKNOWN",
    "REDSHIFT_UNKNOWN_DATABASE",
    "map_redshift_error",
]

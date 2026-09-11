from __future__ import annotations

import json
import time
from typing import Any

from app.core.config import get_settings
from app.datasources.dialects.base import ColumnInfo, SchemaInfo, TableInfo, TestConnectionResult
from app.datasources.dialects.errors import MONGODB_DRIVER_MISSING, map_mongodb_error
from app.datasources.type_normalize import normalize_bson_type_name
from app.query.native.guard import guard_native_injection
from app.query.schemas import QueryError

_FORBIDDEN_MONGO_BODY_KEYS = frozenset({"$where", "mapReduce", "$out", "$merge"})

MONGODB_MAX_FIELDS = 500
_SYSTEM_DBS = frozenset({"admin", "local", "config"})


def _import_pymongo():
    try:
        from pymongo import MongoClient
        from pymongo.errors import OperationFailure, ServerSelectionTimeoutError

        return MongoClient, OperationFailure, ServerSelectionTimeoutError
    except ImportError:
        return None, None, None


def _mongo_uri(*, host: str, port: int, username: str, password: str, database: str) -> str:
    use_auth = bool(username and username != "none" and password and password != "-")
    auth = f"{username}:{password}@" if use_auth else ""
    db = database or "admin"
    return f"mongodb://{auth}{host}:{port}/{db}"


def _get_client(**kwargs: Any) -> Any:
    MongoClient, _, _ = _import_pymongo()
    if MongoClient is None:
        raise ImportError("pymongo not installed")
    timeout_ms = int(max(1.0, float(kwargs.get("timeout_sec", 5.0))) * 1000)
    return MongoClient(
        _mongo_uri(
            host=kwargs["host"],
            port=kwargs.get("port", 27017),
            username=kwargs.get("username", ""),
            password=kwargs.get("password", ""),
            database=kwargs.get("database", ""),
        ),
        serverSelectionTimeoutMS=timeout_ms,
    )


def _normalize_bson_type(value: Any) -> str:
    return normalize_bson_type_name(type(value).__name__)


def _serialize_mongo_cell(value: Any) -> Any:
    if isinstance(value, (dict, list)):
        return json.dumps(value, default=str)
    return value


def probe_readonly_find(connection: Any, *, database: str, collection: str) -> bool:
    if not database.strip() or not collection.strip():
        return False
    try:
        cursor = connection[database][collection].find({}, projection={"_id": 1}).limit(1)
        list(cursor)
        return True
    except Exception:
        return False


class MongodbConnector:
    type = "mongodb"
    category = "document"
    capabilities = ("connectivity_test", "schema_browser")
    display_name = "MongoDB"

    def test_connection(
        self,
        *,
        host: str,
        port: int,
        database: str,
        username: str,
        password: str,
        timeout_sec: float = 5.0,
        **_: object,
    ) -> TestConnectionResult:
        started = time.perf_counter()
        MongoClient, OperationFailure, ServerSelectionTimeoutError = _import_pymongo()
        if MongoClient is None:
            return TestConnectionResult(
                ok=False,
                message=f"[{MONGODB_DRIVER_MISSING}] pymongo not installed",
                latency_ms=0,
                code=MONGODB_DRIVER_MISSING,
            )
        try:
            client = _get_client(
                host=host, port=port, database=database, username=username,
                password=password, timeout_sec=timeout_sec,
            )
            try:
                client.admin.command("ping")
            finally:
                client.close()
        except (OperationFailure, ServerSelectionTimeoutError, Exception) as exc:
            code, detail = map_mongodb_error(exc)
            latency_ms = int((time.perf_counter() - started) * 1000)
            return TestConnectionResult(ok=False, message=f"[{code}] {detail}", latency_ms=latency_ms, code=code)
        latency_ms = int((time.perf_counter() - started) * 1000)
        return TestConnectionResult(ok=True, message="Connection successful", latency_ms=latency_ms, code=None)

    def open_connection(self, **kwargs: Any) -> Any:
        return _get_client(**kwargs)

    def list_schemas(self, connection: Any) -> list[SchemaInfo]:
        names = [n for n in connection.list_database_names() if n not in _SYSTEM_DBS]
        return [SchemaInfo(name=n) for n in sorted(names)]

    def list_tables(self, connection: Any, schema: str) -> list[TableInfo]:
        if not schema.strip():
            return []
        # r41: 空库 list_collection_names → []（mock 或真实零 collection）
        try:
            db = connection[schema]
            return [TableInfo(name=n, type="collection") for n in sorted(db.list_collection_names())]
        except Exception:
            return []

    def list_columns(self, connection: Any, schema: str, table: str) -> list[ColumnInfo]:
        if not schema.strip() or not table.strip():
            return []
        try:
            doc = connection[schema][table].find_one()
        except Exception:
            return []
        # r41: 空 collection（find_one None）→ []，与未知 database 区分
        if not doc:
            return []
        columns = [
            ColumnInfo(name=k, data_type=_normalize_bson_type(v), nullable=True)
            for k, v in sorted(doc.items())
        ]
        return columns[:MONGODB_MAX_FIELDS] if len(columns) > MONGODB_MAX_FIELDS else columns

    def execute_native_query(
        self,
        connection: Any,
        *,
        body: dict,
        limit: int,
        offset: int = 0,
        database: str | None = None,
    ) -> tuple[list[str], list[list], bool]:
        for key in body:
            if key in _FORBIDDEN_MONGO_BODY_KEYS:
                raise QueryError("QUERY_NATIVE_INJECTION_SUSPECT", f"Forbidden key: {key}", 422)
        guard_native_injection(body)
        collection = body.get("collection")
        if not isinstance(collection, str) or not collection.strip():
            raise QueryError("QUERY_NATIVE_INVALID_BODY", "body.collection is required", 422)
        db_name = body.get("database") or database or ""
        if not db_name.strip():
            raise QueryError("QUERY_NATIVE_INVALID_BODY", "database is required", 422)
        filt = body.get("filter") if isinstance(body.get("filter"), dict) else {}
        projection = body.get("projection") if isinstance(body.get("projection"), dict) else None
        cap = min(limit, get_settings().query_default_limit)
        try:
            coll = connection[db_name][collection]
            cursor = coll.find(filt, projection).skip(offset).limit(cap + 1)
            docs = list(cursor)
        except Exception as exc:
            msg = str(exc).lower()
            if "ns not found" in msg or "not found" in msg:
                raise QueryError("QUERY_TABLE_NOT_FOUND", str(exc), 404) from exc
            raise QueryError("QUERY_EXECUTION_ERROR", str(exc), 400) from exc
        truncated = len(docs) > cap
        docs = docs[:cap]
        if not docs:
            return [], [], False
        keys = sorted({k for doc in docs for k in doc if k != "_id"})
        columns = keys if keys else ["_id"]
        rows = [[_serialize_mongo_cell(doc.get(c)) for c in columns] for doc in docs]
        return columns, rows, truncated

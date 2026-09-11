import io
import json
import logging
import os
import re

import pytest

from app.core.config import Settings, get_settings
from app.core.logging import JsonFormatter, configure_logging
from crypto_test_env import settings_kwargs

TRACE_ID_HEX_PATTERN = re.compile(r"^[0-9a-f]{32}$")


def test_health_response_includes_generated_trace_id(client):
    """T-TRC-01: GET /health 响应含 X-Trace-Id（32 位 hex）。"""
    response = client.get("/health")
    assert response.status_code == 200
    trace_id = response.headers.get("X-Trace-Id")
    assert trace_id is not None
    assert TRACE_ID_HEX_PATTERN.match(trace_id)


def test_health_preserves_incoming_trace_id(client, trace_id_headers):
    """T-TRC-02: 透传已有 X-Trace-Id 请求头。"""
    incoming = trace_id_headers["X-Trace-Id"]
    response = client.get("/health", headers=trace_id_headers)
    assert response.status_code == 200
    assert response.headers.get("X-Trace-Id") == incoming


def test_request_log_json_contains_trace_id(client):
    """T-TRC-03: JsonFormatter 输出 JSON 含 traceId 字段。"""
    from app.core.logging import JsonFormatter

    stream = io.StringIO()
    handler = logging.StreamHandler(stream)
    handler.setFormatter(JsonFormatter())
    logger = logging.getLogger("vitalspan.http")
    logger.addHandler(handler)
    logger.setLevel(logging.INFO)
    try:
        response = client.get("/health")
        assert response.status_code == 200
        trace_id = response.headers["X-Trace-Id"]
        lines = [line for line in stream.getvalue().splitlines() if line.strip()]
        assert lines, "expected JSON log lines"
        payloads = [json.loads(line) for line in lines]
        started = next(p for p in payloads if p.get("message") == "request_started")
        assert started.get("traceId") == trace_id
    finally:
        logger.removeHandler(handler)


def test_request_finished_log_contains_trace_id(client):
    """T-TRC-04: request_finished 日志 JSON 含 traceId。"""
    stream = io.StringIO()
    handler = logging.StreamHandler(stream)
    handler.setFormatter(JsonFormatter())
    logger = logging.getLogger("vitalspan.http")
    logger.addHandler(handler)
    logger.setLevel(logging.INFO)
    try:
        response = client.get("/health")
        assert response.status_code == 200
        trace_id = response.headers["X-Trace-Id"]
        lines = [line for line in stream.getvalue().splitlines() if line.strip()]
        payloads = [json.loads(line) for line in lines]
        started = next(p for p in payloads if p.get("message") == "request_started")
        finished = next(p for p in payloads if p.get("message") == "request_finished")
        assert started.get("traceId") == trace_id
        assert finished.get("status_code") == 200
        assert finished.get("traceId") == trace_id
    finally:
        logger.removeHandler(handler)


def test_settings_default_log_level_is_info():
    """T-TRC-05: Settings 默认 log_level == INFO。"""
    assert get_settings().log_level == "INFO"


def test_configure_logging_accepts_debug_level(monkeypatch):
    """T-TRC-06: LOG_LEVEL=DEBUG 可加载。"""
    monkeypatch.setenv("LOG_LEVEL", "DEBUG")
    get_settings.cache_clear()
    configure_logging(get_settings())
    assert logging.getLogger().level == logging.DEBUG


def test_empty_trace_id_header_generates_new_trace(client):
    """T-TRC-07: 空 X-Trace-Id 生成新 trace。"""
    response = client.get("/health", headers={"X-Trace-Id": ""})
    assert response.status_code == 200
    trace_id = response.headers.get("X-Trace-Id")
    assert trace_id
    assert TRACE_ID_HEX_PATTERN.match(trace_id)


def test_configure_logging_rejects_invalid_log_level():
    """T-TRC-08: 非法 LOG_LEVEL 结构化失败。"""
    settings = Settings(
        **settings_kwargs(),
        log_level="NOT_A_LEVEL",
    )
    with pytest.raises(ValueError):
        configure_logging(settings)


def _capture_http_logs(client) -> list[str]:
    stream = io.StringIO()
    handler = logging.StreamHandler(stream)
    handler.setFormatter(JsonFormatter())
    logger = logging.getLogger("vitalspan.http")
    logger.addHandler(handler)
    logger.setLevel(logging.INFO)
    try:
        response = client.get("/health")
        assert response.status_code == 200
        return [line for line in stream.getvalue().splitlines() if line.strip()]
    finally:
        logger.removeHandler(handler)


def test_request_log_excludes_jwt_private_key_plaintext(client):
    """T-TRC-09: 请求日志 JSON 不含 JWT 私钥明文。"""
    secret = os.environ["JWT_SM2_PRIVATE_KEY"]
    lines = _capture_http_logs(client)
    assert lines
    for line in lines:
        assert secret not in line


def test_request_log_excludes_database_credential_substring(client):
    """T-TRC-10: 请求日志 JSON 不含 database URL 凭据子串。"""
    credential_fragment = "vitalspan:vitalspan@"
    lines = _capture_http_logs(client)
    assert lines
    for line in lines:
        assert credential_fragment not in line


def test_non_hex_incoming_trace_id_preserved(client):
    """T-TRC-12: 非 hex 入站 X-Trace-Id 原样回显（middleware L16 行为）。"""
    custom = "not-hex-but-present"
    response = client.get("/health", headers={"X-Trace-Id": custom})
    assert response.status_code == 200
    assert response.headers.get("X-Trace-Id") == custom


def _capture_http_json_payloads(client) -> tuple[str, list[dict]]:
    stream = io.StringIO()
    handler = logging.StreamHandler(stream)
    handler.setFormatter(JsonFormatter())
    logger = logging.getLogger("vitalspan.http")
    logger.addHandler(handler)
    logger.setLevel(logging.INFO)
    try:
        response = client.get("/health")
        assert response.status_code == 200
        trace_id = response.headers["X-Trace-Id"]
        lines = [line for line in stream.getvalue().splitlines() if line.strip()]
        payloads = [json.loads(line) for line in lines]
        return trace_id, payloads
    finally:
        logger.removeHandler(handler)


def test_request_finished_log_must_contain_trace_id(client):
    """T-TRC-11: request_finished 日志 JSON 必须含 traceId（硬断言）。"""
    trace_id, payloads = _capture_http_json_payloads(client)
    finished = next(p for p in payloads if p.get("message") == "request_finished")
    assert finished.get("traceId") == trace_id


def test_no_trace_header_generates_consistent_trace(client):
    """T-TRC-13: 显式不传 X-Trace-Id；started/finished traceId 一致且为 32 位 hex。"""
    trace_id, payloads = _capture_http_json_payloads(client)
    assert TRACE_ID_HEX_PATTERN.match(trace_id)
    started = next(p for p in payloads if p.get("message") == "request_started")
    finished = next(p for p in payloads if p.get("message") == "request_finished")
    assert started.get("traceId") == trace_id
    assert finished.get("traceId") == trace_id


def test_oversized_incoming_trace_id_preserved(client):
    """T-TRC-14: 256 字符入站 X-Trace-Id 原样回显。"""
    oversized = "a" * 256
    stream = io.StringIO()
    handler = logging.StreamHandler(stream)
    handler.setFormatter(JsonFormatter())
    logger = logging.getLogger("vitalspan.http")
    logger.addHandler(handler)
    logger.setLevel(logging.INFO)
    try:
        response = client.get("/health", headers={"X-Trace-Id": oversized})
        assert response.status_code == 200
        assert response.headers.get("X-Trace-Id") == oversized
        payloads = [json.loads(line) for line in stream.getvalue().splitlines() if line.strip()]
        for message in ("request_started", "request_finished"):
            row = next(p for p in payloads if p.get("message") == message)
            assert row.get("traceId") == oversized
    finally:
        logger.removeHandler(handler)


def test_duplicate_trace_header_documents_behavior(client):
    """T-TRC-15: 重复 X-Trace-Id 头记录 Starlette 合并行为（不断言 500）。"""
    response = client.get(
        "/health",
        headers=[("X-Trace-Id", "first-trace"), ("X-Trace-Id", "second-trace")],
    )
    assert response.status_code == 200
    echoed = response.headers.get("X-Trace-Id")
    assert echoed is not None
    assert echoed in ("first-trace", "second-trace", "first-trace,second-trace")


def test_error_log_level_suppresses_info_request_logs(client, monkeypatch):
    """T-TRC-16: LOG_LEVEL=ERROR 抑制 vitalspan.http INFO 级 request_started。"""
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


def test_consecutive_requests_trace_id_isolated(client):
    """T-TRC-17: 连续两请求不同 X-Trace-Id；响应头与 request_started 日志各自匹配。"""
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

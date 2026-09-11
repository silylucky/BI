"""Minimal MailHog-compatible SMTP sink for integration tests (stdlib only)."""

from __future__ import annotations

import json
import socket
import threading
from email import message_from_bytes
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer

_messages: list[dict] = []
_lock = threading.Lock()
_smtp_thread: threading.Thread | None = None
_http_server: ThreadingHTTPServer | None = None
_smtp_server: socket.socket | None = None


def _email_to_item(raw: bytes) -> dict:
    msg = message_from_bytes(raw)
    parts: list[dict] = []
    for part in msg.walk():
        if part.get_content_disposition() != "attachment":
            continue
        payload = part.get_payload(decode=True) or b""
        parts.append(
            {
                "Body": payload.decode("latin-1", errors="replace"),
                "Headers": {
                    "Content-Type": [part.get_content_type()],
                    "Content-Disposition": [part.get("Content-Disposition", "")],
                },
            }
        )
    if not parts:
        parts.append({"Body": raw.decode("latin-1", errors="replace"), "Headers": {}})
    return {"MIME": {"Parts": parts}, "Content": {"Body": raw.decode("latin-1", errors="replace")}}


def _smtp_client_loop(conn: socket.socket) -> None:
    try:
        conn.sendall(b"220 local-mailhog ESMTP\r\n")
        data_lines: list[bytes] = []
        in_data = False
        while True:
            chunk = conn.recv(4096)
            if not chunk:
                break
            for line in chunk.split(b"\r\n"):
                if not line and not in_data:
                    continue
                upper = line.upper()
                if not in_data:
                    if upper.startswith(b"EHLO") or upper.startswith(b"HELO"):
                        conn.sendall(b"250-local-mailhog\r\n250 OK\r\n")
                    elif upper.startswith(b"MAIL FROM"):
                        conn.sendall(b"250 OK\r\n")
                    elif upper.startswith(b"RCPT TO"):
                        conn.sendall(b"250 OK\r\n")
                    elif upper == b"DATA":
                        in_data = True
                        data_lines = []
                        conn.sendall(b"354 End data with <CR><LF>.<CR><LF>\r\n")
                    elif upper.startswith(b"QUIT"):
                        conn.sendall(b"221 Bye\r\n")
                        return
                    elif upper.startswith(b"RSET"):
                        conn.sendall(b"250 OK\r\n")
                    else:
                        conn.sendall(b"250 OK\r\n")
                elif line == b".":
                    raw = b"\r\n".join(data_lines)
                    item = _email_to_item(raw)
                    with _lock:
                        _messages.insert(0, item)
                    in_data = False
                    conn.sendall(b"250 OK\r\n")
                else:
                    if line.startswith(b"."):
                        line = line[1:]
                    data_lines.append(line)
    finally:
        conn.close()


def _smtp_accept_loop(server: socket.socket) -> None:
    server.listen(8)
    while True:
        try:
            conn, _ = server.accept()
        except OSError:
            return
        threading.Thread(target=_smtp_client_loop, args=(conn,), daemon=True).start()


class _ApiHandler(BaseHTTPRequestHandler):
    def log_message(self, *_args) -> None:
        return

    def do_GET(self) -> None:
        if not self.path.startswith("/api/v2/messages"):
            self.send_error(404)
            return
        with _lock:
            body = json.dumps({"total": len(_messages), "count": len(_messages), "items": list(_messages)})
        self.send_response(200)
        self.send_header("Content-Type", "application/json")
        self.end_headers()
        self.wfile.write(body.encode())


def start_local_mailhog(*, host: str = "127.0.0.1", smtp_port: int = 1025, api_port: int = 8025) -> None:
    global _smtp_thread, _http_server, _smtp_server
    if _smtp_thread is not None:
        return
    with _lock:
        _messages.clear()
    _smtp_server = socket.socket(socket.AF_INET, socket.SOCK_STREAM)
    _smtp_server.setsockopt(socket.SOL_SOCKET, socket.SO_REUSEADDR, 1)
    _smtp_server.bind((host, smtp_port))
    _smtp_thread = threading.Thread(target=_smtp_accept_loop, args=(_smtp_server,), daemon=True)
    _smtp_thread.start()
    _http_server = ThreadingHTTPServer((host, api_port), _ApiHandler)
    threading.Thread(target=_http_server.serve_forever, daemon=True).start()


def stop_local_mailhog() -> None:
    global _smtp_thread, _http_server, _smtp_server
    if _http_server is not None:
        _http_server.shutdown()
        _http_server = None
    if _smtp_server is not None:
        try:
            _smtp_server.close()
        except OSError:
            pass
        _smtp_server = None
    _smtp_thread = None
    with _lock:
        _messages.clear()


def clear_messages() -> None:
    with _lock:
        _messages.clear()

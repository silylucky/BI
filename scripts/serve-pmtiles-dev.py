"""DEPRECATED — use scripts/start-pmtiles-external.ps1 (Docker Caddy 外部服务).

保留 --legacy-dev 仅供无 Docker 时的应急验真，不是交付路径。
"""
from __future__ import annotations

import argparse
import os
from http import HTTPStatus
from http.server import SimpleHTTPRequestHandler, ThreadingHTTPServer
from pathlib import Path


class PmtilesHandler(SimpleHTTPRequestHandler):
    def end_headers(self) -> None:
        self.send_header("Access-Control-Allow-Origin", "http://localhost:5173")
        self.send_header("Access-Control-Allow-Methods", "GET, HEAD, OPTIONS")
        self.send_header("Access-Control-Allow-Headers", "Range, If-Match, If-None-Match")
        self.send_header(
            "Access-Control-Expose-Headers",
            "Content-Length, Content-Range, ETag, Accept-Ranges",
        )
        super().end_headers()

    def do_OPTIONS(self) -> None:
        self.send_response(HTTPStatus.NO_CONTENT)
        self.end_headers()

    def send_head(self):  # noqa: ANN201 - matches base signature
        path = self.translate_path(self.path)
        if os.path.isdir(path):
            return super().send_head()

        ctype = self.guess_type(path)
        try:
            file_size = os.path.getsize(path)
            with open(path, "rb") as file:
                range_header = self.headers.get("Range")
                if range_header:
                    start, end = self._parse_range(range_header, file_size)
                    if start is None:
                        self.send_error(HTTPStatus.REQUESTED_RANGE_NOT_SATISFIABLE)
                        return None
                    file.seek(start)
                    length = end - start + 1
                    self.send_response(HTTPStatus.PARTIAL_CONTENT)
                    self.send_header("Content-Type", ctype)
                    self.send_header("Accept-Ranges", "bytes")
                    self.send_header("Content-Range", f"bytes {start}-{end}/{file_size}")
                    self.send_header("Content-Length", str(length))
                    self.end_headers()
                    return file.read(length) if self.command != "HEAD" else None

                self.send_response(HTTPStatus.OK)
                self.send_header("Content-Type", ctype)
                self.send_header("Accept-Ranges", "bytes")
                self.send_header("Content-Length", str(file_size))
                self.end_headers()
                return None if self.command == "HEAD" else file.read()
        except OSError:
            self.send_error(HTTPStatus.NOT_FOUND, "File not found")
            return None

    @staticmethod
    def _parse_range(header: str, file_size: int) -> tuple[int | None, int | None]:
        if not header.startswith("bytes="):
            return None, None
        spec = header.removeprefix("bytes=").strip()
        if "," in spec:
            return None, None
        start_text, _, end_text = spec.partition("-")
        try:
            if start_text and end_text:
                start = int(start_text)
                end = int(end_text)
            elif start_text:
                start = int(start_text)
                end = file_size - 1
            elif end_text:
                suffix = int(end_text)
                start = max(file_size - suffix, 0)
                end = file_size - 1
            else:
                return None, None
        except ValueError:
            return None, None
        if start < 0 or end >= file_size or start > end:
            return None, None
        return start, end

    def copyfile(self, source, outputfile):  # noqa: ANN001, ANN201
        if isinstance(source, (bytes, bytearray)):
            outputfile.write(source)
            return
        super().copyfile(source, outputfile)


def main() -> None:
    parser = argparse.ArgumentParser(description="Serve PMTiles directory with Range + CORS")
    parser.add_argument(
        "--legacy-dev",
        action="store_true",
        help="Allow running deprecated dev server (default: exit with instructions)",
    )
    parser.add_argument("--host", default="127.0.0.1")
    parser.add_argument("--port", type=int, default=8080)
    parser.add_argument("--directory", default=str(Path.home() / "Desktop"))
    args = parser.parse_args()
    if not args.legacy_dev:
        print("请使用: .\\scripts\\start-pmtiles-external.ps1")
        print("文档: docker/pmtiles-tile-server/README.md")
        raise SystemExit(1)
    root = Path(args.directory).resolve()
    handler = lambda *h_args, **h_kwargs: PmtilesHandler(  # noqa: E731
        *h_args, directory=str(root), **h_kwargs
    )
    server = ThreadingHTTPServer((args.host, args.port), handler)
    print(f"Serving {root} at http://{args.host}:{args.port}/ (Range + CORS)")
    server.serve_forever()


if __name__ == "__main__":
    main()

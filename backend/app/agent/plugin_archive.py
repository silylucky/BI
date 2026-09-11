from __future__ import annotations

import stat
import zipfile
from pathlib import Path, PurePosixPath

MAX_PLUGIN_ARCHIVE_BYTES = 25 * 1024 * 1024
MAX_PLUGIN_ARCHIVE_FILES = 2_000
MAX_PLUGIN_ARCHIVE_UNCOMPRESSED_BYTES = 100 * 1024 * 1024
MAX_PLUGIN_COMPRESSION_RATIO = 100


class PluginArchiveError(ValueError):
    """Raised when a plugin archive violates the managed-install safety limits."""


def validate_and_extract_plugin_archive(archive: Path, destination: Path) -> None:
    """Validate a ZIP package before extracting it into an empty staging directory."""
    if not archive.is_file():
        raise PluginArchiveError("插件包不存在")
    if archive.stat().st_size > MAX_PLUGIN_ARCHIVE_BYTES:
        raise PluginArchiveError("插件包压缩后的大小不能超过 25 MB")
    try:
        with zipfile.ZipFile(archive) as package:
            members = package.infolist()
            _validate_members(members)
            _extract_members(package, members, destination)
    except zipfile.BadZipFile as exc:
        raise PluginArchiveError("插件包不是有效的 ZIP 文件") from exc


def _validate_members(members: list[zipfile.ZipInfo]) -> None:
    if not members:
        raise PluginArchiveError("插件包不能为空")
    if len(members) > MAX_PLUGIN_ARCHIVE_FILES:
        raise PluginArchiveError(f"插件包文件数不能超过 {MAX_PLUGIN_ARCHIVE_FILES}")

    total_size = 0
    member_paths: set[str] = set()
    for member in members:
        normalized_path = _validate_member_path(member)
        if normalized_path.casefold() in member_paths:
            raise PluginArchiveError("插件包包含重复文件路径")
        member_paths.add(normalized_path.casefold())
        _validate_member_type(member)
        total_size += member.file_size
        if total_size > MAX_PLUGIN_ARCHIVE_UNCOMPRESSED_BYTES:
            raise PluginArchiveError("插件包解压后的总大小不能超过 100 MB")
        if member.file_size and member.file_size / max(member.compress_size, 1) > MAX_PLUGIN_COMPRESSION_RATIO:
            raise PluginArchiveError("插件包压缩比异常，已拒绝解压")


def _validate_member_path(member: zipfile.ZipInfo) -> str:
    normalized = member.filename.replace("\\", "/")
    path = PurePosixPath(normalized)
    if (
        path.is_absolute()
        or not normalized
        or any(part in {"", ".", ".."} for part in path.parts)
        or any(":" in part for part in path.parts)
    ):
        raise PluginArchiveError("插件包包含非法文件路径")
    return normalized


def _validate_member_type(member: zipfile.ZipInfo) -> None:
    mode = member.external_attr >> 16
    if stat.S_ISLNK(mode):
        raise PluginArchiveError("插件包不能包含符号链接")
    file_type = stat.S_IFMT(mode)
    if file_type not in {0, stat.S_IFREG, stat.S_IFDIR}:
        raise PluginArchiveError("插件包不能包含特殊文件")


def _extract_members(
    package: zipfile.ZipFile,
    members: list[zipfile.ZipInfo],
    destination: Path,
) -> None:
    destination.mkdir(parents=True, exist_ok=True)
    root = destination.resolve()
    extracted_bytes = 0
    for member in members:
        normalized_path = member.filename.replace("\\", "/")
        target = (root / normalized_path).resolve()
        if not target.is_relative_to(root):
            raise PluginArchiveError("插件包包含越界文件路径")
        if member.is_dir():
            target.mkdir(parents=True, exist_ok=True)
            continue
        target.parent.mkdir(parents=True, exist_ok=True)
        with package.open(member) as source, target.open("wb") as output:
            while chunk := source.read(1024 * 1024):
                extracted_bytes += len(chunk)
                if extracted_bytes > MAX_PLUGIN_ARCHIVE_UNCOMPRESSED_BYTES:
                    raise PluginArchiveError("插件包解压后的总大小不能超过 100 MB")
                output.write(chunk)

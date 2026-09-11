from __future__ import annotations

import logging

from sqlalchemy import select
from sqlalchemy.orm import Session

from app.datasources.credentials import CredentialDecryptError, decrypt_credential, encrypt_credential
from app.datasources.models import DataSource

logger = logging.getLogger("vitalspan.datasources")

_DEV_KNOWN_PASSWORDS: tuple[tuple[tuple[str, str], str], ...] = (
    (("mysql", "sample"), "sample"),
    (("postgresql", "vitalspan"), "vitalspan"),
    (("postgres", "vitalspan"), "vitalspan"),
)


def guess_dev_datasource_password(row: DataSource) -> str | None:
    """按 compose 样例源约定推断开发环境明文口令（非生产路径）。"""
    username = (row.username or "").strip().lower()
    ds_type = (row.type or "").strip().lower()
    for (typ, user), password in _DEV_KNOWN_PASSWORDS:
        if ds_type == typ and username == user:
            return password
    code = (row.code or "").strip().lower()
    if "mysql" in code and username == "sample":
        return "sample"
    if ("analytics" in code or "postgres" in code) and username == "vitalspan":
        return "vitalspan"
    return None


def repair_dev_datasource_credentials(session: Session) -> int:
    """development：Fernet 密钥轮换后，按 compose 默认口令重加密可识别的样例数据源。"""
    rows = session.scalars(select(DataSource).where(DataSource.deleted_at.is_(None))).all()
    repaired = 0
    for row in rows:
        try:
            decrypt_credential(row.password_encrypted)
            continue
        except CredentialDecryptError:
            pass
        plain = guess_dev_datasource_password(row)
        if plain is None:
            logger.warning(
                "dev_credential_repair_skipped code=%s type=%s username=%s",
                row.code,
                row.type,
                row.username,
            )
            continue
        row.password_encrypted = encrypt_credential(plain)
        repaired += 1
        logger.info("dev_credential_repair_applied code=%s", row.code)
    if repaired:
        session.commit()
    return repaired

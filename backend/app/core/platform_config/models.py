from __future__ import annotations

import uuid
from datetime import datetime

from sqlalchemy import CheckConstraint, DateTime, ForeignKey, Integer, String, Text, Uuid, func
from sqlalchemy.orm import Mapped, mapped_column

from app.auth.models import Base
from app.core.platform_config.slots import CHANNEL_EMAIL_QQ, CHANNEL_EMAIL_163

EMAIL_CHANNEL = CHANNEL_EMAIL_QQ
AUDIT_TARGET_EMAIL_QQ = uuid.UUID("00000000-0000-4000-8000-0000000000e1")
AUDIT_TARGET_EMAIL_163 = uuid.UUID("00000000-0000-4000-8000-0000000000e2")
AUDIT_TARGET_BY_CHANNEL = {
    CHANNEL_EMAIL_QQ: AUDIT_TARGET_EMAIL_QQ,
    CHANNEL_EMAIL_163: AUDIT_TARGET_EMAIL_163,
}


class PlatformDeliveryConfig(Base):
    __tablename__ = "platform_delivery_configs"
    __table_args__ = (
        CheckConstraint(
            "state IN ('active', 'cleared')",
            name="ck_platform_delivery_configs_state",
        ),
        CheckConstraint(
            "channel IN ('email_qq', 'email_163')",
            name="ck_platform_delivery_configs_channel",
        ),
    )

    channel: Mapped[str] = mapped_column(String(16), primary_key=True)
    state: Mapped[str] = mapped_column(String(16), nullable=False)
    host: Mapped[str | None] = mapped_column(String(255), nullable=True)
    port: Mapped[int | None] = mapped_column(Integer, nullable=True)
    from_addr: Mapped[str | None] = mapped_column(String(255), nullable=True)
    username: Mapped[str | None] = mapped_column(String(255), nullable=True)
    password_encrypted: Mapped[str | None] = mapped_column(Text, nullable=True)
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        server_default=func.now(),
        nullable=False,
    )
    updated_by: Mapped[uuid.UUID | None] = mapped_column(
        Uuid(),
        ForeignKey("auth_users.id", ondelete="SET NULL"),
        nullable=True,
    )

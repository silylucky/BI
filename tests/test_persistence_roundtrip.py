"""Persistence round-trip via Alembic-backed sqlite."""

from __future__ import annotations

import uuid
from datetime import UTC, datetime, timedelta

import pytest
from sqlalchemy.orm import Session

from app.auth.models import AuthRole, AuthUser, get_meta_engine
from app.dashboard import service as dash_service
from app.dashboard.global_filters.schemas import GlobalFilterLinkageItem
from app.dashboard.schemas import DashboardCreate, DashboardLayout
from app.integration import embed_token_repo
from app.views import role_defaults_repo


def test_role_defaults_repo_survives_engine_cache_clear(alembic_meta_engine):
    role_id = uuid.uuid4()
    dash_id = uuid.uuid4()
    with Session(alembic_meta_engine) as db:
        db.add(
            AuthRole(
                id=role_id,
                code="analyst_rt",
                name="Analyst RT",
                is_active=True,
                is_system=False,
                is_root=False,
            )
        )
        db.commit()
        role_defaults_repo.set_role_defaults(
            db,
            str(role_id),
            {"dashboardId": str(dash_id), "reportTemplateNodeId": None, "maxWidgetCount": 24},
        )

    get_meta_engine.cache_clear()
    with Session(get_meta_engine()) as db:
        stored = role_defaults_repo.get_role_defaults(db, str(role_id))

    assert stored is not None
    assert str(stored["dashboardId"]) == str(dash_id)


def test_dashboard_editor_save_roundtrip(alembic_meta_engine, monkeypatch):
    from app.auth.deps import UserContext
    from app.auth.models import AuthRole, AuthUserRole
    from app.auth.password.service import hash_password

    monkeypatch.setenv("DATABASE_URL", str(alembic_meta_engine.url))
    get_meta_engine.cache_clear()

    with Session(alembic_meta_engine) as db:
        admin_role = db.query(AuthRole).filter(AuthRole.code == "admin").first()
        if admin_role is None:
            admin_role = AuthRole(
                code="admin",
                name="Admin",
                is_active=True,
                is_system=True,
                is_root=True,
            )
            db.add(admin_role)
            db.flush()
        else:
            admin_role.is_root = True
            admin_role.is_active = True
        admin = db.query(AuthUser).filter(AuthUser.username == "admin").first()
        if admin is None:
            admin = AuthUser(
                username="admin",
                display_name="Admin",
                password_hash=hash_password("changeme"),
                is_active=True,
                token_version=1,
            )
            db.add(admin)
            db.flush()
        binding = db.get(AuthUserRole, {"user_id": admin.id, "role_id": admin_role.id})
        if binding is None:
            db.add(AuthUserRole(user_id=admin.id, role_id=admin_role.id))
        admin_id = uuid.UUID(str(admin.id))
        actor = UserContext(
            id=str(admin_id),
            username="admin",
            roles=["admin"],
            permissions=set(),
            is_root=True,
        )
        db.commit()

        created = dash_service.create_dashboard(
            db,
            DashboardCreate(name="Persist RT", slug=f"persist-rt-{uuid.uuid4().hex[:8]}"),
            created_by=admin_id,
        )
        dashboard_id = uuid.UUID(str(created.id))

        layout = DashboardLayout.model_validate(
            {
                "version": 2,
                "canvas": {"width": 1440, "height": 900},
                "widgets": [],
                "styleConfig": {
                    "canvasBackgroundImageFit": "contain",
                    "canvasBackgroundImagePosition": "center top",
                },
            }
        )
        filters = GlobalFilterLinkageItem(
            dashboard_id=dashboard_id,
            filters=[],
            linkage_rules=[],
            refresh_mode="eager",
        )
        saved = dash_service.save_editor_state(
            db,
            dashboard_id,
            name="Persist RT Updated",
            layout_json=layout,
            global_filters=filters,
            actor=actor,
        )

    assert saved.dashboard.name == "Persist RT Updated"
    assert saved.dashboard.layout_json.style_config.canvas_background_image_fit == "contain"

    get_meta_engine.cache_clear()
    with Session(get_meta_engine()) as db:
        reloaded = dash_service.get_dashboard(db, dashboard_id)

    assert reloaded.name == "Persist RT Updated"
    assert reloaded.layout_json.style_config.canvas_background_image_fit == "contain"


def test_embed_token_survives_new_session(alembic_meta_engine):
    token = f"test-token-{uuid.uuid4().hex}"
    expires = datetime.now(UTC) + timedelta(minutes=5)
    meta = {"container_id": "embed-x", "theme": "light", "api_base": "/api/v1", "actor_id": "u1"}

    with Session(alembic_meta_engine) as db:
        embed_token_repo.save_token(db, token, expires, meta)

    get_meta_engine.cache_clear()
    with Session(get_meta_engine()) as db:
        row = embed_token_repo.get_token(db, token)

    assert row is not None
    _exp, stored = row
    assert stored["container_id"] == "embed-x"


def test_artifact_owner_survives_engine_cache_clear(alembic_meta_engine, monkeypatch):
    from app.datasources.models import get_meta_engine
    from app.reports.persistence import artifact_repo

    monkeypatch.setenv("RPT_METADATA_STORE", "db")
    from app.core.config import get_settings

    get_settings.cache_clear()

    artifact_repo.register_owner("semi://reports/persist/1", "owner-persist")
    get_meta_engine.cache_clear()
    assert artifact_repo.get_owner("semi://reports/persist/1") == "owner-persist"

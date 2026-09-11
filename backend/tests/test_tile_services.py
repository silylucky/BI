from __future__ import annotations

import pytest
from sqlalchemy import create_engine
from sqlalchemy.orm import Session, sessionmaker

from app.auth.models import Base
from app.viz.tile_services.models import TileService
from app.viz.tile_services.schemas import TileServiceCreate
from app.viz.tile_services import service as tile_service


@pytest.fixture()
def db() -> Session:
    engine = create_engine("sqlite+pysqlite:///:memory:", future=True)
    Base.metadata.create_all(engine)
    session = sessionmaker(bind=engine, future=True)()
    try:
        yield session
    finally:
        session.close()


def test_resolve_tile_service(db: Session) -> None:
    row = TileService(
        id="planet-z15",
        name="Planet Z15",
        base_url="http://tiles.local:8080",
        pmtiles_path="/data/planet-z15.pmtiles",
        enabled=True,
    )
    db.add(row)
    db.commit()

    resolved = tile_service.resolve_tile_service(db, "planet-z15")
    assert resolved.pmtiles_url == "http://tiles.local:8080/data/planet-z15.pmtiles"
    assert resolved.glyphs_url == (
        "http://tiles.local:8080/basemaps-assets/fonts/{fontstack}/{range}.pbf"
    )
    assert resolved.sprite_url == "http://tiles.local:8080/basemaps-assets/sprites/v4/light"
    assert "jsdelivr" not in resolved.glyphs_url
    assert "github.io" not in resolved.glyphs_url
    dumped = resolved.model_dump(by_alias=True)
    assert dumped["pmtilesUrl"] == "http://tiles.local:8080/data/planet-z15.pmtiles"
    assert "pmtiles_url" not in dumped


def test_resolve_rewrites_public_cdn_assets_onto_tile_service(db: Session) -> None:
    row = TileService(
        id="planet-cdn",
        name="Planet",
        base_url="http://tiles.local:8080",
        pmtiles_path="/planet.pmtiles",
        glyphs_url_template=(
            "https://fastly.jsdelivr.net/gh/protomaps/basemaps-assets@main/"
            "fonts/{fontstack}/{range}.pbf"
        ),
        sprite_url="https://protomaps.github.io/basemaps-assets/sprites/v4/light",
        enabled=True,
    )
    db.add(row)
    db.commit()
    resolved = tile_service.resolve_tile_service(db, "planet-cdn")
    assert resolved.glyphs_url.startswith("http://tiles.local:8080/basemaps-assets/")
    assert resolved.sprite_url == "http://tiles.local:8080/basemaps-assets/sprites/v4/light"


def test_create_tile_service(db: Session) -> None:
    created = tile_service.create_tile_service(
        db,
        TileServiceCreate(
            id="demo",
            name="Demo",
            baseUrl="http://127.0.0.1:9000",
            pmtilesPath="/tiles/demo.pmtiles",
        ),
        updated_by=None,
    )
    assert created.id == "demo"
    listed = tile_service.list_tile_services(db)
    assert len(listed.items) == 1

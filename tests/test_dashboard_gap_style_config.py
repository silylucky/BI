"""Dashboard styleConfig gap field normalization."""

from app.dashboard.schemas import DashboardStyleConfig


def test_gap_preset_none_zeros_both_channels() -> None:
    cfg = DashboardStyleConfig.model_validate(
        {"gapPreset": "none", "widgetGap": 12, "pixelGutter": 5}
    )
    assert cfg.gap_preset == "none"
    assert cfg.widget_gap == 0
    assert cfg.pixel_gutter == 0


def test_gap_preset_md_syncs_pixel_gutter() -> None:
    cfg = DashboardStyleConfig.model_validate({"gapPreset": "md"})
    assert cfg.widget_gap == 8
    assert cfg.pixel_gutter == 5


def test_legacy_widget_gap_only_keeps_pixel_shell_none() -> None:
    cfg = DashboardStyleConfig.model_validate({"widgetGap": 8})
    assert cfg.gap_preset == "none"
    assert cfg.widget_gap == 8
    assert cfg.pixel_gutter == 0


def test_legacy_widget_gap_only_coerced_to_none_when_zero() -> None:
    cfg = DashboardStyleConfig.model_validate({"widgetGap": 0, "pixelGutter": 0})
    assert cfg.gap_preset == "none"


def test_none_roundtrip_persists_zero_channels() -> None:
    cfg = DashboardStyleConfig.model_validate(
        {
            "gapPreset": "none",
            "widgetGap": 0,
            "pixelGutter": 0,
            "colorScheme": "light",
        }
    )
    assert cfg.gap_preset == "none"
    assert cfg.widget_gap == 0
    assert cfg.pixel_gutter == 0
    again = DashboardStyleConfig.model_validate(cfg.model_dump(by_alias=True))
    assert again.gap_preset == "none"
    assert again.pixel_gutter == 0

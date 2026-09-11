"""内置模板演示 Dataset 改绑。"""

from app.dashboard.templates.presets_exported import load_exported_layout
from app.dashboard.templates.rebind_demo_encodings import encoding_for, rebind_layout_demo_encodings


def test_encoding_for_gov_efficiency_titles() -> None:
    dataset_id, dims, mets, axes = encoding_for("bar-stack-horizontal", "综合满意度")
    assert dataset_id == "demo-gov-grid-stats"
    assert dims == ["grid_name"]
    assert mets == ["event_count", "resolved_count"]
    assert axes["xAxis"] == ["grid_name"]

    dataset_id, dims, mets, _axes = encoding_for("gauge", "水质达标率")
    assert dataset_id == "demo-gov-grid-stats"
    assert dims == []
    assert mets == ["resolved_count"]

    dataset_id, dims, mets, _axes = encoding_for("bar-stack", "政务核心指标")
    assert dataset_id == "demo-gov-grid-stats"
    assert dims == ["grid_name"]
    assert mets == ["event_count", "resolved_count"]


def test_workspace_efficiency_layout_rebinds_sales_product_fields() -> None:
    layout = load_exported_layout("workspace-efficiency.json")
    charts = [w for w in layout["widgets"] if w.get("type") == "chart"]
    satisfaction = next(w for w in charts if w.get("title") == "综合满意度")
    cfg = satisfaction["chartConfig"]
    assert cfg["datasetId"] == "demo-gov-grid-stats"
    assert cfg["dimensions"][0]["field"] == "grid_name"
    assert {m["field"] for m in cfg["metrics"]} == {"event_count", "resolved_count"}

    gauge = next(w for w in charts if w.get("title") == "水质达标率")
    assert gauge["chartConfig"]["datasetId"] == "demo-gov-grid-stats"
    assert gauge["chartConfig"]["metrics"][0]["field"] == "resolved_count"


def test_rebind_clears_stale_config_id() -> None:
    layout = {
        "widgets": [
            {
                "id": "w1",
                "type": "chart",
                "title": "部门满意度",
                "chartConfig": {
                    "chartType": "bar",
                    "mode": "dataset",
                    "datasetId": "demo-sales-wide",
                    "configId": "stale-uuid",
                    "dimensions": [{"field": "product_name"}],
                    "metrics": [{"field": "amount"}],
                },
            },
        ],
    }
    rebound = rebind_layout_demo_encodings(layout)
    cfg = rebound["widgets"][0]["chartConfig"]
    assert cfg["datasetId"] == "demo-gov-grid-stats"
    assert cfg["configId"] is None
    assert cfg["dimensions"][0]["field"] == "grid_name"

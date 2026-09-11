from __future__ import annotations

import uuid

from sqlalchemy.orm import Session

from app.auth.deps import UserContext
from app.dashboard.schemas import DashboardLayout
from app.dashboard import service as dash_service
from app.dashboard.global_filters import service as global_filter_service
from app.dashboard.global_filters.errors import GlobalFilterError
from app.query.dataset.execute_config import execute_dataset_from_config
from app.query.dataset.schemas import DatasetExecuteRequest
from app.query.schemas import ExecuteResponse, QueryError, RlsOptions
from app.query.sql_parameters import build_widget_filter_params


def _find_widget(layout_json: DashboardLayout | dict, widget_id: str) -> dict:
    if isinstance(layout_json, DashboardLayout):
        for widget in layout_json.widgets:
            if str(widget.id) == widget_id:
                return widget.model_dump(by_alias=True, mode="json")
        raise GlobalFilterError("DASH_FILTER_WIDGET_NOT_FOUND", f"Widget not found: {widget_id}", 404)
    for widget in layout_json.get("widgets") or []:
        if str(widget.get("id")) == widget_id:
            return widget
    raise GlobalFilterError("DASH_FILTER_WIDGET_NOT_FOUND", f"Widget not found: {widget_id}", 404)


def execute_widget_with_filters(
    session: Session,
    dashboard_id: uuid.UUID,
    widget_id: str,
    filter_values: dict[str, str],
    actor: UserContext,
) -> ExecuteResponse:
    dashboard = dash_service.get_dashboard(session, dashboard_id)
    dash_service.assert_dashboard_access(
        session, actor, dashboard_id, dashboard.created_by, slug=dashboard.slug,
    )
    widget = _find_widget(dashboard.layout_json, widget_id)
    chart = widget.get("chartConfig") or {}
    dataset_id = chart.get("datasetId")
    config_id = chart.get("configId")
    data_source_id = chart.get("dataSourceId")
    if not dataset_id or not config_id or not data_source_id:
        raise GlobalFilterError(
            "DASH_FILTER_DATASET_REQUIRED",
            "全局筛选联动要求图表已绑定 Dataset 与查询配置",
            422,
        )
    linkage_item = global_filter_service._load_linkage_payload(session, dashboard_id)
    linkage = linkage_item.model_dump(by_alias=True)
    params = build_widget_filter_params(widget_id, linkage, filter_values)
    try:
        result = execute_dataset_from_config(
            session,
            actor,
            DatasetExecuteRequest(
                dataSourceId=uuid.UUID(str(data_source_id)),
                configId=uuid.UUID(str(config_id)),
                parameters=params,
                limit=100,
                offset=0,
                rls=RlsOptions(enabled=False),
            ),
        )
    except QueryError as exc:
        raise GlobalFilterError(exc.code, exc.message, exc.status) from exc
    return ExecuteResponse(
        columns=result.columns,
        rows=result.rows,
        row_count=result.row_count,
        truncated=result.truncated,
        trace_id=result.trace_id,
    )

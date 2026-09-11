from __future__ import annotations

from dataclasses import dataclass
from typing import Any


@dataclass(frozen=True)
class AppendixECategory:
    code: str
    name: str
    kind: str
    description: str
    example_api: str


APPENDIX_E_TAXONOMY: tuple[AppendixECategory, ...] = (
    AppendixECategory("CAT-01", "实体生命周期查询类", "entity", "可配置实体类型之状态与关系查询", "GET /api/v1/entities/{entityType}/{entityId}"),
    AppendixECategory("CAT-02", "统计分析聚合类", "aggregate", "按地域/时间/分类维度的聚合统计", "GET /api/v1/stats/aggregate"),
    AppendixECategory("CAT-03", "地域维度查询类", "geo", "服务区域、GIS 分布、地域下钻", "GET /api/v1/geo/distribution"),
    AppendixECategory("CAT-04", "时间序列分析类", "timeseries", "日/周/月/同比环比时序数据", "GET /api/v1/timeseries"),
    AppendixECategory("CAT-05", "工单与业务受理类", "ticket", "工单类业务统计与明细", "GET /api/v1/tickets/stats"),
    AppendixECategory("CAT-06", "生产与销售统计类", "production", "厂商/型号等生产销售统计", "GET /api/v1/production/stats"),
    AppendixECategory("CAT-07", "组织行为审计类", "audit", "操作主体登录、行为、层级查询", "GET /api/v1/workno/behavior"),
)


def export_appendix_e_schema() -> dict[str, Any]:
    return {
        "$id": "vitalspan://gov/appendix-e/v1",
        "type": "object",
        "required": ["code", "name", "kind", "description", "exampleApi", "status"],
        "properties": {
            "code": {"type": "string", "pattern": "^CAT-0[1-7]$"},
            "name": {"type": "string"},
            "kind": {"type": "string"},
            "description": {"type": "string"},
            "exampleApi": {"type": "string"},
            "status": {"type": "string", "const": "suggested"},
        },
    }


def taxonomy_as_dicts() -> list[dict[str, str]]:
    return [
        {
            "code": c.code,
            "name": c.name,
            "kind": c.kind,
            "description": c.description,
            "exampleApi": c.example_api,
            "status": "suggested",
        }
        for c in APPENDIX_E_TAXONOMY
    ]

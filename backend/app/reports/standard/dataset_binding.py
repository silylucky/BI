"""标准分析包 → Dataset + dataset_query 绑定（报表出数经 Dataset execute）。"""

from __future__ import annotations

import uuid

from sqlalchemy.orm import Session

from app.metadata.dataset.models import DatasetRecord
from app.reports.standard.errors import RPT_STD_DATASET_NOT_FOUND, RPT_STD_DATASET_UNBOUND, StandardAnalysisError
from app.reports.standard.schemas import AnalysisPackOut


def ensure_analysis_pack_dataset_binding(db: Session, pack: AnalysisPackOut) -> uuid.UUID:
    """返回分析包出数用的 bound_config_id（pack 须已绑定 datasetId）。"""
    if not pack.dataset_id:
        raise StandardAnalysisError(
            RPT_STD_DATASET_NOT_FOUND,
            "Analysis pack must bind a dataset",
            422,
        )
    row = db.get(DatasetRecord, pack.dataset_id)
    if row is None:
        raise StandardAnalysisError(RPT_STD_DATASET_NOT_FOUND, "Dataset not found", 404)
    bound_id = pack.bound_config_id or row.bound_config_id
    if bound_id is None:
        raise StandardAnalysisError(RPT_STD_DATASET_UNBOUND, "Dataset has no bound query config", 422)
    return bound_id

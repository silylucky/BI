from __future__ import annotations


def user_visible_export_error(exc: Exception) -> str:
    from app.reports.engine.errors import ReportEngineError
    from app.reports.scheduler.errors import ScheduleError

    if isinstance(exc, (ReportEngineError, ScheduleError)):
        return exc.message
    return "导出失败，请稍后重试或联系管理员"

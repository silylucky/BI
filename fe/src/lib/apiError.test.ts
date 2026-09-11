import { describe, expect, it } from "vitest";
import { ApiRequestError } from "@/lib/api";
import { localizeApiMessage, getApiValidationFieldErrors, mapApiError } from "./apiError";

describe("mapApiError", () => {
  it("maps DATASOURCE_NOT_FOUND by code", () => {
    const err = new ApiRequestError("Data source not found", "DATASOURCE_NOT_FOUND");
    expect(mapApiError(err)).toBe("数据源不存在");
  });

  it("maps English message by exact match", () => {
    expect(localizeApiMessage("Data source not found")).toBe("数据源不存在");
  });

  it("maps connection test success message", () => {
    expect(localizeApiMessage("Connection successful")).toBe("数据库连接正常");
  });

  it("maps QUERY_CHART_INVALID_FIELD by code", () => {
    const err = new ApiRequestError("unknown field: metric_code", "QUERY_CHART_INVALID_FIELD");
    expect(mapApiError(err)).toBe(
      "图表使用了当前数据集不存在的字段，请检查时间范围或筛选配置",
    );
  });

  it("maps unknown field prefix in message", () => {
    expect(localizeApiMessage("unknown field: sale_date")).toBe(
      "字段「sale_date」不存在于当前数据集，请检查时间范围或筛选配置",
    );
  });
  it("maps QUERY_TIMEOUT from Error with code property", () => {
    const err = Object.assign(new Error("Query timed out"), { code: "QUERY_TIMEOUT" });
    expect(mapApiError(err)).toBe("查询超时，请缩小数据范围");
  });

  it("maps VALIDATION_ERROR with field hint", () => {
    const err = new ApiRequestError("body.layoutJson.canvas.height: ge", "VALIDATION_ERROR", [
      { field: "body.layoutJson.canvas.height", message: "Input should be greater than or equal to 900" },
    ]);
    expect(mapApiError(err)).toContain("画布高度不能低于 900");
  });

  it("maps paletteOpacity range validation", () => {
    const err = new ApiRequestError("body.layoutJson.styleConfig.paletteOpacity: le", "VALIDATION_ERROR", [
      {
        field: "body.layoutJson.styleConfig.paletteOpacity",
        message: "Input should be less than or equal to 1",
      },
    ]);
    expect(mapApiError(err)).toContain("配色不透明度");
  });

  it("maps RPT_ENGINE_INCOMPLETE_TEMPLATE by code", () => {
    const err = new ApiRequestError(
      "请先在「扩展配置」中添加指标并保存后再导出",
      "RPT_ENGINE_INCOMPLETE_TEMPLATE",
    );
    expect(mapApiError(err)).toBe("请先在「扩展配置」中添加指标并保存后再导出");
  });

  it("maps feishu unauthorized scope to Chinese", () => {
    expect(
      localizeApiMessage("Unauthorized. contact:user.employee_id:readonly"),
    ).toContain("飞书");
  });

  it("falls back to generic message for unknown English", () => {
    expect(mapApiError(new Error("Something went wrong"))).toBe("操作失败，请稍后重试");
  });

  it("maps postgres relation missing to readable Chinese", () => {
    expect(
      localizeApiMessage('relation "ops_tsdb.cache_inval_extension" does not exist'),
    ).toBe("源表不存在，请检查 Schema 与表名是否正确");
  });

  it("preserves Chinese messages", () => {
    expect(mapApiError(new Error("查询失败"))).toBe("查询失败");
  });

  it("maps schedule_cron validation with friendly field label", () => {
    const err = new ApiRequestError("body.schedule_cron: Value error", "VALIDATION_ERROR", [
      { field: "body.schedule_cron", message: "Value error, Cron 表达式格式无效" },
    ]);
    expect(mapApiError(err)).toBe("Cron 表达式格式无效（定时 Cron）");
  });

  it("extracts field errors from validation response", () => {
    const err = new ApiRequestError("body.schedule_cron: Value error", "VALIDATION_ERROR", [
      { field: "body.schedule_cron", message: "Value error, Cron 表达式格式无效" },
    ]);
    expect(getApiValidationFieldErrors(err)).toEqual({
      schedule_cron: "Cron 表达式格式无效",
    });
  });
});

import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";
import { DatasourceTestStatus } from "./DatasourceTestStatus";

describe("DatasourceTestStatus", () => {
  afterEach(() => cleanup());
  it("shows green success state with localized message", () => {
    render(
      <DatasourceTestStatus
        error={null}
        result={{
          ok: true,
          message: "Connection successful",
          latencyMs: 39,
          traceId: "trace-1",
        }}
        layout="card"
      />,
    );
    expect(screen.getByRole("status")).toHaveTextContent("连接测试成功");
    expect(screen.getByRole("status")).toHaveTextContent("数据库连接正常");
    expect(screen.getByRole("status")).not.toHaveTextContent("操作失败");
    expect(screen.getByRole("status").className).toMatch(/success/);
  });

  it("shows red failure state", () => {
    render(
      <DatasourceTestStatus
        error={null}
        result={{
          ok: false,
          message: "[TIMESCALE_EXTENSION_MISSING] timescaledb extension not installed",
          code: "TIMESCALE_EXTENSION_MISSING",
        }}
        layout="card"
      />,
    );
    expect(screen.getByRole("alert")).toHaveTextContent("连接测试失败");
    expect(screen.getByRole("alert").className).toMatch(/error/);
  });

  it("maps REST_API_PROBE_FAILED to actionable hint", () => {
    render(
      <DatasourceTestStatus
        error={null}
        result={{
          ok: false,
          message: "[REST_API_PROBE_FAILED] getaddrinfo failed",
          code: "REST_API_PROBE_FAILED",
        }}
        layout="inline"
      />,
    );
    expect(screen.getByText(/127\.0\.0\.1:8000/)).toBeInTheDocument();
    expect(screen.queryByText("操作失败，请稍后重试")).not.toBeInTheDocument();
  });
});

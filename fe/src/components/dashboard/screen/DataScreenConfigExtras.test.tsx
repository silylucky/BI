import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { DataScreenConfigExtras } from "./DataScreenConfigExtras";
import type { DashboardLayoutV2 } from "@/components/dashboard/layoutUtils";

afterEach(() => cleanup());

const baseLayout: DashboardLayoutV2 = {
  version: 2,
  canvas: { width: 2072, height: 1094 },
  widgets: [],
  globalFilters: [],
  styleConfig: { surfaceKind: "data-screen", colorScheme: "dark" },
};

describe("DataScreenConfigExtras canvas size", () => {
  it("commits width patch without stale height from closure", () => {
    const onCanvasSizeChange = vi.fn();
    render(
      <DataScreenConfigExtras
        layout={baseLayout}
        styleConfig={baseLayout.styleConfig!}
        widgets={[]}
        name="测试大屏"
        canSave
        presentationMode="fitWidth"
        onPresentationModeChange={vi.fn()}
        onCanvasSizeChange={onCanvasSizeChange}
      />,
    );

    const widthInput = screen.getByLabelText("宽度");
    fireEvent.change(widthInput, { target: { value: "1920" } });
    fireEvent.blur(widthInput);

    expect(onCanvasSizeChange).toHaveBeenCalledWith({ width: 1920 });
    expect(onCanvasSizeChange).not.toHaveBeenCalledWith(
      expect.objectContaining({ height: expect.any(Number) }),
    );
  });

  it("does not commit partial width while typing", () => {
    const onCanvasSizeChange = vi.fn();
    render(
      <DataScreenConfigExtras
        layout={baseLayout}
        styleConfig={baseLayout.styleConfig!}
        widgets={[]}
        name="测试大屏"
        canSave
        presentationMode="fitWidth"
        onPresentationModeChange={vi.fn()}
        onCanvasSizeChange={onCanvasSizeChange}
      />,
    );

    const widthInput = screen.getByLabelText("宽度");
    fireEvent.change(widthInput, { target: { value: "1" } });
    fireEvent.change(widthInput, { target: { value: "19" } });
    fireEvent.change(widthInput, { target: { value: "192" } });

    expect(onCanvasSizeChange).not.toHaveBeenCalled();

    fireEvent.change(widthInput, { target: { value: "1920" } });
    expect(onCanvasSizeChange).toHaveBeenCalledWith({ width: 1920 });
  });

  it("does not clamp intermediate digits before blur", () => {
    const onCanvasSizeChange = vi.fn();
    render(
      <DataScreenConfigExtras
        layout={{ ...baseLayout, canvas: { width: 1920, height: 1080 } }}
        styleConfig={baseLayout.styleConfig!}
        widgets={[]}
        name="测试大屏"
        canSave
        presentationMode="fitWidth"
        onPresentationModeChange={vi.fn()}
        onCanvasSizeChange={onCanvasSizeChange}
      />,
    );

    const widthInput = screen.getByLabelText("宽度");
    fireEvent.change(widthInput, { target: { value: "192" } });
    expect(onCanvasSizeChange).not.toHaveBeenCalled();
    expect(widthInput).toHaveValue("192");

    fireEvent.change(widthInput, { target: { value: "1923" } });
    expect(onCanvasSizeChange).toHaveBeenCalledWith({ width: 1923 });
  });

  it("applies 16:9 preset in one patch", () => {
    const onCanvasSizeChange = vi.fn();
    render(
      <DataScreenConfigExtras
        layout={baseLayout}
        styleConfig={baseLayout.styleConfig!}
        widgets={[]}
        name="测试大屏"
        canSave
        presentationMode="fitWidth"
        onPresentationModeChange={vi.fn()}
        onCanvasSizeChange={onCanvasSizeChange}
      />,
    );

    fireEvent.click(screen.getByRole("button", { name: "增加宽度" }));
    expect(onCanvasSizeChange).toHaveBeenCalledWith({ width: 2073 });
  });

  it("disables export actions when layout cannot be saved", () => {
    render(
      <DataScreenConfigExtras
        layout={baseLayout}
        styleConfig={baseLayout.styleConfig!}
        widgets={[]}
        name="测试大屏"
        canSave={false}
        presentationMode="fitWidth"
        onPresentationModeChange={vi.fn()}
        onCanvasSizeChange={vi.fn()}
      />,
    );

    expect(screen.getByRole("button", { name: "布局 JSON" })).toBeDisabled();
    expect(screen.getByRole("button", { name: /导出模板/ })).toBeDisabled();
  });
});

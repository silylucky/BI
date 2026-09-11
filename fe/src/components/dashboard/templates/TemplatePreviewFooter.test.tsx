import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { TemplatePreviewFooter } from "./TemplatePreviewFooter";

describe("TemplatePreviewFooter", () => {
  it("renders surface and trailing meta like component cards", () => {
    render(
      <TemplatePreviewFooter
        surfaceKind="dashboard"
        categoryKey="analytics"
        visibility="builtin"
        status="published"
      />,
    );
    expect(screen.getByText("仪表板")).toBeInTheDocument();
    expect(screen.getByText("分析 · 内置")).toBeInTheDocument();
  });
});

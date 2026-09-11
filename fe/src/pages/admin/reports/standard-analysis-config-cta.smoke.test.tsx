import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { MemoryRouter } from "react-router";
import { TooltipProvider } from "@/components/ui/tooltip";
import { StandardAnalysisConfigForm } from "./components/StandardAnalysisConfigForm";
import { createEmptyAnalysisPack } from "./components/standardAnalysisUi";

vi.mock("./components/ReportMetricDatasetFields", () => ({
  ReportMetricDatasetFields: () => <div data-testid="dataset-fields" />,
}));
vi.mock("./components/StandardAnalysisFieldMappingFields", () => ({
  StandardAnalysisFieldMappingFields: () => null,
}));
vi.mock("./components/StandardAnalysisThemeGrid", () => ({
  StandardAnalysisThemeGrid: () => null,
}));
vi.mock("./components/StandardSchedulePanel", () => ({
  StandardSchedulePanel: () => <div data-testid="schedule-panel" />,
}));

describe("StandardAnalysisConfigForm saved CTA", () => {
  afterEach(() => cleanup());

  it("links to schedules hub with standard tab and sourceKey after save", () => {
    const draft = {
      ...createEmptyAnalysisPack(),
      packKey: "equipment-overview",
      displayName: "设备标准分析",
      datasetId: "demo-daily-kpi",
    };
    const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } });
    render(
      <QueryClientProvider client={qc}>
        <TooltipProvider delayDuration={0}>
          <MemoryRouter>
            <StandardAnalysisConfigForm
              draft={draft}
              isCreating={false}
              editingKey="equipment-overview"
              columnOptions={[]}
              saving={false}
              deleting={false}
              isDraftDirty={false}
              showSavedHint
              onChange={() => undefined}
              onSave={async () => true}
              onDelete={() => undefined}
            />
          </MemoryRouter>
        </TooltipProvider>
      </QueryClientProvider>,
    );
    const link = screen.getByRole("link", { name: /前往调度与投递/ });
    expect(link).toHaveAttribute(
      "href",
      "/admin/reports/schedules?tab=standard&sourceKey=equipment-overview",
    );
  });
});

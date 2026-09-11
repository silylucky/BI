import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { DashboardPickerField } from "./DashboardPickerField";

vi.mock("@/lib/api", () => ({
  apiFetch: vi.fn(),
}));

import { apiFetch } from "@/lib/api";

function renderPicker(ui: React.ReactElement) {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(<QueryClientProvider client={client}>{ui}</QueryClientProvider>);
}

describe("DashboardPickerField", () => {
  it("disambiguates duplicate unnamed dashboards in trigger label", async () => {
    vi.mocked(apiFetch).mockResolvedValue({
      items: [
        {
          id: "aaaaaaaa-1111-4000-8000-000000000001",
          name: "未命名看板",
          slug: "dash-1",
          updatedAt: "2026-07-01T10:00:00Z",
          layoutJson: { version: 2, widgets: [{ id: "w1" }] },
        },
        {
          id: "bbbbbbbb-2222-4000-8000-000000000002",
          name: "未命名看板",
          slug: "dash-2",
          updatedAt: "2026-07-02T10:00:00Z",
          layoutJson: { version: 2, widgets: [] },
        },
      ],
      total: 2,
      limit: 100,
      offset: 0,
    });

    renderPicker(
      <DashboardPickerField
        value="aaaaaaaa-1111-4000-8000-000000000001"
        onChange={vi.fn()}
      />,
    );

    expect(await screen.findByText(/未命名看板 · aaaaaaaa/)).toBeInTheDocument();
  });

  it("shows empty state when no dashboards", async () => {
    vi.mocked(apiFetch).mockResolvedValue({ items: [], total: 0, limit: 100, offset: 0 });

    renderPicker(<DashboardPickerField onChange={vi.fn()} />);

    expect(await screen.findByText(/暂无可用看板/)).toBeInTheDocument();
  });
});

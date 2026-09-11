import { cleanup, render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { MemoryRouter } from "react-router";
import { afterEach, describe, expect, it, vi } from "vitest";
import { CreateVizComponentDialog } from "./CreateVizComponentDialog";

vi.mock("@/lib/vizComponents", () => ({
  createVizComponent: vi.fn(),
  VIZ_COMPONENT_CATEGORIES: [{ key: "general", label: "通用" }],
}));

vi.mock("@/lib/chartRegistry", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/lib/chartRegistry")>();
  return {
    ...actual,
    fetchChartTypeCatalog: vi.fn(async () => [
      { type: "bar", displayName: "基础柱状图", library: "d3", paletteCategory: "compare" },
      { type: "line", displayName: "基础折线图", library: "d3", paletteCategory: "trend" },
    ]),
  };
});

vi.mock("@/lib/aiVizArtifacts", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/lib/aiVizArtifacts")>();
  return {
    ...actual,
    fetchAiVizArtifacts: vi.fn(async () => ({
      items: [
        {
          artifactId: "art-hub-1",
          manifest: { displayName: "Hub 排名条", id: "ranking-strip" },
          status: "active",
          contentHash: "abc",
        },
      ],
    })),
    deleteAiVizArtifact: vi.fn(async () => undefined),
  };
});

vi.mock("@/context/auth-context", () => ({
  useAuth: () => ({
    user: { username: "editor", roles: ["admin"], permissions: ["dashboard:edit"] },
  }),
}));

vi.stubGlobal(
  "IntersectionObserver",
  vi.fn(() => ({
    observe: vi.fn(),
    disconnect: vi.fn(),
    unobserve: vi.fn(),
  })),
);

describe("CreateVizComponentDialog", () => {
  function renderDialog() {
    const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
    return render(
      <QueryClientProvider client={client}>
        <MemoryRouter>
          <CreateVizComponentDialog open onOpenChange={vi.fn()} />
        </MemoryRouter>
      </QueryClientProvider>,
    );
  }

  afterEach(() => {
    cleanup();
  });

  it("expands chart catalog when chart widget type is selected", async () => {
    renderDialog();

    const popover = await screen.findByTestId("chart-picker-popover");
    expect(await within(popover).findByRole("button", { name: /基础折线图/i })).toBeInTheDocument();
  });

  it("selects custom viz artifact from chart picker and enables create", async () => {
    const user = userEvent.setup();
    renderDialog();
    const popover = await screen.findByTestId("chart-picker-popover");

    await user.click(within(popover).getByRole("button", { name: "自定义" }));
    await user.click(await within(popover).findByTestId("custom-viz-tile-art-hub-1"));
    expect(await screen.findByText(/已选：Hub 排名条/)).toBeInTheDocument();
    expect(await within(popover).findByTestId("custom-viz-tile-art-hub-1")).toHaveAttribute(
      "aria-pressed",
      "true",
    );

    const createButton = screen.getByRole("button", { name: /创建并编辑/i });
    expect(createButton).not.toBeDisabled();
  });

  it("exposes a dedicated custom viz widget type", async () => {
    const user = userEvent.setup();
    renderDialog();
    await user.click(screen.getByRole("button", { name: "自定义组件" }));
    expect(await screen.findByTestId("chart-picker-popover")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "自定义组件" })).toBeInTheDocument();
  });
});

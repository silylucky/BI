import { beforeEach, afterEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { GlobalFilterBar } from "./GlobalFilterBar";
import { FilterControl } from "./FilterWidgetControls";
import { FilterWidget } from "./FilterWidget";
import { defaultFilterConfig } from "./layoutUtils";

vi.mock("@/lib/api", () => ({
  apiFetch: vi.fn(),
  ApiRequestError: class ApiRequestError extends Error {
    code?: string;
    constructor(message: string, code?: string) {
      super(message);
      this.code = code;
    }
  },
}));

import { apiFetch } from "@/lib/api";

const mockApiFetch = vi.mocked(apiFetch);

describe("FilterControl / GlobalFilterBar", () => {
  beforeEach(() => {
    mockApiFetch.mockReset();
  });

  afterEach(() => {
    cleanup();
  });

  it("renders select control and emits change", async () => {
    const onChange = vi.fn();
    render(
      <FilterControl
        id="c1"
        label="区域"
        controlType="select"
        value=""
        options={[
          { label: "华东", value: "east" },
          { label: "华北", value: "north" },
        ]}
        onChange={onChange}
      />,
    );
    expect(screen.getByLabelText("区域")).toBeInTheDocument();
    await userEvent.click(screen.getByRole("combobox"));
    await userEvent.click(await screen.findByText("华东"));
    expect(onChange).toHaveBeenCalledWith("east");
  });

  it("renders date input", () => {
    render(
      <FilterControl id="d1" label="日期" controlType="date" value="2026-07-10" onChange={() => {}} />,
    );
    expect(screen.getByLabelText("日期")).toHaveAttribute("type", "date");
  });

  it("GlobalFilterBar uses select when controlType/options present", async () => {
    mockApiFetch.mockResolvedValue({
      filters: [
        {
          filterId: "f1",
          dimensionRef: "区域",
          controlType: "select",
          options: [
            { label: "华东", value: "east" },
            { label: "华北", value: "north" },
          ],
        },
      ],
      linkageRules: [],
      refreshMode: "eager",
    });
    const onChange = vi.fn();
    const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } });
    render(
      <QueryClientProvider client={qc}>
        <GlobalFilterBar dashboardId="d1" values={{}} onChange={onChange} />
      </QueryClientProvider>,
    );
    expect(await screen.findByLabelText("区域")).toBeInTheDocument();
    expect(screen.queryByRole("textbox")).not.toBeInTheDocument();
  });

  it("GlobalFilterBar lazy mode defers onChange until apply", async () => {
    const user = userEvent.setup();
    mockApiFetch.mockImplementation(async () => ({
      filters: [
        {
          filterId: "f1",
          dimensionRef: "区域",
          controlType: "text",
          defaultValue: "all",
        },
      ],
      linkageRules: [],
      refreshMode: "lazy",
    }));
    const onChange = vi.fn();
    const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } });
    render(
      <QueryClientProvider client={qc}>
        <GlobalFilterBar dashboardId="d1" values={{ f1: "all" }} onChange={onChange} />
      </QueryClientProvider>,
    );
    await screen.findByRole("button", { name: "应用筛选" });
    const input = screen.getByLabelText("区域");
    fireEvent.change(input, { target: { value: "east" } });
    expect(onChange).not.toHaveBeenCalled();
    await user.click(screen.getByRole("button", { name: "应用筛选" }));
    expect(onChange).toHaveBeenCalledWith("f1", "east");
  });

  it("FilterWidget renders text control and propagates value", async () => {
    const onValueChange = vi.fn();
    const filterConfig = defaultFilterConfig("f1");
    render(
      <FilterWidget
        widget={{
          id: "w1",
          type: "filter",
          title: "区域筛选",
          colSpan: 4,
          rowSpan: 2,
          order: 0,
          filterConfig,
        }}
        mode="view"
        value=""
        onValueChange={onValueChange}
      />,
    );
    const input = screen.getByLabelText("区域筛选");
    await userEvent.type(input, "east");
    expect(onValueChange).toHaveBeenCalled();
    expect(onValueChange.mock.calls.at(-1)?.[0]).toBe("f1");
  });
});

import { act, cleanup, fireEvent, render, screen, within } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { PageErrorBanner } from "./page-error-banner";

describe("PageErrorBanner", () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    cleanup();
    vi.useRealTimers();
  });

  it("renders inline alert in document flow", () => {
    render(
      <div data-testid="page-root">
        <PageErrorBanner message="测试错误" onRetry={() => undefined} />
      </div>,
    );

    expect(screen.getByRole("alert")).toHaveTextContent("测试错误");
    expect(screen.getByRole("button", { name: "重试" })).toBeInTheDocument();
    expect(screen.getByTestId("page-root").children).toHaveLength(1);
  });

  it("dismisses on close and calls onDismiss", () => {
    const onDismiss = vi.fn();

    render(<PageErrorBanner message="可关闭" onRetry={() => undefined} onDismiss={onDismiss} />);

    const alert = screen.getByRole("alert");
    fireEvent.click(within(alert).getByRole("button", { name: "关闭" }));

    expect(screen.queryByRole("alert")).not.toBeInTheDocument();
    expect(onDismiss).toHaveBeenCalledTimes(1);
  });

  it("auto-hides after default duration", () => {
    const onDismiss = vi.fn();

    render(
      <PageErrorBanner message="自动消失" onRetry={() => undefined} onDismiss={onDismiss} />,
    );

    act(() => {
      vi.advanceTimersByTime(8_000);
    });

    expect(screen.queryByRole("alert")).not.toBeInTheDocument();
    expect(onDismiss).toHaveBeenCalledTimes(1);
  });

  it("reappears when message changes", () => {
    const { rerender } = render(
      <PageErrorBanner message="错误 A" onRetry={() => undefined} autoHideMs={0} />,
    );

    const alert = screen.getByRole("alert");
    act(() => {
      within(alert).getByRole("button", { name: "关闭" }).click();
    });
    expect(screen.queryByRole("alert")).not.toBeInTheDocument();

    rerender(<PageErrorBanner message="错误 B" onRetry={() => undefined} autoHideMs={0} />);
    expect(screen.getByRole("alert")).toHaveTextContent("错误 B");
  });
});

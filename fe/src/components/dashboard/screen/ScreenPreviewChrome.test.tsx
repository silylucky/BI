import { describe, expect, it, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router";
import { ScreenPreviewChrome } from "./ScreenPreviewChrome";

function renderChrome(isFullscreen = false) {
  return render(
    <MemoryRouter>
      <ScreenPreviewChrome
        title="测试大屏"
        editPath="/admin/data-screens/1/edit"
        presentationMode="fit"
        onPresentationModeChange={vi.fn()}
        isFullscreen={isFullscreen}
        onFullscreen={vi.fn()}
      />
    </MemoryRouter>,
  );
}

describe("ScreenPreviewChrome", () => {
  it("shows enter fullscreen label by default", () => {
    renderChrome(false);
    expect(screen.getByRole("button", { name: "全屏" })).toHaveTextContent("全屏");
  });

  it("shows exit fullscreen label when active", () => {
    renderChrome(true);
    expect(screen.getByRole("button", { name: "退出全屏" })).toHaveTextContent("退出全屏");
  });
});

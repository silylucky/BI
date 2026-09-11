import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { cleanup, render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { TooltipProvider } from "@/components/ui/tooltip";

const mockApiFetch = vi.fn();
vi.mock("@/lib/api", () => ({ apiFetch: (...args: unknown[]) => mockApiFetch(...args) }));

import { PlatformConnectPage } from "./PlatformConnectPage";

function renderPage() {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(
    <QueryClientProvider client={qc}>
      <TooltipProvider delayDuration={0}>
        <MemoryRouter>
          <PlatformConnectPage />
        </MemoryRouter>
      </TooltipProvider>
    </QueryClientProvider>,
  );
}

describe("PlatformConnectPage smoke", () => {
  beforeEach(() => {
    mockApiFetch.mockReset();
    mockApiFetch.mockResolvedValue({
      items: [
        {
          slot: "qq",
          label: "QQ 邮箱",
          configured: false,
          source: "none",
          hasPassword: false,
        },
      ],
    });
  });
  afterEach(() => cleanup());

  it("shows scope banner for email SMTP", async () => {
    renderPage();
    const hint = await screen.findByTestId("platform-connect-scope-hint");
    expect(hint).toHaveTextContent("邮件 SMTP");
    expect(hint).toHaveTextContent("邮箱地址");
  });

  it("renders email channel pickers", async () => {
    renderPage();
    expect(await screen.findByText("邮件发信")).toBeInTheDocument();
    expect(screen.getByText("QQ 邮箱")).toBeInTheDocument();
    expect(screen.queryByText("飞书")).not.toBeInTheDocument();
    expect(screen.queryByText("钉钉")).not.toBeInTheDocument();
  });
});

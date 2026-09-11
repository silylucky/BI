import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { cleanup, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { TooltipProvider } from "@/components/ui/tooltip";
import { ApiRequestError } from "@/lib/api";
import { ChangePasswordSection } from "./ChangePasswordSection";

const mockApiFetch = vi.fn();
const mockToastSuccess = vi.fn();
const mockLogout = vi.fn();

vi.mock("@/lib/api", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/lib/api")>();
  return {
    ...actual,
    apiFetch: (...args: unknown[]) => mockApiFetch(...args),
  };
});

vi.mock("@/context/auth-context", () => ({
  useAuth: () => ({ logout: mockLogout }),
}));

vi.mock("sonner", () => ({
  toast: {
    success: (...args: unknown[]) => mockToastSuccess(...args),
  },
}));

function wrap(ui: React.ReactNode) {
  const qc = new QueryClient({ defaultOptions: { mutations: { retry: false } } });
  return (
    <TooltipProvider delayDuration={0}>
      <QueryClientProvider client={qc}>{ui}</QueryClientProvider>
    </TooltipProvider>
  );
}

const VALID_FORM = {
  currentPassword: "old-pass-1",
  newPassword: "new-pass-12",
  confirmPassword: "new-pass-12",
};

type PasswordInputId = "current-password" | "new-password" | "confirm-password";

function getPasswordInput(id: PasswordInputId) {
  const input = document.getElementById(id);
  if (!(input instanceof HTMLInputElement)) {
    throw new Error(`Expected password input #${id}`);
  }
  return input;
}

async function fillValidForm(user: ReturnType<typeof userEvent.setup>) {
  await user.type(getPasswordInput("current-password"), VALID_FORM.currentPassword);
  await user.type(getPasswordInput("new-password"), VALID_FORM.newPassword);
  await user.type(getPasswordInput("confirm-password"), VALID_FORM.confirmPassword);
}

describe("ChangePasswordSection", () => {
  beforeEach(() => {
    mockApiFetch.mockReset();
    mockToastSuccess.mockReset();
    mockLogout.mockReset();
    mockApiFetch.mockResolvedValue(undefined);
  });

  afterEach(() => {
    cleanup();
    vi.clearAllMocks();
  });

  it("renders required fields, rules, and helper associations", () => {
    render(wrap(<ChangePasswordSection />));

    expect(getPasswordInput("current-password")).toBeInTheDocument();
    expect(getPasswordInput("new-password")).toBeInTheDocument();
    expect(getPasswordInput("confirm-password")).toBeInTheDocument();
    expect(screen.getByText("密码规则")).toBeInTheDocument();
    expect(screen.getByText("长度为 8–128 个字符")).toBeInTheDocument();
    expect(screen.getByText("不能与当前密码相同")).toBeInTheDocument();

    const newPassword = getPasswordInput("new-password");
    expect(newPassword).toHaveAttribute("aria-describedby", "new-password-helper");
  });

  it("toggles each password field visibility independently without clearing values", async () => {
    const user = userEvent.setup();
    render(wrap(<ChangePasswordSection />));

    const current = getPasswordInput("current-password");
    const next = getPasswordInput("new-password");
    const confirm = getPasswordInput("confirm-password");

    await user.type(current, "secret-1");
    await user.type(next, "secret-2");
    await user.type(confirm, "secret-2");

    const showCurrent = screen.getByRole("button", { name: "显示当前密码" });
    const showNext = screen.getByRole("button", { name: "显示新密码" });
    const showConfirm = screen.getByRole("button", { name: "显示确认新密码" });

    expect(showCurrent).toHaveAttribute("type", "button");
    expect(showNext).toHaveAttribute("type", "button");
    expect(showConfirm).toHaveAttribute("type", "button");

    await user.click(showCurrent);
    expect(current).toHaveAttribute("type", "text");
    expect(current).toHaveValue("secret-1");
    expect(screen.getByRole("button", { name: "隐藏当前密码" })).toHaveAttribute(
      "aria-pressed",
      "true",
    );

    await user.click(showNext);
    expect(next).toHaveAttribute("type", "text");
    expect(next).toHaveValue("secret-2");

    await user.click(showConfirm);
    expect(confirm).toHaveAttribute("type", "text");
    expect(confirm).toHaveValue("secret-2");
  });

  it("validates empty, length, same-password, and instant confirm mismatch", async () => {
    const user = userEvent.setup();
    render(wrap(<ChangePasswordSection />));

    await user.click(screen.getByRole("button", { name: "更新密码" }));
    expect(await screen.findByText("请填写当前密码")).toBeInTheDocument();
    expect(getPasswordInput("current-password")).toHaveAttribute("aria-invalid", "true");

    await user.type(getPasswordInput("current-password"), "old-pass-1");
    await user.type(getPasswordInput("new-password"), "short");
    await user.tab();
    expect(await screen.findByText("新密码至少需要 8 个字符")).toBeInTheDocument();

    await user.clear(getPasswordInput("new-password"));
    await user.type(getPasswordInput("new-password"), "a".repeat(129));
    await user.tab();
    expect(await screen.findByText("新密码不能超过 128 个字符")).toBeInTheDocument();

    await user.clear(getPasswordInput("new-password"));
    await user.type(getPasswordInput("new-password"), "old-pass-1");
    await user.tab();
    expect(await screen.findByText("新密码不能与当前密码相同")).toBeInTheDocument();

    await user.clear(getPasswordInput("new-password"));
    await user.type(getPasswordInput("new-password"), "new-pass-12");
    await user.type(getPasswordInput("confirm-password"), "new-pass-13");
    expect(await screen.findByText("两次输入的新密码不一致")).toBeInTheDocument();

    await user.clear(getPasswordInput("confirm-password"));
    await user.type(getPasswordInput("confirm-password"), "new-pass-12");
    await waitFor(() => {
      expect(screen.queryByText("两次输入的新密码不一致")).not.toBeInTheDocument();
    });
  });

  it("does not call api on invalid submit and focuses the first invalid field", async () => {
    const user = userEvent.setup();
    render(wrap(<ChangePasswordSection />));

    await user.click(screen.getByRole("button", { name: "更新密码" }));

    await waitFor(() => {
      expect(document.activeElement).toBe(getPasswordInput("current-password"));
    });
    expect(mockApiFetch).not.toHaveBeenCalled();
    expect(getPasswordInput("current-password")).toHaveAttribute("aria-invalid", "true");
  });

  it("submits valid payload with preserveSessionOn401Codes", async () => {
    const user = userEvent.setup();
    render(wrap(<ChangePasswordSection />));

    await fillValidForm(user);
    await user.click(screen.getByRole("button", { name: "更新密码" }));

    await waitFor(() => {
      expect(mockApiFetch).toHaveBeenCalledTimes(1);
    });

    expect(mockApiFetch).toHaveBeenCalledWith("/api/v1/auth/change-password", {
      method: "POST",
      body: JSON.stringify({
        currentPassword: VALID_FORM.currentPassword,
        newPassword: VALID_FORM.newPassword,
      }),
      preserveSessionOn401Codes: ["AUTH_INVALID_CURRENT_PASSWORD"],
    });
  });

  it("shows loading state and prevents duplicate submissions", async () => {
    const user = userEvent.setup();
    let resolveRequest: (() => void) | undefined;
    mockApiFetch.mockImplementation(
      () =>
        new Promise<void>((resolve) => {
          resolveRequest = resolve;
        }),
    );

    render(wrap(<ChangePasswordSection />));
    await fillValidForm(user);

    const submit = screen.getByRole("button", { name: "更新密码" });
    await user.click(submit);
    await user.click(submit);

    const busyButton = await screen.findByRole("button", { name: "保存中…" });
    expect(busyButton).toHaveAttribute("aria-busy", "true");
    expect(busyButton).toBeDisabled();
    expect(mockApiFetch).toHaveBeenCalledTimes(1);

    resolveRequest?.();
    await waitFor(() => {
      expect(screen.getByRole("button", { name: "更新密码" })).toBeInTheDocument();
    });
  });

  it("clears the form, shows re-login toast, and logs out after a successful submit", async () => {
    const user = userEvent.setup();
    render(wrap(<ChangePasswordSection />));

    await fillValidForm(user);
    await user.click(screen.getByRole("button", { name: "更新密码" }));

    await waitFor(() => {
      expect(mockToastSuccess).toHaveBeenCalledWith("密码已更新，请使用新密码重新登录");
    });
    expect(mockLogout).toHaveBeenCalledTimes(1);
    expect(getPasswordInput("current-password")).toHaveValue("");
    expect(getPasswordInput("new-password")).toHaveValue("");
    expect(getPasswordInput("confirm-password")).toHaveValue("");
    expect(screen.queryByText("请填写当前密码")).not.toBeInTheDocument();
  });

  it("maps AUTH_INVALID_CURRENT_PASSWORD to the current password field and preserves input", async () => {
    const user = userEvent.setup();
    mockApiFetch.mockRejectedValue(
      new ApiRequestError("当前密码不正确", "AUTH_INVALID_CURRENT_PASSWORD"),
    );

    render(wrap(<ChangePasswordSection />));
    await fillValidForm(user);
    await user.click(screen.getByRole("button", { name: "更新密码" }));

    expect(await screen.findByText("当前密码不正确")).toBeInTheDocument();
    expect(getPasswordInput("current-password")).toHaveValue(VALID_FORM.currentPassword);
    expect(getPasswordInput("new-password")).toHaveValue(VALID_FORM.newPassword);
    expect(getPasswordInput("confirm-password")).toHaveValue(VALID_FORM.confirmPassword);
    await waitFor(() => {
      expect(document.activeElement).toBe(getPasswordInput("current-password"));
    });
  });

  it("maps AUTH_PASSWORD_UNCHANGED to the new password field", async () => {
    const user = userEvent.setup();
    mockApiFetch.mockRejectedValue(
      new ApiRequestError("新密码不能与当前密码相同", "AUTH_PASSWORD_UNCHANGED"),
    );

    render(wrap(<ChangePasswordSection />));
    await fillValidForm(user);
    await user.click(screen.getByRole("button", { name: "更新密码" }));

    expect(await screen.findByText("新密码不能与当前密码相同")).toBeInTheDocument();
    expect(getPasswordInput("new-password")).toHaveAttribute("aria-invalid", "true");
    expect(getPasswordInput("current-password")).toHaveValue(VALID_FORM.currentPassword);
  });

  it("shows block-level actionable error for unknown failures and preserves input", async () => {
    const user = userEvent.setup();
    mockApiFetch.mockRejectedValue(new ApiRequestError("服务繁忙，请稍后重试", "SERVER_BUSY"));

    render(wrap(<ChangePasswordSection />));
    await fillValidForm(user);
    await user.click(screen.getByRole("button", { name: "更新密码" }));

    const alert = await screen.findByRole("alert");
    expect(alert).toHaveTextContent("服务繁忙，请稍后重试");
    expect(getPasswordInput("current-password")).toHaveValue(VALID_FORM.currentPassword);
  });

  it("does not submit when only visibility buttons are clicked", async () => {
    const user = userEvent.setup();
    render(wrap(<ChangePasswordSection />));

    await fillValidForm(user);
    await user.click(screen.getByRole("button", { name: "显示当前密码" }));
    await user.click(screen.getByRole("button", { name: "显示新密码" }));
    await user.click(screen.getByRole("button", { name: "显示确认新密码" }));
    expect(mockApiFetch).not.toHaveBeenCalled();

    await user.click(screen.getByRole("button", { name: "更新密码" }));
    await waitFor(() => {
      expect(mockApiFetch).toHaveBeenCalledTimes(1);
    });
  });
});

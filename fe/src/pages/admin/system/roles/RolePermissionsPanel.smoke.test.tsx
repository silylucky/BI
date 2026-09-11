import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { cleanup, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { RolePermissionsPanel } from "./RolePermissionsPanel";

const mockApiFetch = vi.fn();
vi.mock("@/lib/api", () => ({ apiFetch: (...args: unknown[]) => mockApiFetch(...args) }));
vi.mock("sonner", () => ({ toast: { success: vi.fn(), error: vi.fn() } }));

const ROLE_ID = "role-1";

function wrap(ui: React.ReactNode) {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return <QueryClientProvider client={qc}>{ui}</QueryClientProvider>;
}

describe("RolePermissionsPanel smoke", () => {
  beforeEach(() => {
    mockApiFetch.mockImplementation(async (path: unknown, init?: RequestInit) => {
      const p = String(path);
      if (p === "/api/v1/permissions") {
        return {
          items: [
            {
              id: "p1",
              code: "dashboard:read",
              name: "查看仪表板",
              domain: "dashboard",
              description: null,
            },
          ],
        };
      }
      if (p === `/api/v1/roles/${ROLE_ID}/permissions` && !init?.method) {
        return { roleId: ROLE_ID, permissionCodes: [], version: 0, allPermissions: false };
      }
      if (p === `/api/v1/roles/${ROLE_ID}/permissions` && init?.method === "PUT") {
        return {
          roleId: ROLE_ID,
          permissionCodes: ["dashboard:read"],
          version: 1,
          allPermissions: false,
        };
      }
      throw new Error(`unexpected: ${p}`);
    });
  });
  afterEach(() => cleanup());

  it("saves selected permission codes", async () => {
    const user = userEvent.setup();
    render(wrap(<RolePermissionsPanel roleId={ROLE_ID} roleName="分析师" />));

    await user.click(await screen.findByRole("checkbox", { name: "查看仪表板" }));
    await user.click(screen.getByRole("button", { name: "保存权限" }));

    await waitFor(() => {
      const putCall = mockApiFetch.mock.calls.find(
        (c) =>
          c[0] === `/api/v1/roles/${ROLE_ID}/permissions` &&
          (c[1] as RequestInit)?.method === "PUT",
      );
      expect(putCall).toBeTruthy();
      const body = JSON.parse(String((putCall![1] as RequestInit).body));
      expect(body.permissionCodes).toEqual(["dashboard:read"]);
      expect(body.expectedVersion).toBe(0);
    });
  });
});

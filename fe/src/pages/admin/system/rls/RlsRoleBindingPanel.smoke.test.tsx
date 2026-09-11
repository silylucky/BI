import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { cleanup, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { RlsRoleBindingPanel } from "./RlsRoleBindingPanel";

const mockApiFetch = vi.fn();
vi.mock("@/lib/api", () => ({ apiFetch: (...args: unknown[]) => mockApiFetch(...args) }));
vi.mock("sonner", () => ({ toast: { success: vi.fn(), error: vi.fn() } }));

const ROLE_ID = "role-1";
const GROUP_ID = "grp-1";

function wrap(ui: React.ReactNode) {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return <QueryClientProvider client={qc}>{ui}</QueryClientProvider>;
}

describe("RlsRoleBindingPanel", () => {
  beforeEach(() => {
    mockApiFetch.mockImplementation(async (path: unknown, init?: RequestInit) => {
      const p = String(path);
      if (p === "/api/v1/roles?limit=100&offset=0") {
        return {
          items: [{ id: ROLE_ID, code: "analyst", name: "分析师", isActive: true }],
          total: 1,
        };
      }
      if (p === `/api/v1/roles/${ROLE_ID}/dimension-groups` && !init?.method) {
        return { roleId: ROLE_ID, groupIds: [GROUP_ID], version: 2 };
      }
      if (p === `/api/v1/roles/${ROLE_ID}/dimension-groups` && init?.method === "PUT") {
        return { roleId: ROLE_ID, groupIds: [], version: 3 };
      }
      throw new Error(`unexpected: ${p} ${init?.method ?? "GET"}`);
    });
  });
  afterEach(() => cleanup());

  it("loads existing bindings when role selected", async () => {
    const user = userEvent.setup();
    render(
      wrap(
        <RlsRoleBindingPanel
          groups={[
            {
              id: GROUP_ID,
              dimension_type_id: "dim-1",
              code: "east",
              name: "华东",
              parent_id: null,
            },
          ]}
          groupsLoading={false}
        />,
      ),
    );

    await user.click(screen.getByLabelText("选择角色"));
    await user.click(await screen.findByRole("option", { name: /分析师/ }));

    await waitFor(() => {
      expect(mockApiFetch).toHaveBeenCalledWith(`/api/v1/roles/${ROLE_ID}/dimension-groups`);
    });
    const checkbox = await screen.findByRole("checkbox", { name: "绑定 华东" });
    expect(checkbox).toBeChecked();
  });

  it("save binding sends PUT with updated groupIds", async () => {
    const user = userEvent.setup();
    render(
      wrap(
        <RlsRoleBindingPanel
          groups={[
            {
              id: GROUP_ID,
              dimension_type_id: "dim-1",
              code: "east",
              name: "华东",
              parent_id: null,
            },
            {
              id: "grp-2",
              dimension_type_id: "dim-1",
              code: "west",
              name: "华西",
              parent_id: null,
            },
          ]}
          groupsLoading={false}
        />,
      ),
    );

    await user.click(screen.getByLabelText("选择角色"));
    await user.click(await screen.findByRole("option", { name: /分析师/ }));
    const west = await screen.findByRole("checkbox", { name: "绑定 华西" });
    await user.click(west);
    await user.click(screen.getByRole("button", { name: "保存绑定" }));

    await waitFor(() => {
      const putCall = mockApiFetch.mock.calls.find(
        (c) =>
          c[0] === `/api/v1/roles/${ROLE_ID}/dimension-groups` &&
          (c[1] as RequestInit)?.method === "PUT",
      );
      expect(putCall).toBeTruthy();
      const body = JSON.parse(String((putCall![1] as RequestInit).body));
      expect(body.groupIds).toEqual(expect.arrayContaining([GROUP_ID, "grp-2"]));
    });
  });
});

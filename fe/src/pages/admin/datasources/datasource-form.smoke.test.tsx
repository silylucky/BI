import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter, Route, Routes } from "react-router";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const mockApiFetch = vi.fn();
const mockNavigate = vi.fn();
vi.mock("@/lib/api", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/lib/api")>();
  return {
    ...actual,
    apiFetch: (...args: unknown[]) => mockApiFetch(...args),
  };
});
vi.mock("react-router", async (importOriginal) => {
  const actual = await importOriginal<typeof import("react-router")>();
  return {
    ...actual,
    useNavigate: () => mockNavigate,
  };
});
vi.mock("@/context/auth-context", () => ({
  useAuth: () => ({
    user: { id: "1", username: "admin", roles: ["admin"] },
    isLoading: false,
    isAuthenticated: true,
    logout: vi.fn(),
    refresh: vi.fn(async () => {}),
  }),
  AuthProvider: ({ children }: { children: React.ReactNode }) => children,
}));

import { ApiRequestError } from "@/lib/api";
import { TooltipProvider } from "@/components/ui/tooltip";
import { DatasourceFormPage } from "./DatasourceFormPage";

const MOCK_TYPES = {
  items: [
    { type: "mysql", displayName: "MySQL", category: "relational", capabilities: ["sql"], displayGroup: "oltp", categoryLabel: "关系型数据库" },
    { type: "dm", displayName: "达梦 DM", category: "relational", capabilities: ["sql"], displayGroup: "oltp", categoryLabel: "关系型数据库" },
    { type: "kingbase", displayName: "人大金仓 KingbaseES", category: "relational", capabilities: ["sql"], displayGroup: "oltp", categoryLabel: "关系型数据库" },
    { type: "gbase", displayName: "南大通用 GBase", category: "relational", capabilities: ["sql"], displayGroup: "oltp", categoryLabel: "关系型数据库" },
    { type: "oceanbase", displayName: "OceanBase", category: "relational", capabilities: ["sql"], displayGroup: "oltp", categoryLabel: "关系型数据库" },
    { type: "tidb", displayName: "TiDB", category: "relational", capabilities: ["sql"], displayGroup: "oltp", categoryLabel: "关系型数据库" },
    { type: "gaussdb", displayName: "GaussDB", category: "relational", capabilities: ["sql"], displayGroup: "oltp", categoryLabel: "关系型数据库" },
    { type: "rest_api", displayName: "REST API", category: "api", capabilities: ["api"], displayGroup: "api", categoryLabel: "API" },
    { type: "roapi", displayName: "RoAPI", category: "api", capabilities: ["api"], displayGroup: "api", categoryLabel: "API" },
    { type: "excel", displayName: "Excel", category: "file", capabilities: ["file"], displayGroup: "file", categoryLabel: "文件" },
    { type: "csv", displayName: "CSV", category: "file", capabilities: ["file"], displayGroup: "file", categoryLabel: "文件" },
    { type: "db2", displayName: "IBM Db2", category: "relational", capabilities: ["sql"], displayGroup: "oltp", categoryLabel: "关系型数据库" },
    { type: "impala", displayName: "Apache Impala", category: "lake", capabilities: ["sql"], displayGroup: "warehouse", categoryLabel: "数仓/湖仓" },
    { type: "redshift", displayName: "AWS Redshift", category: "olap", capabilities: ["sql"], displayGroup: "olap", categoryLabel: "OLAP" },
  ],
};

function renderForm() {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(
    <TooltipProvider delayDuration={0}>
      <QueryClientProvider client={qc}>
        <MemoryRouter initialEntries={["/admin/datasources/new"]}>
          <Routes>
            <Route path="/admin/datasources/new" element={<DatasourceFormPage mode="create" />} />
          </Routes>
        </MemoryRouter>
      </QueryClientProvider>
    </TooltipProvider>,
  );
}

async function selectType(categoryLabel: string, typeLabel: string) {
  const user = userEvent.setup();
  await waitFor(() => screen.getByRole("button", { name: new RegExp(categoryLabel) }));
  await user.click(screen.getByRole("button", { name: new RegExp(categoryLabel) }));
  await user.click(screen.getByRole("button", { name: new RegExp(typeLabel) }));
}

describe("DatasourceFormPage wizard smoke", () => {
  beforeEach(() => {
    mockApiFetch.mockReset();
    mockApiFetch.mockImplementation(async (path: string) => {
      if (path === "/api/v1/datasources/types") return MOCK_TYPES;
      throw new Error(`unexpected path ${path}`);
    });
  });
  afterEach(() => cleanup());

  it("FB-3-01: create mode shows category cards first", async () => {
    renderForm();
    await waitFor(() => expect(screen.getByRole("button", { name: /关系型数据库/ })).toBeInTheDocument());
    expect(screen.queryByLabelText("名称")).not.toBeInTheDocument();
  });

  it("FB-3-01c: pristine create wizard does not show unsaved hint or leave dialog", async () => {
    const user = userEvent.setup();
    renderForm();
    await waitFor(() => expect(screen.getByRole("button", { name: /关系型数据库/ })).toBeInTheDocument());
    expect(screen.queryByText(/有未保存的更改/)).not.toBeInTheDocument();
    await user.click(screen.getByRole("link", { name: /返回列表/ }));
    expect(screen.queryByRole("alertdialog")).not.toBeInTheDocument();
  });

  it("FB-3-01d: create form step shows leave dialog after editing", async () => {
    const user = userEvent.setup();
    renderForm();
    await selectType("关系型数据库", "MySQL");
    await user.type(screen.getByLabelText("名称"), "测试源");
    await user.click(screen.getByRole("link", { name: /返回列表/ }));
    expect(await screen.findByRole("alertdialog")).toHaveTextContent("未保存的更改");
  });

  it("FB-3-01b: legacy API without displayGroup still shows multiple categories", async () => {
    mockApiFetch.mockImplementation(async (path: string) => {
      if (path === "/api/v1/datasources/types") {
        return {
          items: [
            { type: "mysql", displayName: "MySQL", category: "relational", capabilities: ["sql"] },
            { type: "starrocks", displayName: "StarRocks", category: "olap", capabilities: ["sql"] },
            { type: "excel", displayName: "Excel", category: "file", capabilities: ["file"] },
          ],
        };
      }
      throw new Error(`unexpected path ${path}`);
    });
    renderForm();
    await waitFor(() => expect(screen.getByRole("button", { name: /关系型数据库/ })).toBeInTheDocument());
    expect(screen.getByRole("button", { name: /OLAP/ })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /文件/ })).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /^更多/ })).not.toBeInTheDocument();
  });

  it("FB-3-02: OLTP → MySQL → form fields visible", async () => {
    renderForm();
    await selectType("关系型数据库", "MySQL");
    expect(await screen.findByLabelText("名称")).toBeInTheDocument();
    expect(screen.getByLabelText("主机")).toBeInTheDocument();
  });

  it("FB-3-03: edit mode skips wizard", async () => {
    mockApiFetch.mockImplementation(async (path: string) => {
      if (path === "/api/v1/datasources/types") return MOCK_TYPES;
      if (path === "/api/v1/datasources/ds-1") {
        return { id: "ds-1", name: "prod", code: "prod", type: "mysql", host: "h", port: 3306, database: "d", username: "u" };
      }
      throw new Error(path);
    });
    const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } });
    render(
      <TooltipProvider delayDuration={0}>
        <QueryClientProvider client={qc}>
          <MemoryRouter initialEntries={["/admin/datasources/ds-1/edit"]}>
            <Routes>
              <Route path="/admin/datasources/:id/edit" element={<DatasourceFormPage mode="edit" />} />
            </Routes>
          </MemoryRouter>
        </QueryClientProvider>
      </TooltipProvider>,
    );
    await waitFor(() => expect(screen.getByLabelText("名称")).toHaveValue("prod"));
    expect(screen.queryByRole("button", { name: /关系型数据库/ })).not.toBeInTheDocument();
  });
});

describe("DatasourceFormPage xinchuang smoke", () => {
  beforeEach(() => {
    mockApiFetch.mockReset();
    mockApiFetch.mockImplementation(async (path: string) => {
      if (path === "/api/v1/datasources/types") return MOCK_TYPES;
      throw new Error(`unexpected path ${path}`);
    });
  });
  afterEach(() => cleanup());

  it("T-CONN-R242-FE-01: renders five xinchuang types plus mysql", async () => {
    renderForm();
    await waitFor(() => expect(mockApiFetch).toHaveBeenCalledWith("/api/v1/datasources/types"));
    await selectType("关系型数据库", "达梦 DM");
    expect(screen.getByRole("heading", { name: "填写连接信息" })).toBeInTheDocument();
  });

  it("T-CONN-R242-FE-02: selecting tidb sets port 4000", async () => {
    renderForm();
    await waitFor(() => expect(mockApiFetch).toHaveBeenCalled());
    await selectType("关系型数据库", "TiDB");
    expect(screen.getByLabelText("端口")).toHaveValue(4000);
  });

  it("T-CONN-R242-FE-03: selecting dm shows OWNER database label", async () => {
    renderForm();
    await waitFor(() => expect(mockApiFetch).toHaveBeenCalled());
    await selectType("关系型数据库", "达梦 DM");
    expect(screen.getByLabelText(/OWNER/)).toBeInTheDocument();
  });

  it("T-CONN-R242-FE-04: selecting oceanbase shows compatibility hint", async () => {
    renderForm();
    await waitFor(() => expect(mockApiFetch).toHaveBeenCalled());
    await selectType("关系型数据库", "OceanBase");
    expect(
      screen.getByText(/使用 MySQL 兼容协议连接/),
    ).toBeInTheDocument();
  });

  it("T-CONN-R243-FE-01: selecting gaussdb sets port 5432", async () => {
    renderForm();
    await waitFor(() => expect(mockApiFetch).toHaveBeenCalled());
    await selectType("关系型数据库", "GaussDB");
    expect(screen.getByLabelText("端口")).toHaveValue(5432);
  });

  it("T-CONN-R243-FE-02: selecting gaussdb shows Schema database label and hint", async () => {
    renderForm();
    await waitFor(() => expect(mockApiFetch).toHaveBeenCalled());
    await selectType("关系型数据库", "GaussDB");
    expect(screen.getByLabelText(/Schema/)).toBeInTheDocument();
    expect(
      screen.getByText(/GaussDB 兼容 PostgreSQL 协议/),
    ).toBeInTheDocument();
  });

  it("T-CONN-R249-FE-01: renders rest_api excel csv db2 impala in types", async () => {
    renderForm();
    await waitFor(() => expect(mockApiFetch).toHaveBeenCalled());
    await waitFor(() => expect(screen.getByRole("button", { name: /API/ })).toBeInTheDocument());
    expect(screen.getByRole("button", { name: /文件/ })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /数仓/ })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /OLAP/ })).toBeInTheDocument();
  });

  it("T-CONN-R249-FE-02: selecting rest_api shows companion fields not port", async () => {
    renderForm();
    await waitFor(() => expect(mockApiFetch).toHaveBeenCalled());
    await selectType("API", "REST API");
    expect(screen.getByLabelText("Base URL")).toBeInTheDocument();
    expect(screen.queryByLabelText("端口")).not.toBeInTheDocument();
  });

  it("T-CONN-R249-FE-03: selecting db2 sets port 50000", async () => {
    renderForm();
    await waitFor(() => expect(mockApiFetch).toHaveBeenCalled());
    await selectType("关系型数据库", "IBM Db2");
    expect(screen.getByLabelText("端口")).toHaveValue(50000);
  });

  it("T-CONN-R249-FE-04: selecting impala shows protocol hint", async () => {
    renderForm();
    await waitFor(() => expect(mockApiFetch).toHaveBeenCalled());
    await selectType("数仓", "Apache Impala");
    expect(screen.getByText(/兼容 Hive 协议/)).toBeInTheDocument();
  });
});

describe("DatasourceFormPage redshift smoke", () => {
  beforeEach(() => {
    mockApiFetch.mockReset();
  });
  afterEach(() => cleanup());

  it("T-CONN-R250-FE-01: redshift 类型在下拉中可选", async () => {
    mockApiFetch.mockResolvedValueOnce(MOCK_TYPES);
    renderForm();
    await waitFor(() => screen.getByRole("button", { name: /OLAP/ }));
    await selectType("OLAP", "AWS Redshift");
    expect(screen.getByRole("heading", { name: "填写连接信息" })).toBeInTheDocument();
  });

  it("T-CONN-R250-FE-02: 选中 redshift 后 port 自动填充 5439", async () => {
    mockApiFetch.mockResolvedValueOnce(MOCK_TYPES);
    renderForm();
    await waitFor(() => screen.getByRole("button", { name: /OLAP/ }));
    await selectType("OLAP", "AWS Redshift");
    const portInput = screen.getByLabelText(/端口/i) as HTMLInputElement;
    expect(portInput.value).toBe("5439");
  });
});

describe("DatasourceFormPage roapi smoke", () => {
  beforeEach(() => {
    mockApiFetch.mockReset();
    mockApiFetch.mockImplementation(async (path: string) => {
      if (path === "/api/v1/datasources/types") return MOCK_TYPES;
      throw new Error(`unexpected path ${path}`);
    });
  });
  afterEach(() => cleanup());

  it("T-CONN-R028-FE-01: roapi 类型在 API 分组可选", async () => {
    renderForm();
    await waitFor(() => screen.getByRole("button", { name: /API/ }));
    await selectType("API", "RoAPI");
    expect(screen.getByRole("heading", { name: "填写连接信息" })).toBeInTheDocument();
  });

  it("T-CONN-R028-FE-02: 选中 roapi 显示 RoAPI 地址而非端口", async () => {
    renderForm();
    await waitFor(() => screen.getByRole("button", { name: /API/ }));
    await selectType("API", "RoAPI");
    expect(screen.getByLabelText("RoAPI 地址")).toBeInTheDocument();
    expect(screen.queryByLabelText("端口")).not.toBeInTheDocument();
    expect(screen.getByLabelText("Schema 探测路径")).toHaveValue("/api/schema");
  });
});

describe("DatasourceFormPage save error recovery", () => {
  beforeEach(() => {
    mockApiFetch.mockReset();
    mockApiFetch.mockImplementation(async (path: string, init?: RequestInit) => {
      if (path === "/api/v1/datasources/types") return MOCK_TYPES;
      if (path === "/api/v1/datasources" && init?.method === "POST") {
        throw new ApiRequestError("Data source code already exists", "DATASOURCE_CODE_CONFLICT");
      }
      throw new Error(`unexpected path ${path}`);
    });
  });
  afterEach(() => cleanup());

  it("T-CONN-FE-SAVE-01: 标识冲突报错后仍可修改标识并再次提交", async () => {
    renderForm();
    await waitFor(() => expect(mockApiFetch).toHaveBeenCalledWith("/api/v1/datasources/types"));
    await selectType("关系型数据库", "MySQL");

    const user = userEvent.setup();
    await user.type(screen.getByLabelText("名称"), "重复测试源");
    await user.type(screen.getByLabelText("标识"), "dup-code");
    await user.type(screen.getByLabelText("主机"), "127.0.0.1");
    await user.type(screen.getByLabelText("数据库"), "demo");
    await user.type(screen.getByLabelText("用户名"), "root");
    await user.type(screen.getByLabelText("密码"), "secret");

    await user.click(screen.getByRole("button", { name: "保存" }));
    expect(await screen.findByRole("alert")).toHaveTextContent("数据源标识已存在");

    const codeInput = screen.getByLabelText("标识");
    expect(codeInput).not.toBeDisabled();
    await user.clear(codeInput);
    await user.type(codeInput, "unique-code");
    expect(codeInput).toHaveValue("unique-code");

    mockApiFetch.mockImplementation(async (path: string, init?: RequestInit) => {
      if (path === "/api/v1/datasources/types") return MOCK_TYPES;
      if (path === "/api/v1/datasources" && init?.method === "POST") {
        return { id: "ds-new", code: "unique-code", name: "重复测试源", type: "mysql", host: "127.0.0.1", port: 3306, database: "demo", username: "root" };
      }
      throw new Error(`unexpected path ${path}`);
    });

    await user.click(screen.getByRole("button", { name: "保存" }));
    await waitFor(() => expect(mockApiFetch).toHaveBeenCalledTimes(3));
  });
});

describe("CONN-023 REST API companion", () => {
  beforeEach(() => {
    mockApiFetch.mockReset();
    mockApiFetch.mockImplementation(async (path: string, init?: RequestInit) => {
      if (path === "/api/v1/datasources/types") return MOCK_TYPES;
      if (path === "/api/v1/datasources" && init?.method === "POST") {
        return JSON.parse(String(init.body));
      }
      throw new Error(`unexpected path ${path}`);
    });
  });
  afterEach(() => cleanup());

  it("T-CONN-023-FE-01: REST API shows Base URL auth health path not port", async () => {
    renderForm();
    await selectType("API", "REST API");
    expect(screen.getByLabelText("Base URL")).toBeInTheDocument();
    expect(screen.getByLabelText("认证方式")).toBeInTheDocument();
    expect(screen.getByLabelText("健康检查路径")).toBeInTheDocument();
    expect(screen.queryByLabelText("端口")).not.toBeInTheDocument();
  });

  it("T-CONN-023-FE-02: Bearer auth relabels password field", async () => {
    const user = userEvent.setup();
    renderForm();
    await selectType("API", "REST API");
    await user.click(screen.getByRole("combobox", { name: /认证方式/ }));
    await user.click(screen.getByRole("option", { name: "Bearer" }));
    expect(screen.getByLabelText("Bearer Token")).toBeInTheDocument();
  });

  it("T-CONN-023-FE-03: OAuth2 shows info alert and disabled oauth fields", async () => {
    const user = userEvent.setup();
    renderForm();
    await selectType("API", "REST API");
    await user.click(screen.getByRole("combobox", { name: /认证方式/ }));
    await user.click(screen.getByRole("option", { name: /OAuth2/ }));
    expect(screen.getByRole("status")).toHaveTextContent(/后续版本启用/);
    expect(screen.getByLabelText("OAuth2 客户端 ID")).toBeDisabled();
    expect(screen.getByLabelText("OAuth2 Token URL")).toBeDisabled();
  });

  it("T-CONN-023-FE-04: save rest_api maps host database port", async () => {
    const user = userEvent.setup();
    renderForm();
    await selectType("API", "REST API");
    await user.type(screen.getByLabelText("名称"), "api-src");
    await user.type(screen.getByLabelText("标识"), "api-src-code");
    await user.clear(screen.getByLabelText("Base URL"));
    await user.type(screen.getByLabelText("Base URL"), "https://api.example.com");
    await user.clear(screen.getByLabelText("健康检查路径"));
    await user.type(screen.getByLabelText("健康检查路径"), "/health");
    await user.click(screen.getByRole("button", { name: "保存" }));
    await waitFor(() => expect(mockApiFetch).toHaveBeenCalledWith(
      "/api/v1/datasources",
      expect.objectContaining({
        method: "POST",
        body: expect.stringContaining('"host":"https://api.example.com"'),
      }),
    ));
    const body = JSON.parse(
      String(mockApiFetch.mock.calls.find((c) => c[0] === "/api/v1/datasources")?.[1]?.body),
    );
    expect(body.port).toBe(443);
    expect(body.database).toBe("/health");
  });

  it("T-CONN-023-FE-05: wizard API → REST API → form path", async () => {
    renderForm();
    await selectType("API", "REST API");
    expect(screen.getByRole("heading", { name: "填写连接信息" })).toBeInTheDocument();
    expect(screen.getByLabelText("Base URL")).toBeInTheDocument();
  });

  it("T-CONN-023-FE-06: selecting rest_api prefills built-in sample API defaults", async () => {
    renderForm();
    await selectType("API", "REST API");
    expect(screen.getByLabelText("Base URL")).toHaveValue("http://127.0.0.1:8000");
    expect(screen.getByLabelText("健康检查路径")).toHaveValue("/sample-api/health");
  });

  it("T-CONN-023-FE-07: rejects identifier-like Base URL before save", async () => {
    const user = userEvent.setup();
    renderForm();
    await selectType("API", "REST API");
    await user.type(screen.getByLabelText("名称"), "bad-api");
    await user.type(screen.getByLabelText("标识"), "bad-api-code");
    await user.clear(screen.getByLabelText("Base URL"));
    await user.type(screen.getByLabelText("Base URL"), "sample_rest_api");
    await user.click(screen.getByRole("button", { name: "保存" }));
    expect(await screen.findByRole("alert")).toHaveTextContent(/不可填写连接标识/);
    expect(mockApiFetch).not.toHaveBeenCalledWith(
      "/api/v1/datasources",
      expect.objectContaining({ method: "POST" }),
    );
  });

  it("T-CONN-FE-SAVE-02: create success navigates to detail page for test", async () => {
    mockNavigate.mockReset();
    mockApiFetch.mockImplementation(async (path: string, init?: RequestInit) => {
      if (path === "/api/v1/datasources/types") return MOCK_TYPES;
      if (path === "/api/v1/datasources" && init?.method === "POST") {
        return { id: "ds-new", ...JSON.parse(String(init.body)) };
      }
      throw new Error(`unexpected path ${path}`);
    });
    const user = userEvent.setup();
    renderForm();
    await selectType("API", "REST API");
    await user.type(screen.getByLabelText("名称"), "样例 REST API");
    await user.type(screen.getByLabelText("标识"), "sample_rest_api");
    await user.click(screen.getByRole("button", { name: "保存" }));
    await waitFor(() =>
      expect(mockNavigate).toHaveBeenCalledWith("/admin/datasources/ds-new", {
        replace: true,
        state: { justCreated: true },
      }),
    );
  });
});

describe("CONN-024 file source companion", () => {
  beforeEach(() => {
    mockApiFetch.mockReset();
    mockApiFetch.mockImplementation(async (path: string, init?: RequestInit) => {
      if (path === "/api/v1/datasources/types") return MOCK_TYPES;
      if (path === "/api/v1/datasources" && init?.method === "POST") {
        return JSON.parse(String(init.body));
      }
      throw new Error(`unexpected path ${path}`);
    });
  });
  afterEach(() => cleanup());

  it("T-CONN-024-FE-01: Excel shows remote and local tabs", async () => {
    renderForm();
    await selectType("文件", "Excel");
    expect(screen.getByRole("tab", { name: "远程文件 URL" })).toBeInTheDocument();
    expect(screen.getByRole("tab", { name: "本地文件" })).toBeInTheDocument();
  });

  it("T-CONN-024-FE-02: local tab shows filename after xlsx select rejects pdf", async () => {
    const user = userEvent.setup();
    renderForm();
    await selectType("文件", "Excel");
    await user.click(screen.getByRole("tab", { name: "本地文件" }));
    await waitFor(() => expect(document.querySelector('input[type="file"]')).toBeTruthy());
    const input = document.querySelector('input[type="file"]') as HTMLInputElement;
    const xlsx = new File(["x"], "book.xlsx", {
      type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
    });
    Object.defineProperty(input, "files", { value: [xlsx], configurable: true });
    fireEvent.change(input);
    expect(await screen.findByText("book.xlsx")).toBeInTheDocument();
    const pdf = new File(["p"], "bad.pdf", { type: "application/pdf" });
    Object.defineProperty(input, "files", { value: [pdf], configurable: true });
    fireEvent.change(input);
    expect(screen.getByText(/仅支持/)).toBeInTheDocument();
  });

  it("T-CONN-024-FE-03: remote tab save sets host to URL", async () => {
    const user = userEvent.setup();
    renderForm();
    await selectType("文件", "CSV");
    await user.type(screen.getByLabelText("名称"), "csv-src");
    await user.type(screen.getByLabelText("标识"), "csv-code");
    await user.type(screen.getByLabelText("文件 URL"), "https://example.com/a.csv");
    await user.click(screen.getByRole("button", { name: "保存" }));
    await waitFor(() => expect(mockApiFetch).toHaveBeenCalled());
    const body = JSON.parse(
      String(mockApiFetch.mock.calls.find((c) => c[0] === "/api/v1/datasources")?.[1]?.body),
    );
    expect(body.host).toBe("https://example.com/a.csv");
    expect(body.port).toBe(1);
  });

  it("T-CONN-024-FE-04: CSV hides sheet name field", async () => {
    renderForm();
    await selectType("文件", "CSV");
    expect(screen.queryByLabelText(/Sheet/)).not.toBeInTheDocument();
  });
});

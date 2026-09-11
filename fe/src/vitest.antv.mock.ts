import { vi } from "vitest";

/** 历史 AntV 运行时 mock 占位；主路径已迁 D3，保留空文件避免 vitest setup 断裂。 */
vi.mock("@antv/g2plot", () => ({}));
vi.mock("@antv/g6", () => ({}));
vi.mock("@antv/g2", () => ({}));
vi.mock("@antv/s2-react", () => ({}));

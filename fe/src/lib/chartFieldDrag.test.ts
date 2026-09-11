import { describe, expect, it } from "vitest";
import {
  isChartFieldDropDisabled,
  readFieldDragData,
  writeFieldDragData,
} from "./chartFieldDrag";

describe("chartFieldDrag", () => {
  it("round-trips custom mime and text/plain fallback", () => {
    const dt = {
      store: new Map<string, string>(),
      setData(type: string, value: string) {
        this.store.set(type, value);
      },
      getData(type: string) {
        return this.store.get(type) ?? "";
      },
      effectAllowed: "",
    } as DataTransfer;

    writeFieldDragData(dt, "province");
    expect(readFieldDragData(dt)).toBe("province");
  });

  it("reads text/plain when custom mime missing", () => {
    const dt = {
      store: new Map<string, string>([["text/plain", "amount"]]),
      setData() {},
      getData(type: string) {
        return this.store.get(type) ?? "";
      },
    } as DataTransfer;
    expect(readFieldDragData(dt)).toBe("amount");
  });

  it("keeps slots enabled while columns are loading", () => {
    expect(isChartFieldDropDisabled(true, [])).toBe(false);
    expect(isChartFieldDropDisabled(false, [])).toBe(true);
    expect(isChartFieldDropDisabled(false, ["province"])).toBe(false);
  });
});

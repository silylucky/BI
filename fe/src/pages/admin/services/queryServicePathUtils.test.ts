import { describe, expect, it } from "vitest";
import { buildExecuteParameters, parseServicePathMeta } from "./queryServicePathUtils";

describe("parseServicePathMeta", () => {
  it("returns base path without meta segments", () => {
    expect(parseServicePathMeta("/api/v1/services/demo")).toEqual({
      basePath: "/api/v1/services/demo",
      requiredParams: [],
    });
  });

  it("parses requires segment", () => {
    expect(parseServicePathMeta("/api/v1/q;requires=region,date;handler=demo")).toEqual({
      basePath: "/api/v1/q",
      requiredParams: ["region", "date"],
    });
  });

  it("trims whitespace in requires list", () => {
    expect(parseServicePathMeta("/x;requires= a , b ")).toEqual({
      basePath: "/x",
      requiredParams: ["a", "b"],
    });
  });
});

describe("buildExecuteParameters", () => {
  it("maps required param names to values", () => {
    expect(buildExecuteParameters(["region"], { region: "华东" })).toEqual({ region: "华东" });
  });

  it("fills missing values with empty string", () => {
    expect(buildExecuteParameters(["a", "b"], { a: "1" })).toEqual({ a: "1", b: "" });
  });
});

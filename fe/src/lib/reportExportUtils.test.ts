import { describe, expect, it } from "vitest";
import { isExportBlobValid, MIN_EXPORT_BYTES, readBlobBytes } from "@/lib/reportExportUtils";

describe("isExportBlobValid", () => {
  it("rejects blobs smaller than minimum export size", () => {
    const bytes = new Uint8Array([0x25, 0x50, 0x44, 0x46]);
    expect(isExportBlobValid(bytes, "pdf")).toBe(false);
  });

  it("accepts pdf blobs with magic bytes and sufficient size", () => {
    const bytes = new Uint8Array(MIN_EXPORT_BYTES);
    bytes.set([0x25, 0x50, 0x44, 0x46]);
    expect(isExportBlobValid(bytes, "pdf")).toBe(true);
  });
});

describe("readBlobBytes", () => {
  it("reads Blob bytes in jsdom via FileReader fallback", async () => {
    const bytes = new Uint8Array(MIN_EXPORT_BYTES);
    bytes.set([0x25, 0x50, 0x44, 0x46]);
    const data = await readBlobBytes(new Blob([bytes], { type: "application/pdf" }));
    expect(data.length).toBe(MIN_EXPORT_BYTES);
    expect(isExportBlobValid(data, "pdf")).toBe(true);
  });
});

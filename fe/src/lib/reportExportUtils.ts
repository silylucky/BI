/** Magic-byte checks for report export downloads (P3-SMOKE). */
export const MIN_EXPORT_BYTES = 512;

export function exportMagicMatches(data: Uint8Array, format: string): boolean {
  if (data.length < 4) return false;
  if (format === "pdf") {
    return data[0] === 0x25 && data[1] === 0x50 && data[2] === 0x44 && data[3] === 0x46;
  }
  if (format === "excel") {
    return data[0] === 0x50 && data[1] === 0x4b;
  }
  return false;
}

export function isExportBlobValid(data: Uint8Array, format: string): boolean {
  if (data.length < MIN_EXPORT_BYTES) return false;
  return exportMagicMatches(data, format);
}

/** jsdom Blob 无 arrayBuffer()，用 FileReader 兜底。 */
export async function readBlobBytes(blob: Blob): Promise<Uint8Array> {
  if (typeof blob.arrayBuffer === "function") {
    const buffer = await blob.arrayBuffer();
    return new Uint8Array(buffer);
  }
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      if (reader.result instanceof ArrayBuffer) {
        resolve(new Uint8Array(reader.result));
        return;
      }
      reject(new Error("无法读取导出文件"));
    };
    reader.onerror = () => reject(reader.error ?? new Error("无法读取导出文件"));
    reader.readAsArrayBuffer(blob);
  });
}

export function decodeExportSample(base64OrText: string, format: string): Uint8Array {
  if (format === "pdf") {
    return new TextEncoder().encode("%PDF-1.4 sample");
  }
  return new Uint8Array([0x50, 0x4b, 0x03, 0x04]);
}

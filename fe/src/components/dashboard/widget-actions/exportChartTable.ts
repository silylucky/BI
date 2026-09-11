/** 将查询结果导出为 CSV（DE「导出 Excel」M1 等价物） */
export function downloadChartTableCsv(
  filename: string,
  columns: string[],
  rows: (string | number | boolean | null)[][],
) {
  const escape = (value: unknown) => {
    const text = value == null ? "" : String(value);
    return /[",\n]/.test(text) ? `"${text.replace(/"/g, '""')}"` : text;
  };
  const lines = [columns.map(escape).join(","), ...rows.map((row) => row.map(escape).join(","))];
  const blob = new Blob(["\uFEFF", lines.join("\n")], { type: "text/csv;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = filename.endsWith(".csv") ? filename : `${filename}.csv`;
  anchor.click();
  URL.revokeObjectURL(url);
}

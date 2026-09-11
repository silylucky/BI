import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";

export function ReportResultTable({ columns, rows }: { columns: string[]; rows: unknown[][] }) {
  return (
    <div className="overflow-x-only">
      <Table className="min-w-[320px] text-theme-sm">
        <TableHeader>
          <TableRow className="border-gray-200 dark:border-gray-800">
            {columns.map((col) => (
              <TableHead
                key={col}
                className="px-3 py-2 font-medium text-gray-700 dark:text-gray-300"
              >
                {col}
              </TableHead>
            ))}
          </TableRow>
        </TableHeader>
        <TableBody>
          {rows.map((row, i) => (
            <TableRow key={i} className="border-gray-100 dark:border-gray-800/60">
              {row.map((cell, j) => (
                <TableCell key={j} className="px-3 py-2 text-gray-600 dark:text-gray-400">
                  {String(cell ?? "")}
                </TableCell>
              ))}
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  );
}

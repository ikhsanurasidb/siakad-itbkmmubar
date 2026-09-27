import { cn } from "@siakad-itbkmmubar/ui/lib/utils";
import type { ReactNode } from "react";

export interface DataTableColumn<T> {
  cell?: (row: T) => ReactNode;
  header: string;
  id: string;
}

interface DataTableProps<T> {
  columns: readonly DataTableColumn<T>[];
  emptyMessage?: string;
  getRowKey?: (row: T, index: number) => string;
  rows: readonly T[];
}

export const DataTable = <T,>({
  columns,
  emptyMessage = "Belum ada data untuk ditampilkan.",
  getRowKey,
  rows,
}: DataTableProps<T>) => (
  <div className="border-border overflow-x-auto border">
    <table className="w-full min-w-[36rem] text-left text-sm">
      <thead className="bg-muted/60 border-border border-b">
        <tr>
          {columns.map((column) => (
            <th
              className="px-4 py-3 text-xs font-medium"
              key={column.id}
              scope="col"
            >
              {column.header}
            </th>
          ))}
        </tr>
      </thead>
      <tbody className="divide-border divide-y">
        {rows.length === 0 ? (
          <tr>
            <td
              className="text-muted-foreground px-4 py-8 text-center"
              colSpan={columns.length}
            >
              {emptyMessage}
            </td>
          </tr>
        ) : (
          rows.map((row, index) => (
            <tr
              className={cn("hover:bg-muted/30 transition-colors")}
              key={getRowKey?.(row, index) ?? index}
            >
              {columns.map((column) => (
                <td className="px-4 py-3 align-top" key={column.id}>
                  {column.cell
                    ? column.cell(row)
                    : String(row[column.id as keyof T] ?? "—")}
                </td>
              ))}
            </tr>
          ))
        )}
      </tbody>
    </table>
  </div>
);

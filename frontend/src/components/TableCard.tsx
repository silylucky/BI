import type { TableData } from '../types'

interface TableCardProps {
  data: TableData
}

export function TableCard({ data }: TableCardProps) {
  const maxRows = 50
  const displayRows = data.rows.slice(0, maxRows)
  const truncated = data.rows.length > maxRows

  return (
    <div className="table-card">
      <div className="table-card-title">
        📋 查询结果（{data.row_count} 行{truncated ? `，仅显示前 ${maxRows} 行` : ''}）
      </div>
      <table className="data-table">
        <thead>
          <tr>
            {data.columns.map((col, i) => (
              <th key={i}>{col}</th>
            ))}
          </tr>
        </thead>
        <tbody>
          {displayRows.map((row, i) => (
            <tr key={i}>
              {data.columns.map((col, j) => (
                <td key={j}>{String(row[col] ?? '')}</td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}

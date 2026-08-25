import type { ToolCallInfo } from '../types'

interface ToolCallPanelProps {
  calls: ToolCallInfo[]
}

const TOOL_LABELS: Record<string, string> = {
  query_database: '数据库查询',
  analyze_data: '数据分析',
  generate_chart: '图表生成',
}

const TOOL_ICONS: Record<string, string> = {
  query_database: '🗄️',
  analyze_data: '🔢',
  generate_chart: '📊',
}

export function ToolCallPanel({ calls }: ToolCallPanelProps) {
  if (calls.length === 0) return null

  return (
    <div className="tool-call-panel">
      <div className="title">🔧 工具调用过程</div>
      {calls.map((call, i) => (
        <div key={i} className="tool-call-item">
          <span className="tool-icon">{TOOL_ICONS[call.tool] || '⚙️'}</span>
          <div>
            <span className="tool-name">{TOOL_LABELS[call.tool] || call.tool}</span>
            <div className="tool-args">
              {JSON.stringify(call.args, null, 2).slice(0, 500)}
            </div>
          </div>
        </div>
      ))}
    </div>
  )
}

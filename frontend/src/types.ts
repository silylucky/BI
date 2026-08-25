// ===== 类型定义 =====

export interface ChatMessage {
  role: 'user' | 'assistant'
  content: string
}

export interface ToolCallInfo {
  tool: string
  args: Record<string, unknown>
}

export interface ChartData {
  chart_type: string
  title: string
  echarts_option: Record<string, unknown>
}

export interface TableData {
  columns: string[]
  rows: Record<string, unknown>[]
  row_count: number
}

// SSE 事件类型
export type SSEEvent =
  | { type: 'tool_call'; tool: string; args: Record<string, unknown> }
  | { type: 'chart'; data: ChartData }
  | { type: 'table'; data: TableData }
  | { type: 'answer'; content: string }
  | { type: 'history'; messages: ChatMessage[] }

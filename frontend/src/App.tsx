import { useState, useRef, useCallback } from 'react'
import type {
  ToolCallInfo,
  ChartData,
  TableData,
  SSEEvent,
} from './types'
import { ChartCard } from './components/ChartCard'
import { TableCard } from './components/TableCard'
import { ToolCallPanel } from './components/ToolCallPanel'

// ===== 一次对话回合的内容 =====
interface ChatRound {
  id: number
  userMessage: string
  assistantMessage: string
  toolCalls: ToolCallInfo[]
  charts: ChartData[]
  tables: TableData[]
  loading: boolean
}

let roundIdCounter = 0

export default function App() {
  const [input, setInput] = useState('')
  const [rounds, setRounds] = useState<ChatRound[]>([])
  const [streaming, setStreaming] = useState(false)
  const chatEndRef = useRef<HTMLDivElement>(null)

  const scrollToBottom = () => {
    setTimeout(() => {
      chatEndRef.current?.scrollIntoView({ behavior: 'smooth' })
    }, 50)
  }

  const sendMessage = useCallback(async () => {
    const text = input.trim()
    if (!text || streaming) return

    const roundId = ++roundIdCounter
    setInput('')
    setStreaming(true)

    // 创建新的一轮对话
    const newRound: ChatRound = {
      id: roundId,
      userMessage: text,
      assistantMessage: '',
      toolCalls: [],
      charts: [],
      tables: [],
      loading: true,
    }
    setRounds((prev) => [...prev, newRound])
    scrollToBottom()

    try {
      const response = await fetch('/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          session_id: 'default',
          message: text,
        }),
      })

      if (!response.ok || !response.body) {
        throw new Error(`后端请求失败（HTTP ${response.status}）`)
      }

      const reader = response.body.getReader()
      const decoder = new TextDecoder()
      let buffer = ''

      while (true) {
        const { done, value } = await reader.read()
        if (done) break

        buffer += decoder.decode(value, { stream: true })
        const lines = buffer.split('\n')
        buffer = lines.pop() || ''

        for (const line of lines) {
          if (!line.startsWith('data: ')) continue
          const jsonStr = line.slice(6).trim()
          if (!jsonStr) continue

          try {
            const event: SSEEvent = JSON.parse(jsonStr)

            setRounds((prev) =>
              prev.map((r) => {
                if (r.id !== roundId) return r

                switch (event.type) {
                  case 'tool_call':
                    return {
                      ...r,
                      toolCalls: [
                        ...r.toolCalls,
                        { tool: event.tool, args: event.args },
                      ],
                    }
                  case 'chart':
                    return {
                      ...r,
                      charts: [...r.charts, event.data],
                    }
                  case 'table':
                    return {
                      ...r,
                      tables: [...r.tables, event.data],
                    }
                  case 'answer':
                    return {
                      ...r,
                      assistantMessage: event.content,
                      loading: false,
                    }
                  default:
                    return r
                }
              })
            )
            scrollToBottom()
          } catch {
            // JSON 解析失败，跳过
          }
        }
      }
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : '未知错误'
      setRounds((prev) =>
        prev.map((r) =>
          r.id === roundId
            ? {
                ...r,
                assistantMessage: `⚠️ 对话请求失败：${errorMessage}`,
                loading: false,
              }
            : r
        )
      )
    } finally {
      setStreaming(false)
    }
  }, [input, streaming])

  const clearSession = async () => {
    try {
      await fetch('/session/default', { method: 'DELETE' })
    } catch {
      // 忽略错误
    }
    setRounds([])
  }

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      sendMessage()
    }
  }

  return (
    <div className="app" style={{ position: 'relative' }}>
      <button className="clear-btn" onClick={clearSession}>
        清空对话
      </button>

      {/* Header */}
      <div className="app-header">
        <h1>📊 BI 问数智能体</h1>
        <div className="subtitle">
          输入您的数据分析问题，AI 会自动查询数据库、分析数据并生成图表
        </div>
      </div>

      {/* 对话区域 */}
      <div className="chat-container">
        {rounds.length === 0 && (
          <div style={{ textAlign: 'center', padding: '40px 20px', color: '#bbb' }}>
            <p style={{ fontSize: 16, marginBottom: 12 }}>试试这些问题：</p>
            <ul style={{ listStyle: 'none', fontSize: 14, lineHeight: 2 }}>
              <li>📊 查询各城市的订单总金额，画个饼图</li>
              <li>📈 查询每月的订单数量趋势，用折线图展示</li>
              <li>🏆 查询销售额最高的5个商品，用柱状图展示</li>
              <li>📉 查询各商品分类的平均订单金额</li>
            </ul>
          </div>
        )}

        {rounds.map((round) => (
          <div key={round.id}>
            {/* 用户消息 */}
            <div className="message user">
              <div className="message-bubble">{round.userMessage}</div>
            </div>

            {/* 工具调用过程 */}
            {round.toolCalls.length > 0 && (
              <ToolCallPanel calls={round.toolCalls} />
            )}

            {/* 表格 */}
            {round.tables.map((table, i) => (
              <TableCard key={i} data={table} />
            ))}

            {/* 图表 */}
            {round.charts.map((chart, i) => (
              <ChartCard key={i} data={chart} />
            ))}

            {/* AI 回答 */}
            {(round.assistantMessage || round.loading) && (
              <div className="message assistant">
                <div className="message-bubble">
                  {round.loading && !round.assistantMessage ? (
                    <div className="loading-dots">
                      <span></span>
                      <span></span>
                      <span></span>
                    </div>
                  ) : (
                    round.assistantMessage
                  )}
                </div>
              </div>
            )}
          </div>
        ))}
        <div ref={chatEndRef} />
      </div>

      {/* 输入区域 */}
      <div className="input-area">
        <input
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={handleKeyDown}
          placeholder="例如：查询本月销售额最高的5个商品，并生成柱状图"
          disabled={streaming}
        />
        <button onClick={sendMessage} disabled={streaming}>
          {streaming ? '分析中...' : '发送'}
        </button>
      </div>
    </div>
  )
}

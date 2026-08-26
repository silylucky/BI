import { useState, useRef, useCallback } from 'react'
import type { ToolCallInfo, ChartData, TableData, SSEEvent, ConfirmationRequest } from './types'
import { ChartCard } from './components/ChartCard'
import { TableCard } from './components/TableCard'
import { ToolCallPanel } from './components/ToolCallPanel'
import { PluginManager } from './components/PluginManager'

interface ChatRound {
  id: number
  userMessage: string
  assistantMessage: string
  toolCalls: ToolCallInfo[]
  charts: ChartData[]
  tables: TableData[]
  confirmation?: ConfirmationRequest
  loading: boolean
}

let roundIdCounter = 0

export default function App() {
  const [input, setInput] = useState('')
  const [rounds, setRounds] = useState<ChatRound[]>([])
  const [streaming, setStreaming] = useState(false)
  const [showPluginManager, setShowPluginManager] = useState(false)
  const chatEndRef = useRef<HTMLDivElement>(null)

  const scrollToBottom = () => setTimeout(() => chatEndRef.current?.scrollIntoView({ behavior: 'smooth' }), 50)

  const sendMessage = useCallback(async () => {
    const text = input.trim()
    if (!text || streaming) return
    const roundId = ++roundIdCounter
    setInput('')
    setStreaming(true)
    setRounds((prev) => [...prev, { id: roundId, userMessage: text, assistantMessage: '', toolCalls: [], charts: [], tables: [], loading: true }])
    scrollToBottom()
    try {
      const response = await fetch('/chat', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ session_id: 'default', message: text }) })
      if (!response.ok || !response.body) throw new Error(`后端请求失败（HTTP ${response.status}）`)
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
          try {
            const event: SSEEvent = JSON.parse(line.slice(6).trim())
            setRounds((prev) => prev.map((round) => {
              if (round.id !== roundId) return round
              switch (event.type) {
                case 'tool_call': return { ...round, toolCalls: [...round.toolCalls, { tool: event.tool, args: event.args }] }
                case 'chart': return { ...round, charts: [...round.charts, event.data] }
                case 'table': return { ...round, tables: [...round.tables, event.data] }
                case 'confirmation_required': return { ...round, confirmation: event, loading: false }
                case 'answer': return { ...round, assistantMessage: event.content, loading: false }
                default: return round
              }
            }))
            scrollToBottom()
          } catch { /* 跳过不完整 SSE 片段 */ }
        }
      }
    } catch (error) {
      const message = error instanceof Error ? error.message : '未知错误'
      setRounds((prev) => prev.map((round) => round.id === roundId ? { ...round, assistantMessage: `⚠️ 对话请求失败：${message}`, loading: false } : round))
    } finally { setStreaming(false) }
  }, [input, streaming])

  const resolveConfirmation = async (roundId: number, confirmation: ConfirmationRequest, approved: boolean) => {
    try {
      const response = await fetch(`/tool-confirmations/${confirmation.confirmation_id}/${approved ? 'approve' : 'cancel'}`, { method: 'POST' })
      const data = await response.json()
      if (!response.ok) throw new Error(data.detail || '确认操作失败')
      setRounds((prev) => prev.map((round) => round.id === roundId ? { ...round, confirmation: undefined, assistantMessage: approved ? `已执行 ${confirmation.tool}。结果已交给智能体处理：${JSON.stringify(data.result ?? {})}` : '已取消该操作。' } : round))
    } catch (error) {
      setRounds((prev) => prev.map((round) => round.id === roundId ? { ...round, assistantMessage: `⚠️ ${error instanceof Error ? error.message : '确认失败'}` } : round))
    }
  }

  const clearSession = async () => { try { await fetch('/session/default', { method: 'DELETE' }) } catch { /* 忽略 */ } setRounds([]) }
  const handleKeyDown = (event: React.KeyboardEvent) => { if (event.key === 'Enter' && !event.shiftKey) { event.preventDefault(); sendMessage() } }

  return <div className="app" style={{ position: 'relative' }}>
    <button className="clear-btn" onClick={clearSession}>清空对话</button>
    <button className="add-plugin-btn" onClick={() => setShowPluginManager(true)}>添加插件</button>
    <div className="app-header"><h1>📊 BI 问数系统</h1><div className="subtitle">输入您的数据分析问题，AI 会自动查询数据、分析数据并生成图表</div></div>
    <div className="chat-container">
      {rounds.length === 0 && <div style={{ textAlign: 'center', padding: '40px 20px', color: '#bbb' }}><p style={{ fontSize: 16, marginBottom: 12 }}>试试这些问题：</p><ul style={{ listStyle: 'none', fontSize: 14, lineHeight: 2 }}><li>📊 查询各城市的订单总金额，画个饼图</li><li>📈 查询每月的订单数量趋势，用折线图展示</li><li>🏆 查询销售额最高的5个商品，用柱状图展示</li><li>📉 查询各商品分类的平均订单金额</li></ul></div>}
      {rounds.map((round) => <div key={round.id}>
        <div className="message user"><div className="message-bubble">{round.userMessage}</div></div>
        {round.toolCalls.length > 0 && <ToolCallPanel calls={round.toolCalls} />}
        {round.tables.map((table, index) => <TableCard key={index} data={table} />)}
        {round.charts.map((chart, index) => <ChartCard key={index} data={chart} />)}
        {round.confirmation && <div className="confirmation-card"><strong>需要确认：{round.confirmation.tool}</strong><p>{round.confirmation.message}</p><pre>{JSON.stringify(round.confirmation.args, null, 2)}</pre><div><button onClick={() => resolveConfirmation(round.id, round.confirmation!, false)}>取消</button><button className="confirm-btn" onClick={() => resolveConfirmation(round.id, round.confirmation!, true)}>确认执行</button></div></div>}
        {(round.assistantMessage || round.loading) && <div className="message assistant"><div className="message-bubble">{round.loading && !round.assistantMessage ? <div className="loading-dots"><span /><span /><span /></div> : round.assistantMessage}</div></div>}
      </div>)}
      <div ref={chatEndRef} />
    </div>
    <div className="input-area"><input value={input} onChange={(event) => setInput(event.target.value)} onKeyDown={handleKeyDown} placeholder="例如：查询本月销售额最高的5个商品，并生成柱状图" disabled={streaming} /><button onClick={sendMessage} disabled={streaming}>{streaming ? '分析中...' : '发送'}</button></div>
    {showPluginManager && <PluginManager onClose={() => setShowPluginManager(false)} />}
  </div>
}

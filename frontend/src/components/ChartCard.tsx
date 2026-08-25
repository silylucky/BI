import ReactECharts from 'echarts-for-react'
import type { ChartData } from '../types'

interface ChartCardProps {
  data: ChartData
}

export function ChartCard({ data }: ChartCardProps) {
  return (
    <div className="chart-card">
      <div className="chart-card-title">📊 {data.title || '数据图表'}</div>
      <ReactECharts
        option={data.echarts_option}
        style={{ height: 350, width: '100%' }}
        opts={{ renderer: 'canvas' }}
      />
    </div>
  )
}

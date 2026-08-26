import { useEffect, useRef, useState } from 'react'
import * as d3 from 'd3'
import type { ChartData } from '../types'

interface ChartCardProps {
  data: ChartData
}

interface ChartPoint {
  label: string
  value: number
}

const COLORS = ['#1a73e8', '#34a853', '#fbbc04', '#ea4335', '#9334e6', '#00acc1', '#ff7043']

function getRecord(value: unknown): Record<string, unknown> {
  return value !== null && typeof value === 'object' ? value as Record<string, unknown> : {}
}

function toNumber(value: unknown): number {
  const numberValue = Number(value)
  return Number.isFinite(numberValue) ? numberValue : 0
}

function getChartPoints(option: Record<string, unknown>, chartType: string): ChartPoint[] {
  const series = Array.isArray(option.series) ? getRecord(option.series[0]) : {}

  if (chartType === 'pie') {
    const values = Array.isArray(series.data) ? series.data : []
    return values.map((item, index) => {
      const point = getRecord(item)
      return {
        label: String(point.name ?? `数据 ${index + 1}`),
        value: toNumber(point.value),
      }
    })
  }

  const xAxis = getRecord(option.xAxis)
  const labels = Array.isArray(xAxis.data) ? xAxis.data : []
  const values = Array.isArray(series.data) ? series.data : []
  return values.map((value, index) => ({
    label: String(labels[index] ?? `数据 ${index + 1}`),
    value: toNumber(value),
  }))
}

function renderCartesianChart(
  svg: d3.Selection<SVGSVGElement, null, HTMLDivElement, unknown>,
  points: ChartPoint[],
  chartType: string,
  width: number,
  height: number,
) {
  const margin = { top: 20, right: 24, bottom: 70, left: 58 }
  const innerWidth = width - margin.left - margin.right
  const innerHeight = height - margin.top - margin.bottom
  const graph = svg.append('g').attr('transform', `translate(${margin.left},${margin.top})`)
  const maxValue = d3.max(points, (point) => point.value) ?? 0
  const yScale = d3.scaleLinear()
    .domain([0, maxValue === 0 ? 1 : maxValue * 1.1])
    .nice()
    .range([innerHeight, 0])
  const xScale = d3.scaleBand()
    .domain(points.map((point) => point.label))
    .range([0, innerWidth])
    .padding(chartType === 'bar' ? 0.22 : 0.1)

  graph.append('g')
    .attr('class', 'chart-grid')
    .call(d3.axisLeft(yScale).tickSize(-innerWidth).tickFormat(() => ''))
    .select('.domain')
    .remove()

  graph.append('g')
    .attr('class', 'chart-axis chart-axis-x')
    .attr('transform', `translate(0,${innerHeight})`)
    .call(d3.axisBottom(xScale))
    .selectAll('text')
    .attr('transform', 'rotate(-28)')
    .style('text-anchor', 'end')

  graph.append('g')
    .attr('class', 'chart-axis')
    .call(d3.axisLeft(yScale).ticks(5))

  if (chartType === 'line') {
    const line = d3.line<ChartPoint>()
      .x((point) => (xScale(point.label) ?? 0) + xScale.bandwidth() / 2)
      .y((point) => yScale(point.value))

    graph.append('path')
      .datum(points)
      .attr('class', 'chart-line')
      .attr('d', line)

    graph.selectAll('.chart-point')
      .data(points)
      .join('circle')
      .attr('class', 'chart-point')
      .attr('cx', (point) => (xScale(point.label) ?? 0) + xScale.bandwidth() / 2)
      .attr('cy', (point) => yScale(point.value))
      .attr('r', 4)
      .append('title')
      .text((point) => `${point.label}: ${point.value}`)
    return
  }

  graph.selectAll('.chart-bar')
    .data(points)
    .join('rect')
    .attr('class', 'chart-bar')
    .attr('x', (point) => xScale(point.label) ?? 0)
    .attr('y', (point) => yScale(point.value))
    .attr('width', xScale.bandwidth())
    .attr('height', (point) => innerHeight - yScale(point.value))
    .attr('rx', 4)
    .append('title')
    .text((point) => `${point.label}: ${point.value}`)
}

function renderPieChart(
  svg: d3.Selection<SVGSVGElement, null, HTMLDivElement, unknown>,
  points: ChartPoint[],
  width: number,
  height: number,
) {
  const legendWidth = Math.min(180, width * 0.32)
  const radius = Math.max(40, Math.min((width - legendWidth) / 2 - 20, height / 2 - 20))
  const graph = svg.append('g')
    .attr('transform', `translate(${(width - legendWidth) / 2},${height / 2})`)
  const pie = d3.pie<ChartPoint>().value((point) => point.value).sort(null)
  const arc = d3.arc<d3.PieArcDatum<ChartPoint>>().innerRadius(radius * 0.45).outerRadius(radius)

  graph.selectAll('path')
    .data(pie(points))
    .join('path')
    .attr('d', arc)
    .attr('fill', (_, index) => COLORS[index % COLORS.length])
    .attr('stroke', '#fff')
    .attr('stroke-width', 2)
    .append('title')
    .text((part) => `${part.data.label}: ${part.data.value}`)

  const legend = svg.append('g').attr('transform', `translate(${width - legendWidth + 12},24)`)
  legend.selectAll('g')
    .data(points)
    .join('g')
    .attr('transform', (_, index) => `translate(0,${index * 24})`)
    .each(function (point, index) {
      const item = d3.select(this)
      item.append('rect').attr('width', 12).attr('height', 12).attr('rx', 2).attr('fill', COLORS[index % COLORS.length])
      item.append('text').attr('x', 18).attr('y', 10).attr('class', 'chart-legend-text').text(`${point.label} (${point.value})`)
    })
}

export function ChartCard({ data }: ChartCardProps) {
  const containerRef = useRef<HTMLDivElement>(null)
  const [width, setWidth] = useState(0)
  const chartType = data.chart_type === 'pie' || data.chart_type === 'line' ? data.chart_type : 'bar'
  const points = getChartPoints(data.echarts_option, chartType)

  useEffect(() => {
    const container = containerRef.current
    if (!container) return

    const observer = new ResizeObserver(([entry]) => setWidth(entry.contentRect.width))
    observer.observe(container)
    return () => observer.disconnect()
  }, [])

  useEffect(() => {
    const container = containerRef.current
    if (!container || width === 0) return

    const height = 350
    const svg = d3.select(container).select<HTMLDivElement>('.chart-svg-host')
      .selectAll<SVGSVGElement, unknown>('svg')
      .data([null])
      .join('svg')
      .attr('viewBox', `0 0 ${width} ${height}`)
      .attr('width', '100%')
      .attr('height', height)
      .attr('role', 'img')
      .attr('aria-label', data.title || '数据图表')

    svg.selectAll('*').remove()
    if (points.length === 0) return

    if (chartType === 'pie') {
      renderPieChart(svg, points, width, height)
    } else {
      renderCartesianChart(svg, points, chartType, width, height)
    }
  }, [chartType, data.title, points, width])

  return (
    <div className="chart-card">
      <div className="chart-card-title">📊 {data.title || '数据图表'}</div>
      <div ref={containerRef} className="chart-render-area">
        <div className="chart-svg-host" />
        {points.length === 0 && <div className="chart-empty">暂无可展示的图表数据</div>}
      </div>
    </div>
  )
}

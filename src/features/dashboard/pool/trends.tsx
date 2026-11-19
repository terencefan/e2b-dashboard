'use client'

import { LineChart } from 'echarts/charts'
import { GridComponent, TooltipComponent } from 'echarts/components'
import * as echarts from 'echarts/core'
import { SVGRenderer } from 'echarts/renderers'
import ReactEChartsCore from 'echarts-for-react/lib/core'
import { useEffect, useState } from 'react'
import { useCssVars } from '@/lib/hooks/use-css-vars'

echarts.use([LineChart, GridComponent, TooltipComponent, SVGRenderer])
const themeVars = [
  '--fg-tertiary',
  '--stroke',
  '--accent-main-highlight',
] as const
const metrics = [
  ['orchestrator_env_sandbox_running', 'Running sandboxes', 'sandboxes', 1],
  ['orchestrator_sandbox_cpu_allocated', 'Allocated CPU', 'vCPU', 1],
  ['orchestrator_sandbox_memory_allocated', 'Allocated memory', 'GiB', 2 ** 30],
  [
    'orchestrator_sandbox_disk_allocated',
    'Logical disk allocation',
    'GiB',
    2 ** 30,
  ],
] as const

type Snapshot = { pool: string; series: Record<string, [number, string][]> }

export function PoolTrends({ pool }: { pool: string }) {
  const [snapshot, setSnapshot] = useState<Snapshot>()
  const [failed, setFailed] = useState(false)
  const colors = useCssVars(themeVars)
  const deployment = pool === 'pilot' ? 'bm-1-pilot' : 'production'

  useEffect(() => {
    const controller = new AbortController()
    async function refresh() {
      try {
        const response = await fetch(`/access/pool-trends?pool=${pool}`, {
          signal: controller.signal,
        })
        if (!response.ok) throw new Error('Trends unavailable')
        const data: Snapshot = await response.json()
        if (controller.signal.aborted || data.pool !== pool) return
        setSnapshot(data)
        setFailed(false)
      } catch {
        if (!controller.signal.aborted) setFailed(true)
      }
    }
    void refresh()
    const interval = window.setInterval(refresh, 30_000)
    return () => {
      controller.abort()
      window.clearInterval(interval)
    }
  }, [pool])

  return (
    <section className="mt-4" aria-label="Pool trends">
      <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
        <h2 className="font-medium">Last hour</h2>
        <a
          className="text-sm text-fg-tertiary hover:underline"
          href={`https://grafana.data.pjlab.in/d/e2b-sandboxes-overview?var-pool=${deployment}&from=now-1h&to=now`}
          target="_blank"
          rel="noreferrer"
        >
          Open in Grafana ↗
        </a>
      </div>
      {failed && (
        <p role="status" className="mb-2 text-sm text-fg-tertiary">
          Trend data is temporarily unavailable
          {snapshot ? '. Showing the last snapshot.' : '.'}
        </p>
      )}
      <div className="grid grid-cols-1 gap-3 lg:grid-cols-2">
        {metrics.map(([metric, title, unit, divisor]) => {
          const points = snapshot?.series[metric]?.map(([time, raw]) => {
            const number = Number(raw)
            return [
              time * 1000,
              Number.isFinite(number) ? number / divisor : null,
            ]
          })
          return (
            <section
              key={metric}
              aria-label={title}
              className="min-w-0 rounded-lg border border-stroke bg-bg-1 p-3"
            >
              <h3 className="text-sm font-medium">
                {title}{' '}
                <span className="font-normal text-fg-tertiary">· {unit}</span>
              </h3>
              {points?.length ? (
                <ReactEChartsCore
                  echarts={echarts}
                  opts={{ renderer: 'svg' }}
                  style={{ height: 160 }}
                  option={{
                    animation: false,
                    grid: { left: 49, right: 16, top: 15, bottom: 28 },
                    tooltip: {
                      trigger: 'axis',
                      confine: true,
                      valueFormatter: (v: unknown) =>
                        typeof v === 'number'
                          ? `${v.toLocaleString(undefined, { maximumFractionDigits: 2 })} ${unit}`
                          : '—',
                    },
                    xAxis: {
                      type: 'time',
                      axisLabel: {
                        color: colors['--fg-tertiary'],
                        hideOverlap: true,
                      },
                      axisLine: { lineStyle: { color: colors['--stroke'] } },
                    },
                    yAxis: {
                      type: 'value',
                      min: 0,
                      axisLabel: { color: colors['--fg-tertiary'] },
                      splitLine: { lineStyle: { color: colors['--stroke'] } },
                    },
                    series: [
                      {
                        type: 'line',
                        name: title,
                        showSymbol: false,
                        data: points,
                        lineStyle: {
                          color: colors['--accent-main-highlight'] || '#ff6a00',
                        },
                      },
                    ],
                  }}
                />
              ) : (
                <p className="grid h-40 place-items-center text-sm text-fg-tertiary">
                  {!snapshot && !failed ? 'Loading trend…' : 'No samples'}
                </p>
              )}
            </section>
          )
        })}
      </div>
    </section>
  )
}

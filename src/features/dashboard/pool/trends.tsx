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
  ['pool_cpu_utilization', 'CPU utilization'],
  ['hugepages', 'Ready node HugePages committed'],
  ['pool_disk_utilization', 'Data disk utilization'],
] as const

type Snapshot = { pool: string; series: Record<string, [number, string][]> }

export function PoolTrends({
  pool,
  hugePagesSamples,
}: {
  pool: string
  hugePagesSamples: [number, string][]
}) {
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
      <div className="grid grid-cols-1 gap-3 xl:grid-cols-3">
        {metrics.map(([metric, title]) => {
          const samples =
            metric === 'hugepages'
              ? hugePagesSamples
              : (snapshot?.series[metric] ?? [])
          const points: [number, number | null][] = []
          for (const [time, raw] of samples) {
            const timestamp = time * 1000
            const prior = points.at(-1)?.[0]
            if (
              prior !== undefined &&
              timestamp - prior > (metric === 'hugepages' ? 90_000 : 30_000)
            ) {
              points.push([prior + 30_000, null])
            }
            const number = Number(raw)
            points.push([timestamp, Number.isFinite(number) ? number : null])
          }
          const last = points.at(-1)
          const latest = last && Date.now() - last[0] <= 90_000 ? last[1] : null
          return (
            <section
              key={metric}
              aria-label={title}
              className="min-w-0 rounded-lg border border-stroke bg-bg-1 p-3"
            >
              <h3 className="text-sm font-medium">
                {title}{' '}
                <span className="font-normal text-fg-tertiary">
                  · {typeof latest === 'number' ? `${latest.toFixed(1)}%` : '—'}
                </span>
              </h3>
              {metric === 'hugepages' && (
                <p className="text-xs text-fg-tertiary">
                  Samples since opening this page
                </p>
              )}
              {points.length ? (
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
                          ? `${v.toLocaleString(undefined, { maximumFractionDigits: 2 })}%`
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
                      max: 100,
                      axisLabel: {
                        color: colors['--fg-tertiary'],
                        formatter: '{value}%',
                      },
                      splitLine: { lineStyle: { color: colors['--stroke'] } },
                    },
                    series: [
                      {
                        type: 'line',
                        name: title,
                        showSymbol: points.length === 1,
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

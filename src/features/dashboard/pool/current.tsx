'use client'

import { PieChart } from 'echarts/charts'
import * as echarts from 'echarts/core'
import { SVGRenderer } from 'echarts/renderers'
import ReactEChartsCore from 'echarts-for-react/lib/core'
import { useEffect, useState } from 'react'
import { useCssVars } from '@/lib/hooks/use-css-vars'

echarts.use([PieChart, SVGRenderer])
const metrics = [
  ['pool_cpu_utilization', 'CPU used'],
  ['hugepages', 'Ready node HugePages committed'],
  ['pool_disk_utilization', 'E2B data disk'],
] as const
const theme = ['--accent-main-highlight', '--stroke'] as const
type Current = {
  pool: string
  observedAt: string
  values: Record<string, number | undefined>
}
export type HugePages = { total: number; used: number; reserved: number }
type Segment = { name: string; value: number; color: string }

function Ring({ segments, label }: { segments: Segment[]; label: string }) {
  return (
    <div className="relative h-32" role="img" aria-label={label}>
      <ReactEChartsCore
        echarts={echarts}
        opts={{ renderer: 'svg' }}
        style={{ height: 128 }}
        option={{
          animation: false,
          series: [
            {
              type: 'pie',
              radius: ['56%', '74%'],
              silent: true,
              label: { show: false },
              data: segments.map(({ name, value, color }) => ({
                name,
                value,
                itemStyle: { color },
              })),
            },
          ],
        }}
      />
      <span className="pointer-events-none absolute inset-0 grid place-items-center text-xl font-semibold tabular-nums">
        {label}
      </span>
    </div>
  )
}

export function PoolCurrent({
  pool,
  dataDisk,
  hugePages,
  hugePagesObservedAt,
}: {
  pool: string
  dataDisk: { used: number; total: number } | null
  hugePages: HugePages | null
  hugePagesObservedAt?: string
}) {
  const [data, setData] = useState<Current>()
  const [failed, setFailed] = useState(false)
  const colors = useCssVars(theme)
  useEffect(() => {
    const controller = new AbortController()
    async function refresh() {
      try {
        const response = await fetch(`/access/pool-current?pool=${pool}`, {
          signal: controller.signal,
        })
        if (!response.ok) throw new Error('Current usage unavailable')
        const snapshot: Current = await response.json()
        if (controller.signal.aborted || snapshot.pool !== pool) return
        setData(snapshot)
        setFailed(false)
      } catch {
        if (!controller.signal.aborted) setFailed(true)
      }
    }
    void refresh()
    const timer = window.setInterval(refresh, 30_000)
    return () => {
      controller.abort()
      window.clearInterval(timer)
    }
  }, [pool])

  return (
    <section aria-label="Current resource usage">
      <div className="mb-2 flex flex-wrap items-baseline justify-between gap-2">
        <h2 className="font-medium">Current resource usage</h2>
        {data && (
          <span className="text-xs text-fg-tertiary">
            Observed {new Date(data.observedAt).toLocaleTimeString()}
          </span>
        )}
      </div>
      {failed && (
        <p role="status" className="mb-2 text-sm text-fg-tertiary">
          {data
            ? 'Refresh failed. Showing the last reading.'
            : 'Current resource usage unavailable.'}
        </p>
      )}
      <div className="grid gap-3 sm:grid-cols-3">
        {metrics.map(([key, label]) => {
          if (key === 'hugepages') {
            const committed = hugePages
              ? ((hugePages.used + hugePages.reserved) / hugePages.total) * 100
              : null
            const parts = hugePages
              ? [
                  {
                    name: 'Used',
                    value: hugePages.used,
                    color: colors['--accent-main-highlight'] || '#ed6900',
                  },
                  {
                    name: 'Reserved',
                    value: hugePages.reserved,
                    color: '#d3942b',
                  },
                  {
                    name: 'Available',
                    value:
                      hugePages.total - hugePages.used - hugePages.reserved,
                    color: colors['--stroke'] || '#666',
                  },
                ]
              : [
                  {
                    name: 'Unavailable',
                    value: 1,
                    color: colors['--stroke'] || '#666',
                  },
                ]
            return (
              <section
                key={key}
                aria-label={label}
                className="rounded-lg border border-stroke bg-bg-1 p-3"
              >
                <h3 className="text-sm font-medium">{label}</h3>
                <Ring
                  label={
                    committed === null
                      ? '—'
                      : `${committed.toFixed(1)}%`
                  }
                  segments={parts}
                />
                {hugePages && (
                  <ul className="flex flex-wrap justify-center gap-x-3 gap-y-1 text-xs text-fg-tertiary">
                    {parts.map((part) => (
                      <li key={part.name}>
                        <span
                          className="mr-1 inline-block size-2 rounded-sm"
                          style={{ backgroundColor: part.color }}
                        />
                        {part.name} {(part.value / 2 ** 30).toFixed(1)} GiB
                      </li>
                    ))}
                  </ul>
                )}
                {hugePagesObservedAt && (
                  <p className="mt-2 text-center text-xs text-fg-tertiary">
                    Observed{' '}
                    {new Date(hugePagesObservedAt).toLocaleTimeString()}
                  </p>
                )}
              </section>
            )
          }
          const disk = key === 'pool_disk_utilization' ? dataDisk : null
          const used = disk
            ? (disk.used / disk.total) * 100
            : data?.values[key]
          const diskUnit = disk && disk.total >= 2 ** 40 ? 'TiB' : 'GiB'
          const diskUnitBytes = diskUnit === 'TiB' ? 2 ** 40 : 2 ** 30
          return (
            <section
              key={key}
              aria-label={label}
              className="rounded-lg border border-stroke bg-bg-1 p-3"
            >
              <h3 className="text-sm font-medium">{label}</h3>
              <Ring
                label={used === undefined ? '—' : `${used.toFixed(1)}%`}
                segments={[
                  {
                    name: 'Used',
                    value: used ?? 0,
                    color: colors['--accent-main-highlight'] || '#ed6900',
                  },
                  {
                    name: 'Remaining',
                    value: 100 - (used ?? 0),
                    color: colors['--stroke'] || '#666',
                  },
                ]}
              />
              {key === 'pool_disk_utilization' && (
                <p className="text-center text-xs text-fg-tertiary">
                  {disk
                    ? `Used ${(disk.used / diskUnitBytes).toFixed(1)} ${diskUnit} of ${(disk.total / diskUnitBytes).toFixed(1)} ${diskUnit}`
                    : 'Used capacity unavailable'}
                </p>
              )}
            </section>
          )
        })}
      </div>
    </section>
  )
}

const statusColors = ['#39995b', '#d3942b', '#5885d6', '#bc5858', '#89919d']

export function PoolFleet({
  statuses,
  running,
  starting,
  slots,
  outside,
}: {
  statuses: string[]
  running: number
  starting: number
  slots: number
  outside: number
}) {
  const counts = new Map<string, number>()
  for (const status of statuses)
    counts.set(status, (counts.get(status) ?? 0) + 1)
  const segments = [...counts]
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([name, value], i) => ({
      name,
      value,
      color: statusColors[i % statusColors.length] ?? '#89919d',
    }))
  if (!segments.length)
    segments.push({ name: 'No nodes', value: 1, color: '#89919d' })
  const free = Math.max(0, slots - running - starting)
  const total = running + starting + free
  const allocation = [
    { name: 'Running', value: running, color: 'bg-accent-main-highlight' },
    { name: 'Starting', value: starting, color: 'bg-accent-warning-highlight' },
    { name: 'Remaining', value: free, color: 'bg-stroke' },
  ]
  return (
    <div className="mt-3 grid gap-3 md:grid-cols-2">
      <section
        className="rounded-lg border border-stroke bg-bg-1 p-3"
        aria-label="Sandbox slots"
      >
        <h3 className="text-sm font-medium">Ready sandbox slots · {slots}</h3>
        <div
          className="my-4 flex h-3 overflow-hidden rounded-full bg-bg-2"
          aria-hidden="true"
        >
          {allocation.map((row) => (
            <div
              key={row.name}
              className={row.color}
              style={{ width: `${total ? (row.value / total) * 100 : 0}%` }}
            />
          ))}
        </div>
        <ul className="flex flex-wrap gap-3 text-sm">
          {allocation.map((row) => (
            <li key={row.name}>
              <span
                className={`mr-1 inline-block size-2 rounded-sm ${row.color}`}
              />
              {row.name} {row.value}
            </li>
          ))}
        </ul>
        <p className="mt-2 text-xs text-fg-tertiary">
          Running on non-ready nodes · {outside}
        </p>
      </section>
      <section
        className="rounded-lg border border-stroke bg-bg-1 p-3"
        aria-label="Node status"
      >
        <h3 className="text-sm font-medium">Node status</h3>
        <div className="grid grid-cols-2 items-center">
          <Ring segments={segments} label={String(statuses.length)} />
          <ul className="space-y-1 text-sm">
            {[...counts]
              .sort(([a], [b]) => a.localeCompare(b))
              .map(([name, count], i) => (
                <li key={name}>
                  <span
                    className="mr-2 inline-block size-2 rounded-sm"
                    style={{
                      backgroundColor: statusColors[i % statusColors.length],
                    }}
                  />
                  {name} · {count}
                </li>
              ))}
          </ul>
        </div>
      </section>
    </div>
  )
}

'use client'

import { useEffect, useState } from 'react'
import { Button } from '@/ui/primitives/button'

const metrics = [
  ['cpu', 'CPU'],
  ['memory', 'Memory'],
  ['disk', 'Disk'],
] as const
type Metric = (typeof metrics)[number][0]
type SandboxUsage = {
  sandboxID: string
  templateID: string
  alias?: string
} & Record<Metric, number | null>
type Usage = {
  pool: string
  observedAt: string
  sandboxes: SandboxUsage[]
  partial: boolean
}

export function PoolUsage({ pool }: { pool: string }) {
  const [metric, setMetric] = useState<Metric>('cpu')
  const [template, setTemplate] = useState('')
  const [active, setActive] = useState<string>()
  const [usage, setUsage] = useState<Usage>()
  const [failed, setFailed] = useState(false)

  useEffect(() => {
    const controller = new AbortController()
    async function refresh() {
      try {
        const response = await fetch(`/access/pool-usage?pool=${pool}`, {
          signal: controller.signal,
          cache: 'no-store',
        })
        if (!response.ok) throw new Error('Usage unavailable')
        const snapshot: Usage = await response.json()
        if (controller.signal.aborted || snapshot.pool !== pool) return
        setUsage(snapshot)
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

  const sandboxes = usage?.pool === pool ? usage.sandboxes : []
  const templates = new Map(
    sandboxes.map((row) => [row.templateID, row.alias || row.templateID])
  )
  const visible = template
    ? sandboxes.filter((row) => row.templateID === template)
    : sandboxes
  const selected = visible.find((row) => row.sandboxID === active)
  const value = (percent: number | null) =>
    percent === null ? 'No sample' : `${percent.toFixed(1)}%`

  return (
    <section aria-label="Sandbox usage heatmap" className="mt-4 space-y-4">
      <div className="flex flex-wrap items-center gap-3">
        <div role="group" aria-label="Resource" className="flex gap-1">
          {metrics.map(([key, label]) => (
            <Button
              key={key}
              aria-pressed={metric === key}
              variant={metric === key ? 'secondary' : 'quaternary'}
              size="small"
              onClick={() => setMetric(key)}
            >
              {label}
            </Button>
          ))}
        </div>
        <label className="flex items-center gap-2 text-sm">
          Template
          <select
            className="max-w-56 rounded border border-stroke bg-bg-1 p-1.5"
            value={template}
            onChange={(event) => setTemplate(event.target.value)}
          >
            <option value="">All templates</option>
            {[...templates]
              .filter(([id]) => id)
              .sort((a, b) => a[1].localeCompare(b[1]))
              .map(([id, label]) => (
                <option key={id} value={id}>
                  {label}
                </option>
              ))}
          </select>
        </label>
      </div>
      {failed && (
        <p role="status" className="text-sm">
          Usage metrics are temporarily unavailable
          {usage ? '. Showing the last snapshot.' : '.'}
        </p>
      )}
      {!usage && !failed && (
        <p role="status" className="text-sm">
          Loading sandbox usage…
        </p>
      )}
      {usage && (
        <>
          <div className="flex flex-wrap items-center justify-between gap-2 text-sm text-fg-tertiary">
            <span>
              {visible.length} running sandboxes ·{' '}
              {visible.filter((row) => row[metric] === null).length} without
              samples
            </span>
            <span>Observed {new Date(usage.observedAt).toLocaleString()}</span>
          </div>
          {usage.partial && (
            <p role="status" className="text-sm text-accent-warning-highlight">
              Some sandbox or template data is unavailable.
            </p>
          )}
          <div className="rounded-lg border border-stroke bg-bg-1 p-4">
            <div className="mb-3 flex flex-wrap items-center gap-2 text-xs text-fg-tertiary">
              <span>0%</span>
              <span
                aria-hidden="true"
                className="h-2 w-28 rounded"
                style={{
                  background:
                    'linear-gradient(90deg, hsl(130 62% 42%), hsl(65 62% 42%), hsl(0 62% 42%))',
                }}
              />
              <span>100%</span>
              <span
                className="ml-2 inline-block size-3 rounded-sm bg-fg-tertiary"
                aria-hidden="true"
              />
              <span>No sample</span>
            </div>
            {visible.length === 0 && (
              <p className="text-sm">No running sandboxes match this filter.</p>
            )}
            <div className="grid grid-cols-[repeat(auto-fill,14px)] gap-1">
              {visible.map((row) => {
                const percent = row[metric]
                const label = `${row.sandboxID} · ${row.alias || row.templateID || 'Unknown template'} · ${value(percent)}`
                return (
                  <button
                    type="button"
                    key={row.sandboxID}
                    aria-label={label}
                    title={label}
                    className="size-3.5 rounded-sm bg-fg-tertiary hover:outline focus-visible:outline"
                    onFocus={() => setActive(row.sandboxID)}
                    onPointerEnter={() => setActive(row.sandboxID)}
                    onClick={() => setActive(row.sandboxID)}
                    style={
                      percent === null
                        ? undefined
                        : {
                            backgroundColor: `hsl(${130 * (1 - Math.min(100, percent) / 100)} 62% 42%)`,
                          }
                    }
                  />
                )
              })}
            </div>
            {selected && (
              <p className="mt-3 break-all text-xs text-fg-tertiary">
                {selected.sandboxID} ·{' '}
                {selected.alias || selected.templateID || 'Unknown template'} ·{' '}
                {value(selected[metric])}
              </p>
            )}
          </div>
        </>
      )}
    </section>
  )
}

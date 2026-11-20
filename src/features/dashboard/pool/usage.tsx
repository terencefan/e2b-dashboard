'use client'

import { useEffect, useState } from 'react'

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
  creator?: { id: string; name?: string }
} & Record<Metric, number | null>
type Usage = {
  pool: string
  observedAt: string
  sandboxes: SandboxUsage[]
  partial: boolean
}

export function usePoolUsage(pool: string) {
  const [usage, setUsage] = useState<Usage>()
  const [failed, setFailed] = useState(false)
  const [enabled, setEnabled] = useState(false)

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
    let timer: number | undefined
    async function start() {
      try {
        const capability = await fetch('/access/pool-capability', {
          signal: controller.signal,
          cache: 'no-store',
        })
        if (capability.status !== 204 || controller.signal.aborted) return
        setEnabled(true)
        void refresh()
        timer = window.setInterval(refresh, 30_000)
      } catch {
        // The dashboard can run without the Access Gate.
      }
    }
    void start()
    return () => {
      controller.abort()
      window.clearInterval(timer)
    }
  }, [pool])

  return { usage, enabled, failed }
}

export function filterSandboxUsage(
  sandboxes: SandboxUsage[],
  template: string,
  creator: string
) {
  return sandboxes.filter(
    (row) =>
      (!template || row.templateID === template) &&
      (!creator || (row.creator?.id ?? 'unknown') === creator)
  )
}

function UsageFilter({
  label,
  all,
  options,
  value,
  onChange,
  disabled,
}: {
  label: string
  all: string
  options: Map<string, string>
  value: string
  onChange: (value: string) => void
  disabled: boolean
}) {
  return (
    <label className="flex min-w-0 items-center gap-2">
      <span className="prose-label text-fg-tertiary uppercase">{label}</span>
      <select
        className="prose-body h-8 max-w-48 min-w-0 border-x border-stroke bg-bg px-2 text-fg hover:bg-bg-hover focus-visible:outline-accent-main-highlight disabled:opacity-50"
        value={value}
        onChange={(event) => onChange(event.target.value)}
        disabled={disabled}
      >
        <option value="">{all}</option>
        {value && !options.has(value) && <option value={value}>{value}</option>}
        {[...options]
          .sort((a, b) => a[1].localeCompare(b[1]))
          .map(([id, name]) => (
            <option key={id} value={id}>
              {name}
            </option>
          ))}
      </select>
    </label>
  )
}

export function PoolUsage({
  usage,
  failed,
  creator,
  onCreatorChange,
  template,
  onTemplateChange,
}: {
  usage?: Usage
  failed: boolean
  creator: string
  onCreatorChange: (creator: string) => void
  template: string
  onTemplateChange: (template: string) => void
}) {
  const [active, setActive] = useState<string>()
  const sandboxes = usage?.sandboxes ?? []
  const creators = new Map(
    sandboxes.map((row) => [
      row.creator?.id ?? 'unknown',
      row.creator?.name || row.creator?.id || 'Unknown creator',
    ])
  )
  const templates = new Map(
    sandboxes
      .filter((row) => row.templateID)
      .map((row) => [row.templateID, row.alias || row.templateID])
  )
  const visible = filterSandboxUsage(sandboxes, template, creator)
  const selected = visible.find((row) => row.sandboxID === active)
  const value = (percent: number | null) =>
    percent === null ? 'No sample' : `${percent.toFixed(1)}%`

  return (
    <section
      aria-label="Sandbox usage heatmap"
      className="shrink-0 border border-stroke bg-bg"
    >
      <div className="flex min-h-9 flex-wrap items-center justify-between gap-x-3 border-b border-stroke px-3">
        <div className="flex min-w-0 flex-wrap items-center gap-x-4">
          <UsageFilter
            label="Creator"
            all="All creators"
            options={creators}
            value={creator}
            onChange={onCreatorChange}
            disabled={!usage}
          />
          <UsageFilter
            label="Template"
            all="All templates"
            options={templates}
            value={template}
            onChange={onTemplateChange}
            disabled={!usage}
          />
        </div>
        {usage && (
          <span className="prose-label text-fg-tertiary uppercase">
            {visible.length} running ·{' '}
            <time
              dateTime={usage.observedAt}
              title={new Date(usage.observedAt).toLocaleString()}
            >
              {new Date(usage.observedAt).toLocaleTimeString()}
            </time>
          </span>
        )}
      </div>

      <div className="grid min-w-0 grid-cols-3 divide-x divide-stroke">
        {metrics.map(([metric, title]) => (
          <section key={metric} aria-label={title} className="min-w-0">
            <h2 className="prose-label-highlight flex h-8 items-center border-b border-stroke px-3 text-fg uppercase">
              {title}
            </h2>
            <div className="grid min-h-11 max-h-24 grid-cols-[repeat(auto-fill,12px)] content-start gap-[3px] overflow-y-auto p-3">
              {visible.map((row) => {
                const percent = row[metric]
                const label = `${row.sandboxID} · ${row.alias || row.templateID || 'Unknown template'} · ${value(percent)}`
                return (
                  <button
                    type="button"
                    key={row.sandboxID}
                    aria-label={label}
                    title={label}
                    className={`size-3 border border-stroke bg-bg-1 hover:outline focus-visible:outline ${active === row.sandboxID ? 'outline outline-1 outline-offset-1 outline-fg' : ''}`}
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
          </section>
        ))}
      </div>

      <div className="flex min-h-8 flex-wrap items-center gap-x-4 gap-y-1 border-t border-stroke px-3 py-1.5">
        <div className="prose-label flex shrink-0 items-center gap-1.5 text-fg-tertiary uppercase">
          <span>0%</span>
          <span
            aria-hidden="true"
            className="h-1.5 w-12"
            style={{
              background:
                'linear-gradient(90deg, hsl(130 62% 42%), hsl(65 62% 42%), hsl(0 62% 42%))',
            }}
          />
          <span>100%</span>
          <span
            className="ml-1 size-2 border border-stroke bg-bg-1"
            aria-hidden="true"
          />
          <span>No sample</span>
        </div>
        {failed ? (
          <output className="text-xs text-accent-warning-highlight">
            {usage
              ? 'Showing the last snapshot.'
              : 'Usage metrics unavailable.'}
          </output>
        ) : !usage ? (
          <output className="text-xs text-fg-tertiary">
            Loading sandbox usage…
          </output>
        ) : usage.partial ? (
          <output className="text-xs text-accent-warning-highlight">
            Some sandbox data is unavailable.
          </output>
        ) : visible.length === 0 ? (
          <p className="text-xs text-fg-tertiary">
            No running sandboxes match this filter.
          </p>
        ) : selected ? (
          <p className="min-w-0 flex-1 truncate font-mono text-xs text-fg-secondary">
            {selected.sandboxID} ·{' '}
            {selected.creator?.name ||
              selected.creator?.id ||
              'Unknown creator'}{' '}
            ·{' '}
            {metrics
              .map(([metric, title]) => `${title} ${value(selected[metric])}`)
              .join(' · ')}
          </p>
        ) : null}
      </div>
    </section>
  )
}

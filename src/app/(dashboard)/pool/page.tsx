'use client'

import { useEffect, useState } from 'react'
import { PoolTrends } from '@/features/dashboard/pool/trends'
import { useClientConfig } from '@/features/client-config-provider'

type PoolNode = {
  id: string
  status: string
  sandboxCount: number
  sandboxStartingCount: number
  maxSandboxes: number
  metrics: {
    allocatedCPU: number
    cpuCount: number
    allocatedMemoryBytes: number
    hugePagesTotal: number
    hugePagesUsed: number
    hugePagesReserved: number
    hugePageSizeBytes: number
  } | null
  disk: [number | null, number | null, number | null]
}

type Snapshot = { pool: string; observedAt: string; nodes: PoolNode[] }

function sum(nodes: PoolNode[], value: (node: PoolNode) => number | null) {
  return nodes.reduce<number | null>((total, node) => {
    const next = value(node)
    return total === null || next === null ? null : total + next
  }, 0)
}

const count = (value: number | null) => value?.toLocaleString() ?? '—'
const gib = (value: number | null) =>
  value === null
    ? '—'
    : `${(value / 2 ** 30).toLocaleString(undefined, { maximumFractionDigits: 1 })} GiB`

function CapacityBar({
  label,
  value,
  capacity,
}: {
  label: string
  value: number | null
  capacity: number | null
}) {
  if (value === null || capacity === null || capacity <= 0) return null
  const percentage = Math.round((value / capacity) * 100)
  const color =
    percentage >= 95
      ? 'bg-accent-error-highlight'
      : percentage >= 70
        ? 'bg-accent-warning-highlight'
        : 'bg-accent-main-highlight'
  return (
    <div className="mt-4">
      <div className="mb-1.5 flex justify-between gap-2 text-xs text-fg-tertiary">
        <span>{label}</span>
        <span className="tabular-nums">{percentage}%</span>
      </div>
      <div
        role="meter"
        aria-label={label}
        aria-valuemin={0}
        aria-valuemax={100}
        aria-valuenow={Math.min(100, percentage)}
        aria-valuetext={`${percentage}%`}
        className="h-1.5 overflow-hidden rounded-full bg-bg-2"
      >
        <div
          className={`h-full rounded-full ${color}`}
          style={{ width: `${Math.min(100, percentage)}%` }}
        />
      </div>
    </div>
  )
}

export default function PoolPage() {
  const { executionPool = 'pilot' } = useClientConfig()
  const [snapshot, setSnapshot] = useState<Snapshot>()
  const [failedPool, setFailedPool] = useState<string>()
  const current = snapshot?.pool === executionPool ? snapshot : undefined
  useEffect(() => {
    const controller = new AbortController()
    async function refresh() {
      try {
        const response = await fetch(
          `/access/pool-summary?pool=${executionPool}`,
          {
            signal: controller.signal,
            cache: 'no-store',
          }
        )
        if (!response.ok) throw new Error('Pool unavailable')
        const data: Snapshot = await response.json()
        if (!controller.signal.aborted && data.pool === executionPool) {
          setSnapshot(data)
          setFailedPool(undefined)
        }
      } catch {
        if (!controller.signal.aborted) setFailedPool(executionPool)
      }
    }
    void refresh()
    const interval = window.setInterval(refresh, 30_000)
    return () => {
      controller.abort()
      window.clearInterval(interval)
    }
  }, [executionPool])
  const nodes = current?.nodes ?? []
  const ready = nodes.filter((node) => node.status === 'ready')
  const cards = [
    {
      title: 'Sandboxes',
      bar: (
        <CapacityBar
          label="Ready slots occupied"
          value={sum(ready, (n) => n.sandboxCount + n.sandboxStartingCount)}
          capacity={sum(ready, (n) => Math.max(0, n.maxSandboxes))}
        />
      ),
      rows: [
        ['Running', count(sum(nodes, (n) => n.sandboxCount))],
        ['Starting', count(sum(nodes, (n) => n.sandboxStartingCount))],
        ['Ready nodes', `${ready.length} / ${nodes.length}`],
        [
          'Ready sandbox slots',
          count(sum(ready, (n) => Math.max(0, n.maxSandboxes))),
        ],
      ],
    },
    {
      title: 'CPU',
      bar: (
        <CapacityBar
          label="Ready CPU allocated"
          value={sum(ready, (n) => n.metrics?.allocatedCPU ?? null)}
          capacity={sum(ready, (n) => n.metrics?.cpuCount ?? null)}
        />
      ),
      rows: [
        [
          'Allocated vCPU',
          count(sum(nodes, (n) => n.metrics?.allocatedCPU ?? null)),
        ],
        [
          'Ready CPU capacity (cores)',
          count(sum(ready, (n) => n.metrics?.cpuCount ?? null)),
        ],
      ],
    },
    {
      title: 'Memory',
      bar: (
        <CapacityBar
          label="Ready HugePages used"
          value={sum(ready, (n) =>
            n.metrics
              ? n.metrics.hugePagesUsed * n.metrics.hugePageSizeBytes
              : null
          )}
          capacity={sum(ready, (n) =>
            n.metrics
              ? n.metrics.hugePagesTotal * n.metrics.hugePageSizeBytes
              : null
          )}
        />
      ),
      rows: [
        [
          'Allocated',
          gib(sum(nodes, (n) => n.metrics?.allocatedMemoryBytes ?? null)),
        ],
        [
          'Ready HugePages capacity',
          gib(
            sum(ready, (n) =>
              n.metrics
                ? n.metrics.hugePagesTotal * n.metrics.hugePageSizeBytes
                : null
            )
          ),
        ],
        [
          'HugePages used',
          gib(
            sum(nodes, (n) =>
              n.metrics
                ? n.metrics.hugePagesUsed * n.metrics.hugePageSizeBytes
                : null
            )
          ),
        ],
        [
          'HugePages reserved',
          gib(
            sum(nodes, (n) =>
              n.metrics
                ? n.metrics.hugePagesReserved * n.metrics.hugePageSizeBytes
                : null
            )
          ),
        ],
      ],
    },
    {
      title: 'Disk',
      bar: (
        <CapacityBar
          label="Physical disk used"
          value={sum(nodes, (n) => n.disk[1])}
          capacity={sum(nodes, (n) => n.disk[2])}
        />
      ),
      rows: [
        ['Sandbox allocation', gib(sum(nodes, (n) => n.disk[0]))],
        ['Physical used', gib(sum(nodes, (n) => n.disk[1]))],
        ['Physical capacity', gib(sum(nodes, (n) => n.disk[2]))],
      ],
    },
  ]

  return (
    <main className="h-full min-h-0 w-full overflow-y-auto p-3 md:p-6">
      <PoolTrends key={executionPool} pool={executionPool} />
      {failedPool === executionPool && (
        <p role="status" className="mt-2 text-sm text-fg-tertiary">
          Pool metrics are temporarily unavailable
          {current ? '. Showing the last snapshot.' : '.'}
        </p>
      )}
      {!current && failedPool !== executionPool && (
        <p role="status" className="mt-2">
          Loading node snapshot…
        </p>
      )}
      {current && (
        <>
          <p className="mt-1 text-sm text-fg-tertiary">
            Observed {new Date(current.observedAt).toLocaleString()}
          </p>
          <div className="mt-4 grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-4">
            {cards.map(({ title, rows, bar }) => (
              <section
                key={title}
                className="rounded-lg border border-stroke bg-bg-1 p-4"
              >
                <h2 className="mb-3 font-medium">{title}</h2>
                <dl className="space-y-2 text-sm">
                  {rows.map(([label, value]) => (
                    <div key={label} className="flex justify-between gap-2">
                      <dt className="text-fg-tertiary">{label}</dt>
                      <dd className="whitespace-nowrap tabular-nums">
                        {value}
                      </dd>
                    </div>
                  ))}
                </dl>
                {bar}
              </section>
            ))}
          </div>
          <h2 className="mt-6 font-medium">Nodes</h2>
          <div className="mt-2 overflow-x-auto rounded-lg border border-stroke">
            <table className="w-full whitespace-nowrap text-left text-sm">
              <thead>
                <tr>
                  {[
                    'Node',
                    'Status',
                    'Running',
                    'Starting',
                    'Allocated vCPU',
                    'Allocated memory',
                    'Physical disk used / capacity',
                  ].map((label) => (
                    <th key={label} scope="col" className="p-3 font-medium">
                      {label}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {nodes.map((node) => (
                  <tr key={node.id} className="border-t border-stroke">
                    {[
                      node.id,
                      node.status,
                      count(node.sandboxCount),
                      count(node.sandboxStartingCount),
                      count(node.metrics?.allocatedCPU ?? null),
                      gib(node.metrics?.allocatedMemoryBytes ?? null),
                      `${gib(node.disk[1])} / ${gib(node.disk[2])}`,
                    ].map((value, index) => (
                      <td key={index} className="p-3 tabular-nums">
                        {value}
                      </td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
            {nodes.length === 0 && (
              <p className="p-3 text-sm text-fg-tertiary">No nodes reported.</p>
            )}
          </div>
        </>
      )}
    </main>
  )
}

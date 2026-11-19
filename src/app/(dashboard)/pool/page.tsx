'use client'

import { useEffect, useState } from 'react'
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
      rows: [
        ['Sandbox allocation', gib(sum(nodes, (n) => n.disk[0]))],
        ['Physical used', gib(sum(nodes, (n) => n.disk[1]))],
        ['Physical capacity', gib(sum(nodes, (n) => n.disk[2]))],
      ],
    },
  ]

  return (
    <main className="h-full overflow-y-auto p-4 md:p-6">
      <h1 className="text-xl font-semibold">
        {executionPool === 'production' ? 'Production' : 'Pilot'} Pool
      </h1>
      {failedPool === executionPool && (
        <p role="status" className="mt-2 text-sm text-fg-tertiary">
          Pool metrics are temporarily unavailable
          {current ? '. Showing the last snapshot.' : '.'}
        </p>
      )}
      {!current && failedPool !== executionPool && (
        <p role="status" className="mt-2">
          Loading pool metrics…
        </p>
      )}
      {current && (
        <>
          <p className="mt-1 text-sm text-fg-tertiary">
            Observed {new Date(current.observedAt).toLocaleString()}
          </p>
          <div className="mt-4 grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-4">
            {cards.map(({ title, rows }) => (
              <section
                key={title}
                className="rounded-lg border border-stroke p-4"
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

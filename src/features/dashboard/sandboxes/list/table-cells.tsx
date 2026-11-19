'use client'

import type { CellContext } from '@tanstack/react-table'
import Link from 'next/link'
import {
  createContext,
  type ReactNode,
  useContext,
  useEffect,
  useMemo,
  useState,
} from 'react'
import { toast } from 'sonner'
import { PROTECTED_URLS } from '@/configs/urls'
import ResourceUsage from '@/features/dashboard/common/resource-usage'
import { useTimezone } from '@/features/dashboard/timezone'
import { formatDateParts, formatDurationCompact } from '@/lib/utils/formatting'
import { Badge } from '@/ui/primitives/badge'
import { Button } from '@/ui/primitives/button'
import { DotIcon, ExternalLinkIcon, PausedIcon } from '@/ui/primitives/icons'
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/ui/primitives/popover'
import { useSandboxMetricsStore } from './stores/metrics-store'
import type { SandboxListRow } from './table-config'

const USAGE_TEXT_CLASSNAME = 'prose-table-numeric text-right'
const MONO_NUMERIC_TEXT_CLASSNAME =
  'overflow-x-hidden whitespace-nowrap font-mono prose-table-numeric'
// Started At needs to fit the date, time, and timezone (e.g. "GMT+2") within a
// fixed-width column, so it drops font-mono for the narrower tabular figures.
const TIMESTAMP_TEXT_CLASSNAME =
  'overflow-hidden whitespace-nowrap prose-table-numeric'

// Live usage is only available for running sandboxes; paused sandboxes fall
// back to their allocated specs.

const CpuUsageCellView = ({
  sandboxId,
  totalCpu,
}: {
  sandboxId: string
  totalCpu?: number
}) => {
  const cpuUsedPct = useSandboxMetricsStore(
    (state) => state.metrics?.[sandboxId]?.cpuUsedPct
  )

  return (
    <ResourceUsage
      type="cpu"
      metrics={cpuUsedPct}
      total={totalCpu}
      classNames={{ wrapper: USAGE_TEXT_CLASSNAME }}
    />
  )
}

const RamUsageCellView = ({
  sandboxId,
  totalMem,
}: {
  sandboxId: string
  totalMem?: number
}) => {
  const memUsedMb = useSandboxMetricsStore(
    (state) => state.metrics?.[sandboxId]?.memUsedMb
  )

  return (
    <ResourceUsage
      type="mem"
      metrics={memUsedMb}
      total={totalMem}
      classNames={{ wrapper: USAGE_TEXT_CLASSNAME }}
    />
  )
}

const DiskUsageCellView = ({
  sandboxId,
  totalDiskGb,
}: {
  sandboxId: string
  totalDiskGb: number
}) => {
  const diskUsedGb = useSandboxMetricsStore(
    (state) => state.metrics?.[sandboxId]?.diskUsedGb
  )

  return (
    <ResourceUsage
      type="disk"
      metrics={diskUsedGb}
      total={totalDiskGb}
      classNames={{ wrapper: USAGE_TEXT_CLASSNAME }}
    />
  )
}

export const CpuUsageCell = ({ row }: CellContext<SandboxListRow, unknown>) => (
  <div className="flex w-full justify-end">
    {row.original.state === 'running' ? (
      <CpuUsageCellView
        sandboxId={row.original.sandboxID}
        totalCpu={row.original.cpuCount}
      />
    ) : (
      <ResourceUsage
        type="cpu"
        mode="simple"
        total={row.original.cpuCount}
        classNames={{ wrapper: USAGE_TEXT_CLASSNAME }}
      />
    )}
  </div>
)

export const RamUsageCell = ({ row }: CellContext<SandboxListRow, unknown>) => (
  <div className="flex w-full justify-end">
    {row.original.state === 'running' ? (
      <RamUsageCellView
        sandboxId={row.original.sandboxID}
        totalMem={row.original.memoryMB}
      />
    ) : (
      <ResourceUsage
        type="mem"
        mode="simple"
        total={row.original.memoryMB}
        classNames={{ wrapper: USAGE_TEXT_CLASSNAME }}
      />
    )}
  </div>
)

export const DiskUsageCell = ({
  row,
}: CellContext<SandboxListRow, unknown>) => (
  <div className="flex w-full justify-end">
    {row.original.state === 'running' ? (
      <DiskUsageCellView
        sandboxId={row.original.sandboxID}
        totalDiskGb={row.original.diskSizeMB / 1024}
      />
    ) : (
      <ResourceUsage
        type="disk"
        mode="simple"
        total={row.original.diskSizeMB / 1024}
        classNames={{ wrapper: USAGE_TEXT_CLASSNAME }}
      />
    )}
  </div>
)

export function StateCell({ row }: CellContext<SandboxListRow, unknown>) {
  const state = row.original.state

  if (state === 'paused') {
    return (
      <Badge variant="warning" className="uppercase">
        <PausedIcon className="size-2 fill-current" />
        Paused
      </Badge>
    )
  }

  return (
    <Badge variant="positive" className="uppercase">
      <DotIcon className="size-3 animate-pulse fill-current" />
      Running
    </Badge>
  )
}

export function IdCell({ getValue }: CellContext<SandboxListRow, unknown>) {
  return (
    <div
      className={`${MONO_NUMERIC_TEXT_CLASSNAME} text-fg-tertiary select-all`}
    >
      {getValue() as string}
    </div>
  )
}

export function TemplateCell({
  row,
  getValue,
}: CellContext<SandboxListRow, unknown>) {
  const templateIdentifier = (getValue() as string | undefined) ?? '--'
  const templateId = row.original.templateID

  if (!templateId) {
    return (
      <span className="min-w-0 truncate text-fg-tertiary">
        {templateIdentifier}
      </span>
    )
  }

  return (
    <Button asChild variant="link-table" size="none">
      <Link
        href={PROTECTED_URLS.TEMPLATE_OVERVIEW(templateId)}
        onClick={(e) => e.stopPropagation()}
      >
        <span className="min-w-0 truncate">{templateIdentifier}</span>
        <ExternalLinkIcon className="size-3 shrink-0" />
      </Link>
    </Button>
  )
}

const metadataPriority = ['swe2_node', 'swe2_verify', 'swe2_role', 'swe2_run']

export function MetadataCell({ row }: CellContext<SandboxListRow, unknown>) {
  const metadata = row.original.metadata ?? {}
  const entries = Object.entries(metadata).sort(([a], [b]) =>
    a.localeCompare(b)
  )
  if (!entries.length) return <span className="text-fg-tertiary">—</span>

  const preferred = metadataPriority.flatMap((key) =>
    Object.hasOwn(metadata, key) ? [[key, metadata[key]]] : []
  )
  const preview = [
    ...preferred,
    ...entries.filter(([key]) => !metadataPriority.includes(key)),
  ].slice(0, 2)
  const remaining = entries.length - preview.length

  async function copyMetadata() {
    try {
      await navigator.clipboard.writeText(JSON.stringify(metadata, null, 2))
      toast.success('Metadata copied')
    } catch {
      toast.error('Could not copy metadata')
    }
  }

  return (
    <Popover>
      <PopoverTrigger asChild>
        <button
          type="button"
          aria-label={`View metadata for ${row.original.sandboxID}`}
          className="flex w-full min-w-0 cursor-pointer items-center gap-1.5 text-left text-xs hover:text-fg focus-visible:outline focus-visible:outline-offset-2"
        >
          {preview.map(([key, value]) => (
            <span
              key={key}
              className="min-w-0 truncate rounded bg-bg-1 px-1.5 py-0.5"
            >
              <span className="text-fg-tertiary">{key}: </span>
              {value}
            </span>
          ))}
          {remaining > 0 && (
            <span className="shrink-0 text-fg-tertiary">+{remaining}</span>
          )}
        </button>
      </PopoverTrigger>
      <PopoverContent
        aria-label="Sandbox metadata"
        align="end"
        className="w-96 max-w-[calc(100vw-20px)] max-h-[var(--radix-popover-content-available-height)] overflow-y-auto"
      >
        <div className="flex items-center justify-between gap-2 border-b border-stroke pb-2">
          <span className="text-sm font-medium">Metadata</span>
          <Button
            type="button"
            variant="secondary"
            size="small"
            onClick={copyMetadata}
          >
            Copy JSON
          </Button>
        </div>
        <dl className="grid grid-cols-[minmax(0,2fr)_minmax(0,3fr)] gap-x-3 gap-y-2 py-2 text-xs">
          {entries.map(([key, value]) => (
            <div key={key} className="contents">
              <dt className="break-all text-fg-tertiary">{key}</dt>
              <dd className="whitespace-pre-wrap break-all font-mono">
                {value}
              </dd>
            </div>
          ))}
        </dl>
      </PopoverContent>
    </Popover>
  )
}

export function StartedAtCell({
  getValue,
}: CellContext<SandboxListRow, unknown>) {
  const { timezone } = useTimezone()
  const dateValue = (getValue() as string | undefined) ?? ''

  const formattedTimestamp = useMemo(() => {
    return formatDateParts(dateValue, { timezone })
  }, [dateValue, timezone])

  return (
    <div className={`h-full ${TIMESTAMP_TEXT_CLASSNAME}`}>
      <span className="text-fg-tertiary">
        {formattedTimestamp?.datePart ?? '--'}
      </span>{' '}
      {formattedTimestamp?.timePart ?? '--'}{' '}
      <span className="text-fg-tertiary">
        {formattedTimestamp?.timezonePart ?? ''}
      </span>
    </div>
  )
}

const SandboxClockContext = createContext<number | null>(null)

export function SandboxClock({ children }: { children: ReactNode }) {
  const [now, setNow] = useState<number | null>(null)
  useEffect(() => {
    const tick = () => setNow(Date.now())
    tick()
    const timer = window.setInterval(tick, 1000)
    return () => window.clearInterval(timer)
  }, [])
  return <SandboxClockContext value={now}>{children}</SandboxClockContext>
}

export function SandboxUptimeCell({
  row,
}: CellContext<SandboxListRow, unknown>) {
  const now = useContext(SandboxClockContext)
  const startedAt = Date.parse(row.original.startedAt)
  if (
    row.original.state !== 'running' ||
    now === null ||
    !Number.isFinite(startedAt)
  ) {
    return <span className="text-fg-tertiary">—</span>
  }

  return (
    <span className={TIMESTAMP_TEXT_CLASSNAME}>
      {formatDurationCompact(Math.max(0, now - startedAt))}
    </span>
  )
}

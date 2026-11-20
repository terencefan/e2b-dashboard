'use client'

import { Suspense, useMemo, useState } from 'react'
import { useClientConfig } from '@/features/client-config-provider'
import LoadingLayout from '@/features/dashboard/loading-layout'
import { usePoolUsage } from '@/features/dashboard/pool/usage'
import { FilterDropdown } from './filter-dropdown'
import { NewSandboxesTable } from './table'

function sortedOptions(entries: [string, string][]) {
  return new Map([...new Map(entries)].sort((a, b) => a[1].localeCompare(b[1])))
}

function SandboxesPoolContent({ pool }: { pool: string }) {
  const [creators, setCreators] = useState<string[]>([])
  const [templates, setTemplates] = useState<string[]>([])
  const { usage, enabled, failed } = usePoolUsage(pool)
  const options = useMemo(() => {
    const rows = usage?.sandboxes ?? []
    return {
      creators: sortedOptions(
        rows.map((row) => [
          row.creator?.id ?? 'unknown',
          row.creator?.name || row.creator?.id || 'Unknown creator',
        ])
      ),
      templates: sortedOptions(
        rows
          .filter((row) => row.templateID)
          .map((row) => [row.templateID, row.alias || row.templateID])
      ),
    }
  }, [usage])
  const creatorRows = useMemo(
    () =>
      (usage?.sandboxes ?? []).filter(
        (row) =>
          !creators.length || creators.includes(row.creator?.id ?? 'unknown')
      ),
    [usage, creators]
  )
  const creatorSandboxIDs = useMemo(
    () =>
      creators.length
        ? new Set(creatorRows.map((row) => row.sandboxID))
        : undefined,
    [creatorRows, creators.length]
  )
  return (
    <div className="flex h-full min-h-0 flex-col gap-3 overflow-y-auto p-3 md:max-w-[calc(100svw-var(--sidebar-width-active))] md:p-6">
      <Suspense fallback={<LoadingLayout />}>
        <NewSandboxesTable
          heatmap={enabled ? { usage, failed } : undefined}
          creators={creators}
          creatorSandboxIDs={creatorSandboxIDs}
          templates={templates}
          usageFilters={
            enabled && (
              <>
                <FilterDropdown
                  label="CREATOR"
                  options={options.creators}
                  selected={creators}
                  onChange={setCreators}
                  disabled={!options.creators.size && !creators.length}
                />
                <FilterDropdown
                  label="TEMPLATE"
                  options={options.templates}
                  selected={templates}
                  onChange={setTemplates}
                  disabled={!options.templates.size && !templates.length}
                />
              </>
            )
          }
          clearUsageFilters={() => {
            setCreators([])
            setTemplates([])
          }}
        />
      </Suspense>
    </div>
  )
}

export function SandboxesPageContent() {
  const { executionPool = 'pilot' } = useClientConfig()
  return <SandboxesPoolContent key={executionPool} pool={executionPool} />
}

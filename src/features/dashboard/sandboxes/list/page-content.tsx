'use client'

import { Suspense, useMemo, useState } from 'react'
import { useClientConfig } from '@/features/client-config-provider'
import LoadingLayout from '@/features/dashboard/loading-layout'
import {
  filterSandboxUsage,
  PoolUsage,
  usePoolUsage,
} from '@/features/dashboard/pool/usage'
import { NewSandboxesTable } from './table'

function SandboxesPoolContent({ pool }: { pool: string }) {
  const [creator, setCreator] = useState('')
  const [template, setTemplate] = useState('')
  const { usage, enabled, failed } = usePoolUsage(pool)
  const creatorSandboxIDs = useMemo(
    () =>
      creator && usage
        ? new Set(
            filterSandboxUsage(usage.sandboxes, template, creator).map(
              (row) => row.sandboxID
            )
          )
        : undefined,
    [creator, template, usage]
  )

  return (
    <div className="flex h-full min-h-0 flex-col gap-3 overflow-y-auto p-3 md:max-w-[calc(100svw-var(--sidebar-width-active))] md:p-6">
      {enabled && (
        <PoolUsage
          usage={usage}
          failed={failed}
          creator={creator}
          onCreatorChange={setCreator}
          template={template}
          onTemplateChange={setTemplate}
        />
      )}
      <Suspense fallback={<LoadingLayout />}>
        <NewSandboxesTable
          creatorSandboxIDs={creatorSandboxIDs}
          templateID={template}
          clearUsageFilters={() => {
            setCreator('')
            setTemplate('')
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

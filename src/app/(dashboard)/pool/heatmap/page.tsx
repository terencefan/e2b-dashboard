'use client'

import { useClientConfig } from '@/features/client-config-provider'
import { PoolUsage } from '@/features/dashboard/pool/usage'

export default function SandboxHeatmapPage() {
  const { executionPool = 'pilot' } = useClientConfig()
  return (
    <main className="h-full min-h-0 w-full overflow-y-auto p-3 md:p-6">
      <h1 className="text-xl font-semibold">
        {executionPool === 'production' ? 'Production' : 'Pilot'} Sandbox
        Heatmap
      </h1>
      <PoolUsage key={executionPool} pool={executionPool} />
    </main>
  )
}

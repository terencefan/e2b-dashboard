'use client'

import { useClientConfig } from '@/features/client-config-provider'
import { PoolUsage } from '@/features/dashboard/pool/usage'

export default function SandboxHeatmapPage() {
  const { executionPool = 'pilot' } = useClientConfig()
  return (
    <main className="h-full min-h-0 w-full overflow-y-auto p-3 md:p-6">
      <PoolUsage key={executionPool} pool={executionPool} />
    </main>
  )
}

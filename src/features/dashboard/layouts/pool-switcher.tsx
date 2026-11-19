'use client'

import { useState } from 'react'
import { useClientConfig } from '@/features/client-config-provider'
import { Button } from '@/ui/primitives/button'

export function PoolSwitcher() {
  const { executionPool = 'pilot' } = useClientConfig()
  const [switching, setSwitching] = useState(false)
  const nextPool = executionPool === 'pilot' ? 'production' : 'pilot'
  const label = executionPool === 'pilot' ? 'Pilot' : 'Production'
  const nextLabel = nextPool === 'pilot' ? 'Pilot' : 'Production'

  return (
    <Button
      type="button"
      variant="secondary"
      aria-label="Execution pool"
      title={`Current: ${label}. Switch to ${nextLabel}`}
      className="w-36 shrink-0 gap-2"
      disabled={switching}
      onClick={() => {
        setSwitching(true)
        // Reloading discards requests and terminal state from the previous pool.
        const destination = new URL(
          location.pathname === '/pool' ? '/pool' : '/sandboxes',
          location.origin
        )
        destination.searchParams.set('pool', nextPool)
        location.assign(destination.href)
      }}
    >
      {label}
      <span aria-hidden="true">⇄</span>
    </Button>
  )
}

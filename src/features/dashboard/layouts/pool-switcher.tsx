'use client'

import { useState } from 'react'
import { useClientConfig } from '@/features/client-config-provider'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/ui/primitives/select'

export function PoolSwitcher() {
  const { executionPool = 'pilot' } = useClientConfig()
  const [switching, setSwitching] = useState(false)

  return (
    <Select
      value={executionPool}
      disabled={switching}
      onValueChange={(value) => {
        if (value !== 'production' && value !== 'pilot') return
        setSwitching(true)
        // Reloading discards requests and terminal state from the previous pool.
        const destination = new URL('/sandboxes', location.origin)
        destination.searchParams.set('pool', value)
        location.assign(destination.href)
      }}
    >
      <SelectTrigger aria-label="Execution pool" className="w-36 shrink-0">
        <SelectValue />
      </SelectTrigger>
      <SelectContent>
        <SelectItem value="production">Production</SelectItem>
        <SelectItem value="pilot">Pilot</SelectItem>
      </SelectContent>
    </Select>
  )
}

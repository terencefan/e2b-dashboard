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
  const { executionPool = 'production' } = useClientConfig()
  const [switching, setSwitching] = useState(false)

  return (
    <Select
      value={executionPool}
      disabled={switching}
      onValueChange={(value) => {
        if (value !== 'production' && value !== 'pilot') return
        setSwitching(true)
        // biome-ignore lint/suspicious/noDocumentCookie: Keep preference support in browsers without Cookie Store API.
        document.cookie = `e2b_pool=${value}; Path=/; Max-Age=31536000; SameSite=Lax${location.protocol === 'https:' ? '; Secure' : ''}`
        // A new document discards caches, in-flight requests and terminal sessions.
        location.assign('/sandboxes')
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

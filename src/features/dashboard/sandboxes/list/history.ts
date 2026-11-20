import { useInfiniteQuery } from '@tanstack/react-query'
import { useClientConfig } from '@/features/client-config-provider'

export type EndedSandbox = {
  sandboxID: string
  templateID: string
  startedAt: string
  endedAt: string
  cpuCount: number
  memoryMB: number
  creatorID?: string
  alias?: never
  metadata?: never
  diskSizeMB?: never
  state: 'ended'
}

type HistoryPage = {
  sandboxes: Omit<EndedSandbox, 'state'>[]
  nextCursor: string
}

export function useSandboxHistory(enabled: boolean) {
  const { executionPool = 'pilot' } = useClientConfig()
  return useInfiniteQuery({
    queryKey: ['sandbox-history', executionPool],
    enabled,
    initialPageParam: '',
    queryFn: async ({ pageParam, signal }) => {
      const params = new URLSearchParams({ pool: executionPool })
      if (pageParam) params.set('cursor', pageParam)
      const response = await fetch(`/access/sandbox-history?${params}`, {
        cache: 'no-store',
        signal,
      })
      if (!response.ok) throw new Error('Sandbox history unavailable')
      return (await response.json()) as HistoryPage
    },
    getNextPageParam: (page) => page.nextCursor || undefined,
    staleTime: 30_000,
    retry: false,
  })
}

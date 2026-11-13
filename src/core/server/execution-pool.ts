import 'server-only'

import { cookies, headers } from 'next/headers'

export type ExecutionPool = 'production' | 'pilot'

export async function resolveExecutionPool(): Promise<ExecutionPool> {
  const requestHeaders = await headers()
  const selected = requestHeaders.get('x-dashboard-pool')
  if (selected === 'pilot' || selected === 'production') return selected
  try {
    const pool = new URL(requestHeaders.get('referer') ?? '').searchParams.get(
      'pool'
    )
    if (pool === 'pilot' || pool === 'production') return pool
  } catch {}
  return (await cookies()).get('e2b_pool')?.value === 'production'
    ? 'production'
    : 'pilot'
}

export async function executionPoolHeaders(): Promise<Record<string, string>> {
  return { 'X-E2B-Pool': await resolveExecutionPool() }
}

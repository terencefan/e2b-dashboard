import 'server-only'

import { cookies } from 'next/headers'

export type ExecutionPool = 'production' | 'pilot'

export async function resolveExecutionPool(): Promise<ExecutionPool> {
  return (await cookies()).get('e2b_pool')?.value === 'pilot'
    ? 'pilot'
    : 'production'
}

export async function executionPoolHeaders(): Promise<Record<string, string>> {
  return { 'X-E2B-Pool': await resolveExecutionPool() }
}

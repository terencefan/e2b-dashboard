import { beforeEach, describe, expect, it, vi } from 'vitest'

const { cookieValue } = vi.hoisted(() => ({ cookieValue: { value: '' } }))
vi.mock('next/headers', () => ({
  cookies: async () => ({ get: () => cookieValue }),
}))

import { executionPoolHeaders } from '@/core/server/execution-pool'
import { infra } from '@/core/shared/clients/api'
import {
  readStoredTerminalSession,
  writeStoredTerminalSession,
} from '@/features/dashboard/terminal/storage'

describe('execution pool request and terminal state', () => {
  beforeEach(() => {
    cookieValue.value = ''
    const values = new Map<string, string>()
    vi.stubGlobal('window', {
      localStorage: {
        getItem: (key: string) => values.get(key),
        setItem: (key: string, value: string) => values.set(key, value),
      },
    })
  })

  it('selects a fixed pool and defaults unknown values to production', async () => {
    expect(await executionPoolHeaders()).toEqual({ 'X-E2B-Pool': 'production' })
    cookieValue.value = 'pilot'
    expect(await executionPoolHeaders()).toEqual({ 'X-E2B-Pool': 'pilot' })
    cookieValue.value = 'http://untrusted.invalid'
    expect(await executionPoolHeaders()).toEqual({ 'X-E2B-Pool': 'production' })
  })

  it('resolves each API request independently when the selected pool changes', async () => {
    const fetchMock = vi.fn(
      async (_input: RequestInfo | URL, _init?: RequestInit) =>
        new Response('[]', {
          headers: { 'Content-Type': 'application/json' },
        })
    )
    vi.stubGlobal('fetch', fetchMock)
    await infra.GET('/v2/sandboxes')
    cookieValue.value = 'pilot'
    await infra.GET('/v2/sandboxes')
    expect(
      new Headers(fetchMock.mock.calls[0]?.[1]?.headers).get('X-E2B-Pool')
    ).toBe('production')
    expect(
      new Headers(fetchMock.mock.calls[1]?.[1]?.headers).get('X-E2B-Pool')
    ).toBe('pilot')
  })

  it('never reconnects a stored terminal from the other pool', () => {
    const production = { sandboxId: 'production123', template: 'base' }
    const pilot = { sandboxId: 'pilot123', template: 'base' }
    writeStoredTerminalSession(production, 'production')
    expect(readStoredTerminalSession('pilot')).toBeNull()
    writeStoredTerminalSession(pilot, 'pilot')
    expect(readStoredTerminalSession('production')).toEqual(production)
    expect(readStoredTerminalSession('pilot')).toEqual(pilot)
  })
})

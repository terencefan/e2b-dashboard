import { beforeEach, describe, expect, it, vi } from 'vitest'

const { cookieValue, requestHeaders } = vi.hoisted(() => ({
  cookieValue: { value: '' },
  requestHeaders: new Headers(),
}))
vi.mock('next/headers', () => ({
  headers: async () => requestHeaders,
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
    requestHeaders.delete('x-dashboard-pool')
    requestHeaders.delete('referer')
    const values = new Map<string, string>()
    vi.stubGlobal('window', {
      localStorage: {
        getItem: (key: string) => values.get(key),
        setItem: (key: string, value: string) => values.set(key, value),
      },
    })
  })

  it('selects a fixed pool and defaults unknown values to pilot', async () => {
    expect(await executionPoolHeaders()).toEqual({ 'X-E2B-Pool': 'pilot' })
    cookieValue.value = 'production'
    expect(await executionPoolHeaders()).toEqual({ 'X-E2B-Pool': 'production' })
    cookieValue.value = 'http://untrusted.invalid'
    expect(await executionPoolHeaders()).toEqual({ 'X-E2B-Pool': 'pilot' })
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
    cookieValue.value = 'production'
    await infra.GET('/v2/sandboxes')
    expect(
      new Headers(fetchMock.mock.calls[0]?.[1]?.headers).get('X-E2B-Pool')
    ).toBe('pilot')
    expect(
      new Headers(fetchMock.mock.calls[1]?.[1]?.headers).get('X-E2B-Pool')
    ).toBe('production')
  })

  it('uses the URL context before a cookie from another browser tab', async () => {
    cookieValue.value = 'production'
    requestHeaders.set(
      'referer',
      'https://dashboard.local/sandboxes?pool=pilot'
    )
    expect(await executionPoolHeaders()).toEqual({ 'X-E2B-Pool': 'pilot' })
    requestHeaders.set('x-dashboard-pool', 'production')
    expect(await executionPoolHeaders()).toEqual({ 'X-E2B-Pool': 'production' })
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

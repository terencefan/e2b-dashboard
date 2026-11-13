import { NextRequest } from 'next/server'
import { afterEach, describe, expect, it } from 'vitest'
import { COOKIE_KEYS } from '@/configs/cookies'
import { runDashboardProxy } from '@/core/server/proxy/runtime'

const BASE = 'https://dashboard.local'

function makeRequest(path: string, apiKey?: string): NextRequest {
  const request = new NextRequest(new URL(path, BASE))
  if (apiKey) {
    request.cookies.set(COOKIE_KEYS.API_KEY, apiKey)
  }
  return request
}

afterEach(() => {
  delete process.env.E2B_API_KEY
})

describe('runDashboardProxy', () => {
  it('redirects bare / into the dashboard when an api key cookie is present', async () => {
    const response = await runDashboardProxy(makeRequest('/', 'e2b_key'))

    expect(response.status).toBe(307)
    expect(response.headers.get('location')).toBe(
      `${BASE}/sandboxes?pool=pilot`
    )
  })

  it('lets /?tab= through so the root page resolves the deep link', async () => {
    const response = await runDashboardProxy(
      makeRequest('/?tab=templates', 'e2b_key')
    )

    expect(response.headers.get('location')).toBeNull()
  })

  it('leaves / alone without an api key (key form renders)', async () => {
    const response = await runDashboardProxy(makeRequest('/'))

    expect(response.headers.get('location')).toBeNull()
  })

  it.each([
    '/sandboxes',
    '/sandboxes/sbx_123/logs',
    '/templates/list',
  ])('redirects %s to the key form with returnTo when no api key is present', async (path) => {
    const response = await runDashboardProxy(makeRequest(path))

    expect(response.status).toBe(307)
    const location = new URL(response.headers.get('location') as string)
    expect(location.pathname).toBe('/')
    expect(location.searchParams.get('returnTo')).toBe(path)
  })

  it.each([
    '/sandboxes',
    '/templates/list',
  ])('passes %s through when the api key cookie is present', async (path) => {
    const response = await runDashboardProxy(
      makeRequest(`${path}?pool=pilot`, 'e2b_key')
    )

    expect(response.headers.get('location')).toBeNull()
  })

  it('treats E2B_API_KEY env as authenticated', async () => {
    process.env.E2B_API_KEY = 'e2b_env_key'

    const protectedResponse = await runDashboardProxy(
      makeRequest('/sandboxes?pool=pilot')
    )
    expect(protectedResponse.headers.get('location')).toBeNull()

    const rootResponse = await runDashboardProxy(makeRequest('/'))
    expect(rootResponse.headers.get('location')).toBe(
      `${BASE}/sandboxes?pool=pilot`
    )
  })

  it('preserves the query string in returnTo', async () => {
    const response = await runDashboardProxy(
      makeRequest('/sandboxes/sbx_123/logs?level=error')
    )

    const location = new URL(response.headers.get('location') as string)
    expect(location.searchParams.get('returnTo')).toBe(
      '/sandboxes/sbx_123/logs?level=error'
    )
  })

  it('ignores unrelated public paths', async () => {
    const response = await runDashboardProxy(makeRequest('/some-public-page'))

    expect(response.headers.get('location')).toBeNull()
  })
})

describe('pool URL selection', () => {
  it('defaults a direct entry to Pilot even with a previous Production cookie', async () => {
    const request = makeRequest('/sandboxes?search=hello', 'e2b_key')
    request.cookies.set('e2b_pool', 'production')
    const response = await runDashboardProxy(request)
    expect(response.headers.get('location')).toBe(
      `${BASE}/sandboxes?search=hello&pool=pilot`
    )
  })
  it('retains Production for internal navigation', async () => {
    const request = makeRequest('/templates/list', 'e2b_key')
    request.headers.set('referer', `${BASE}/sandboxes?pool=production`)
    const response = await runDashboardProxy(request)
    expect(response.headers.get('location')).toBe(
      `${BASE}/templates/list?pool=production`
    )
  })
  it('applies an explicit URL pool immediately despite an old cookie', async () => {
    const request = makeRequest('/sandboxes?pool=pilot', 'e2b_key')
    request.cookies.set('e2b_pool', 'production')
    const response = await runDashboardProxy(request)
    expect(response.headers.get('x-middleware-request-x-dashboard-pool')).toBe(
      'pilot'
    )
    expect(response.cookies.get('e2b_pool')?.value).toBe('pilot')
  })
})

it('retains the pool behind a proxy that terminates HTTPS', async () => {
  const request = new NextRequest('http://dashboard.internal/templates/list')
  request.cookies.set(COOKIE_KEYS.API_KEY, 'e2b_key')
  request.headers.set('x-forwarded-host', 'dashboard.local')
  request.headers.set('referer', `${BASE}/sandboxes?pool=production`)
  const response = await runDashboardProxy(request)
  expect(
    new URL(response.headers.get('location') as string).searchParams.get('pool')
  ).toBe('production')
})

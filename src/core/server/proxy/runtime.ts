import 'server-cli-only'

import { type NextRequest, NextResponse } from 'next/server'
import { COOKIE_KEYS } from '@/configs/cookies'
import { PROTECTED_ROUTE_PREFIXES, PROTECTED_URLS } from '@/configs/urls'

/**
 * Returns the api key for the current request, edge-safe. Mirrors
 * `getApiKey()` in core/server/auth (which is node-only via next/headers).
 */
function getRequestApiKey(request: NextRequest): string | null {
  const envApiKey = process.env.E2B_API_KEY
  if (envApiKey) return envApiKey

  return request.cookies.get(COOKIE_KEYS.API_KEY)?.value ?? null
}

function isProtectedRoute(pathname: string): boolean {
  return PROTECTED_ROUTE_PREFIXES.some(
    (prefix) => pathname === prefix || pathname.startsWith(`${prefix}/`)
  )
}

/**
 * The dashboard proxy is a thin auth gate:
 * - `/` with an api key present redirects into the dashboard.
 * - Protected routes without an api key redirect to `/` (the key form),
 *   preserving the original destination via `returnTo`.
 *
 * The cookie's presence is checked here for UX only — validity is enforced
 * lazily: upstream 401s surface as UNAUTHORIZED and sign the user out.
 */
export async function runDashboardProxy(request: NextRequest) {
  const { pathname, search } = request.nextUrl
  const apiKey = getRequestApiKey(request)

  if (pathname === '/' && apiKey) {
    const tab = request.nextUrl.searchParams.get('tab')
    // `/?tab=` deep links are resolved by the root page itself; only bare `/`
    // short-circuits here.
    if (!tab) {
      const destination = new URL(PROTECTED_URLS.SANDBOXES, request.url)
      destination.searchParams.set(
        'pool',
        request.nextUrl.searchParams.get('pool') === 'production'
          ? 'production'
          : 'pilot'
      )
      return NextResponse.redirect(destination)
    }
  }

  if (isProtectedRoute(pathname) && !apiKey) {
    const returnToUrl = new URL('/', request.url)
    returnToUrl.searchParams.set('returnTo', `${pathname}${search}`)
    return NextResponse.redirect(returnToUrl)
  }

  if (isProtectedRoute(pathname)) {
    const selected = request.nextUrl.searchParams.get('pool')
    if (pathname === '/pool/heatmap') {
      const destination = new URL(PROTECTED_URLS.SANDBOXES, request.url)
      const pool = selected ?? request.nextUrl.searchParams.get('ool')
      if (pool === 'pilot' || pool === 'production') {
        destination.searchParams.set('pool', pool)
      }
      return NextResponse.redirect(destination)
    }
    if (selected !== 'pilot' && selected !== 'production') {
      const destination = request.nextUrl.clone()
      let pool = 'pilot'
      // Internal navigation retains the current pool, direct entry defaults to Pilot.
      try {
        const referer = new URL(request.headers.get('referer') ?? '')
        if (
          referer.host ===
            (request.headers.get('x-forwarded-host') ??
              request.headers.get('host') ??
              request.nextUrl.host) &&
          referer.searchParams.get('pool') === 'production'
        )
          pool = 'production'
      } catch {}
      destination.searchParams.set('pool', pool)
      return NextResponse.redirect(destination)
    }
    const requestHeaders = new Headers(request.headers)
    requestHeaders.set('x-dashboard-pool', selected)
    const response = NextResponse.next({ request: { headers: requestHeaders } })
    response.cookies.set('e2b_pool', selected, {
      path: '/',
      sameSite: 'lax',
      secure: request.nextUrl.protocol === 'https:',
    })
    return response
  }

  return NextResponse.next({ request })
}

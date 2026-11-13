import createClient from 'openapi-fetch'
import { executionPoolHeaders } from '@/core/server/execution-pool'
import { resolveInfraApiUrl } from '@/core/server/runtime-config'
import type { paths as InfraPaths } from '@/core/shared/contracts/infra-api.types'

const INFRA_API_URL = resolveInfraApiUrl()

export const infra = createClient<InfraPaths>({
  baseUrl: INFRA_API_URL,
  fetch: async ({ url, headers, body, method, ...options }) => {
    const requestHeaders = new Headers(headers)
    for (const [key, value] of Object.entries(await executionPoolHeaders())) {
      requestHeaders.set(key, value)
    }
    return fetch(url, {
      headers: requestHeaders,
      body,
      method,
      duplex: body ? 'half' : undefined,
      ...options,
    } as RequestInit)
  },
  querySerializer: {
    array: { style: 'form', explode: false },
  },
})

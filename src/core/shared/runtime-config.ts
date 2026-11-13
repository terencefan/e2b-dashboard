export interface BrowserRuntimeConfig {
  executionPool?: 'production' | 'pilot'
  domain: string | null
  sandboxUrl: string | null
}

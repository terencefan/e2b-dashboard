'use client'

import { type FormEvent, useCallback, useEffect, useState } from 'react'
import { useClientConfig } from '@/features/client-config-provider'
import { Button } from '@/ui/primitives/button'

type ApiKey = {
  id: string
  name: string
  createdAt: string
  expiresAt: string
  active: boolean
}
type CreatedKey = { apiKey: string; expiresAt: string }

async function request<T>(path = '', options: RequestInit = {}): Promise<T> {
  const response = await fetch(`/access/api-keys${path}`, {
    ...options,
    credentials: 'same-origin',
    redirect: 'error',
    cache: 'no-store',
    headers: { 'Content-Type': 'application/json' },
  })
  const data = await response
    .json()
    .catch(() => ({ error: '请求失败，请刷新或重新登录。' }))
  if (!response.ok) throw new Error(data.error ?? '请求失败，请稍后重试。')
  return data
}

export default function ApiKeysPage() {
  const config = useClientConfig()
  const [keys, setKeys] = useState<ApiKey[]>([])
  const [name, setName] = useState('')
  const [hours, setHours] = useState(8)
  const [created, setCreated] = useState<CreatedKey | null>(null)
  const [message, setMessage] = useState('')
  const [error, setError] = useState(false)
  const [loading, setLoading] = useState(true)
  const [creating, setCreating] = useState(false)
  const [revoking, setRevoking] = useState<string | null>(null)
  const notify = (text: string, failed = false) => {
    setMessage(text)
    setError(failed)
  }
  const load = useCallback(async () => {
    setLoading(true)
    try {
      setKeys((await request<{ keys: ApiKey[] }>()).keys)
    } catch (e) {
      setMessage(e instanceof Error ? e.message : '加载失败')
      setError(true)
    } finally {
      setLoading(false)
    }
  }, [])
  useEffect(() => {
    void load()
  }, [load])
  async function create(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setCreating(true)
    notify('')
    try {
      setCreated(
        await request<CreatedKey>('', {
          method: 'POST',
          body: JSON.stringify({ name, hours }),
        })
      )
      setName('')
      notify('密钥已创建，请立即保存。')
      await load()
    } catch (e) {
      notify(e instanceof Error ? e.message : '创建失败', true)
    } finally {
      setCreating(false)
    }
  }
  async function revoke(key: ApiKey) {
    if (!window.confirm(`撤销“${key.name}”？使用此密钥的 SDK 请求将立即失败。`))
      return
    setRevoking(key.id)
    try {
      await request(`/${encodeURIComponent(key.id)}`, { method: 'DELETE' })
      notify('密钥已撤销。')
      await load()
    } catch (e) {
      notify(e instanceof Error ? e.message : '撤销失败', true)
    } finally {
      setRevoking(null)
    }
  }
  const fieldClass =
    'border bg-bg px-3 py-2 text-fg focus:outline-2 focus:outline-accent-main-highlight'
  return (
    <div className="mx-auto w-full max-w-4xl space-y-8 p-4 md:p-0">
      <div>
        <h2 className="text-xl font-medium">个人 API Keys</h2>
        <p className="mt-2 text-fg-secondary">
          用于 SDK 和脚本。仅管理你创建的密钥，退出授权组后自动失效。
        </p>
      </div>
      <section className="space-y-4 border p-5">
        <h3 className="font-medium">创建密钥</h3>
        <form onSubmit={create} className="flex flex-wrap items-end gap-4">
          <label className="flex min-w-48 flex-1 flex-col gap-2">
            名称
            <input
              className={fieldClass}
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="例如：本地开发"
              maxLength={64}
              required
              autoComplete="off"
            />
          </label>
          <label className="flex flex-col gap-2">
            有效期
            <select
              className={fieldClass}
              value={hours}
              onChange={(e) => setHours(Number(e.target.value))}
            >
              <option value={1}>1 小时</option>
              <option value={8}>8 小时</option>
              <option value={24}>1 天</option>
              <option value={168}>7 天</option>
              <option value={720}>30 天</option>
            </select>
          </label>
          <Button type="submit" disabled={creating}>
            {creating ? '正在创建…' : '创建 API Key'}
          </Button>
        </form>
      </section>
      {created && (
        <section
          className="space-y-4 border border-accent-main-highlight p-5"
          aria-label="新密钥"
        >
          <h3 className="font-medium">密钥已创建</h3>
          <p className="text-fg-secondary">
            完整密钥仅在本次创建后显示，请立即保存。
          </p>
          <pre className="select-all whitespace-pre-wrap break-all border bg-bg-1 p-4 text-sm">
            {created.apiKey}
          </pre>
          <div className="flex flex-wrap items-center gap-4">
            <span className="text-fg-secondary">
              到期：{new Date(created.expiresAt).toLocaleString()}
            </span>
            <Button
              variant="secondary"
              onClick={async () => {
                try {
                  await navigator.clipboard.writeText(created.apiKey)
                  notify('密钥已复制。')
                } catch {
                  notify('请选中密钥手动复制。', true)
                }
              }}
            >
              复制密钥
            </Button>
            <Button variant="tertiary" onClick={() => setCreated(null)}>
              已保存，关闭
            </Button>
          </div>
        </section>
      )}
      <output
        aria-live="polite"
        className={error ? 'text-accent-error-highlight' : 'text-fg-secondary'}
      >
        {message}
        {error && (
          <a className="ml-3 underline" href="/oauth2/start">
            重新登录
          </a>
        )}
      </output>
      <section className="border p-5">
        <div className="mb-4 flex items-center justify-between">
          <h3 className="font-medium">我的密钥</h3>
          <Button
            variant="secondary"
            onClick={() => void load()}
            disabled={loading}
          >
            刷新
          </Button>
        </div>
        {loading ? (
          <p className="text-fg-secondary">正在加载…</p>
        ) : keys.length === 0 ? (
          <p className="text-fg-secondary">暂无个人密钥。</p>
        ) : (
          <div className="divide-y">
            {keys.map((key) => (
              <div
                key={key.id}
                className="flex items-center justify-between gap-4 py-4"
              >
                <div className="min-w-0">
                  <div className="break-words font-medium">{key.name}</div>
                  <div className="mt-1 text-sm text-fg-secondary">
                    {key.active ? '有效' : '已失效'} · 到期{' '}
                    {new Date(key.expiresAt).toLocaleString()}
                  </div>
                </div>
                <Button
                  variant="secondary"
                  disabled={revoking !== null}
                  onClick={() => void revoke(key)}
                >
                  {revoking === key.id ? '正在撤销…' : '撤销'}
                </Button>
              </div>
            ))}
          </div>
        )}
      </section>
      {config.domain && (
        <p className="text-sm text-fg-tertiary">
          API 地址：https://api.{config.domain}
        </p>
      )}
    </div>
  )
}

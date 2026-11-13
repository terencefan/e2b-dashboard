import { TERMINAL_SESSION_STORAGE_PREFIX } from './constants'
import { normalizeTerminalTemplate } from './template'
import type { StoredTerminalSession } from './types'

function getTerminalSessionStorageKey(pool?: string) {
  return pool
    ? `${TERMINAL_SESSION_STORAGE_PREFIX}:${pool}`
    : TERMINAL_SESSION_STORAGE_PREFIX
}

export function readStoredTerminalSession(pool?: string) {
  try {
    const value = window.localStorage.getItem(
      getTerminalSessionStorageKey(pool)
    )
    if (!value) return null

    const session = JSON.parse(value) as Partial<StoredTerminalSession>
    if (typeof session.sandboxId !== 'string' || !session.sandboxId) {
      return null
    }

    const template =
      session.template === undefined
        ? 'base'
        : typeof session.template === 'string'
          ? normalizeTerminalTemplate(session.template)
          : null

    if (!template) return null

    return {
      sandboxId: session.sandboxId,
      template,
    }
  } catch {
    return null
  }
}

export function writeStoredTerminalSession(
  session: StoredTerminalSession,
  pool?: string
) {
  try {
    window.localStorage.setItem(
      getTerminalSessionStorageKey(pool),
      JSON.stringify(session)
    )
  } catch {
    // Terminal launch should still succeed if browser storage is unavailable.
  }
}

export function clearStoredTerminalSession(pool?: string) {
  try {
    window.localStorage.removeItem(getTerminalSessionStorageKey(pool))
  } catch {
    // Best-effort cleanup for unavailable or blocked browser storage.
  }
}

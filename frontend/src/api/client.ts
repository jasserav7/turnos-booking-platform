import { API_URL } from '../lib/env'
import type { TokenOut } from './types'

export class ApiError extends Error {
  readonly status: number
  readonly code: string

  constructor(status: number, code: string) {
    super(code)
    this.name = 'ApiError'
    this.status = status
    this.code = code
  }
}

type SessionListener = (session: TokenOut | null) => void

// The access token lives only in memory; the refresh token is an httpOnly cookie.
let accessToken: string | null = null
let refreshInFlight: Promise<TokenOut | null> | null = null
const listeners = new Set<SessionListener>()

export function getAccessToken(): string | null {
  return accessToken
}

export function setSession(session: TokenOut | null): void {
  accessToken = session?.access_token ?? null
  listeners.forEach((listener) => listener(session))
}

export function subscribeSession(listener: SessionListener): () => void {
  listeners.add(listener)
  return () => {
    listeners.delete(listener)
  }
}

function errorCode(status: number, body: unknown): string {
  if (typeof body === 'object' && body !== null && 'detail' in body) {
    const { detail } = body as { detail: unknown }
    if (typeof detail === 'string') return detail
    if (Array.isArray(detail)) return 'validation_error'
  }
  return `http_${status}`
}

async function readBody(response: Response): Promise<unknown> {
  if (response.status === 204) return undefined
  const text = await response.text()
  if (!text) return undefined
  try {
    return JSON.parse(text) as unknown
  } catch {
    return text
  }
}

async function send(path: string, init: RequestInit): Promise<Response> {
  try {
    return await fetch(`${API_URL}${path}`, { ...init, credentials: 'include' })
  } catch {
    throw new ApiError(0, 'network_error')
  }
}

/** Refresh the session once, sharing a single request between concurrent callers. */
export function refreshSession(): Promise<TokenOut | null> {
  refreshInFlight ??= (async () => {
    try {
      const response = await send('/auth/refresh', { method: 'POST' })
      const session = response.ok ? ((await readBody(response)) as TokenOut) : null
      setSession(session)
      return session
    } catch {
      setSession(null)
      return null
    } finally {
      refreshInFlight = null
    }
  })()
  return refreshInFlight
}

type Query = Record<string, string | number | boolean | null | undefined>

export interface RequestOptions {
  method?: 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE'
  body?: unknown
  query?: Query
  /** Refresh the session and retry once on a 401 (default true). */
  retryOnUnauthorized?: boolean
}

function buildPath(path: string, query?: Query): string {
  if (!query) return path
  const params = new URLSearchParams()
  for (const [key, value] of Object.entries(query)) {
    if (value !== undefined && value !== null && value !== '') params.set(key, String(value))
  }
  const qs = params.toString()
  return qs ? `${path}?${qs}` : path
}

export async function apiRequest<T>(path: string, options: RequestOptions = {}): Promise<T> {
  const { method = 'GET', body, query, retryOnUnauthorized = true } = options
  const headers: Record<string, string> = { Accept: 'application/json' }
  if (body !== undefined) headers['Content-Type'] = 'application/json'
  if (accessToken) headers.Authorization = `Bearer ${accessToken}`

  const response = await send(buildPath(path, query), {
    method,
    headers,
    body: body === undefined ? undefined : JSON.stringify(body),
  })

  if (response.status === 401 && retryOnUnauthorized) {
    // refreshSession() clears the session (logout) when the refresh fails.
    const session = await refreshSession()
    if (session) return apiRequest<T>(path, { ...options, retryOnUnauthorized: false })
    throw new ApiError(401, 'session_expired')
  }

  const data = await readBody(response)
  if (!response.ok) throw new ApiError(response.status, errorCode(response.status, data))
  return data as T
}

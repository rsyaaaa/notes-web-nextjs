import 'server-only'

import { createHmac, randomBytes, timingSafeEqual } from 'node:crypto'
import { createClient, type SupabaseClient } from '@supabase/supabase-js'

const WAIT_MS = 5_000
const LIFETIME_MS = 10 * 60_000
const MAX_BODY_BYTES = 8 * 1024
const PAGE_SIZE = 100
const CONFIRMATION = 'DELETE ACCOUNT NOW'

type ErrorCode = 'unauthorized' | 'invalid_confirmation' | 'invalid_challenge' |
  'wait_required' | 'challenge_expired' | 'unavailable' | 'delete_failed'

type Challenge = { v: 1; user: string; notBefore: number; expires: number; nonce: string }

function json(body: object, status = 200) {
  return Response.json(body, { status, headers: { 'Cache-Control': 'no-store' } })
}

function failure(error: ErrorCode, status: number, extra: object = {}) {
  return json({ error, ...extra }, status)
}

function signature(payload: string, secret: string) {
  return createHmac('sha256', secret).update(`account-deletion:v1:${payload}`).digest()
}

function issueChallenge(user: string, secret: string) {
  const now = Date.now()
  const payload = Buffer.from(JSON.stringify({
    v: 1, user, notBefore: now + WAIT_MS, expires: now + LIFETIME_MS,
    nonce: randomBytes(24).toString('base64url'),
  } satisfies Challenge)).toString('base64url')
  return `${payload}.${signature(payload, secret).toString('base64url')}`
}

function verifyChallenge(value: unknown, user: string, secret: string): Challenge | null {
  if (typeof value !== 'string' || value.length > 2048) return null
  const parts = value.split('.')
  if (parts.length !== 2 || parts.some(part => !/^[A-Za-z0-9_-]+$/.test(part))) return null
  const [payload, signed] = parts
  const supplied = Buffer.from(signed, 'base64url')
  const expected = signature(payload, secret)
  if (supplied.length !== expected.length || supplied.toString('base64url') !== signed ||
      !timingSafeEqual(supplied, expected)) return null
  try {
    const data = JSON.parse(Buffer.from(payload, 'base64url').toString('utf8'))
    if (!data || data.v !== 1 || data.user !== user ||
        !Number.isSafeInteger(data.notBefore) || !Number.isSafeInteger(data.expires) ||
        data.expires - data.notBefore !== LIFETIME_MS - WAIT_MS ||
        typeof data.nonce !== 'string' || !/^[A-Za-z0-9_-]{32}$/.test(data.nonce)) return null
    return data as Challenge
  } catch {
    return null
  }
}

async function readBody(request: Request): Promise<Record<string, unknown>> {
  const length = request.headers.get('content-length')
  if (length !== null && (!/^\d+$/.test(length) || Number(length) > MAX_BODY_BYTES)) {
    throw new Error('Invalid body size')
  }
  const reader = request.body?.getReader()
  if (!reader) {
    if (request.method === 'POST') return {}
    throw new Error('Missing body')
  }
  const chunks: Uint8Array[] = []
  let size = 0
  try {
    while (true) {
      const { done, value } = await reader.read()
      if (done) break
      size += value.byteLength
      if (size > MAX_BODY_BYTES) {
        await reader.cancel()
        throw new Error('Invalid body size')
      }
      chunks.push(value)
    }
  } finally {
    reader.releaseLock()
  }
  if (size === 0 && request.method === 'POST') return {}
  if (request.headers.get('content-type')?.split(';')[0].trim().toLowerCase() !== 'application/json') {
    throw new Error('Expected JSON')
  }
  const body: unknown = JSON.parse(new TextDecoder('utf-8', { fatal: true }).decode(Buffer.concat(chunks)))
  if (!body || typeof body !== 'object' || Array.isArray(body)) throw new Error('Expected object')
  return body as Record<string, unknown>
}

async function removeAvatars(admin: SupabaseClient, userId: string) {
  const bucket = admin.storage.from('avatars')
  const folders = [userId]
  // Finish listing each directory before removing anything: deletion changes list offsets.
  for (let index = 0; index < folders.length; index += 1) {
    const folder = folders[index]
    const paths: string[] = []
    for (let offset = 0; ; offset += PAGE_SIZE) {
      const { data, error } = await bucket.list(folder, {
        limit: PAGE_SIZE, offset, sortBy: { column: 'name', order: 'asc' },
      })
      if (error || !data) throw new Error('Avatar listing failed')
      for (const entry of data) {
        if (!entry.name || entry.name === '.' || entry.name === '..' || entry.name.includes('/')) {
          throw new Error('Invalid avatar path')
        }
        const path = `${folder}/${entry.name}`
        if (entry.id === null) folders.push(path)
        else paths.push(path)
      }
      if (data.length < PAGE_SIZE) break
    }
    for (let offset = 0; offset < paths.length; offset += PAGE_SIZE) {
      const { error } = await bucket.remove(paths.slice(offset, offset + PAGE_SIZE))
      if (error) throw new Error('Avatar removal failed')
    }
  }
}

export async function handleAccountRequest(request: Request): Promise<Response> {
  const origin = request.headers.get('origin')
  if (origin !== null && origin !== new URL(request.url).origin) {
    return failure('unauthorized', 403)
  }

  const secret = process.env.SUPABASE_SERVICE_ROLE_KEY?.trim()
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL?.trim()
  if (!secret || !url) return failure('unavailable', 503)

  const authorization = request.headers.get('authorization')
  const token = authorization?.match(/^Bearer ([^\s,]+)$/i)?.[1]
  if (!token) return failure('unauthorized', 401)

  let admin: SupabaseClient
  let userId: string
  try {
    admin = createClient(url, secret, {
      auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false },
    })
  } catch {
    return failure('unavailable', 503)
  }
  try {
    const { data, error } = await admin.auth.getUser(token)
    if (error || !data.user) return failure('unauthorized', 401)
    userId = data.user.id
  } catch {
    return failure('unavailable', 503)
  }

  try {
    const { data, error } = await admin.rpc('account_deletion_ready')
    if (error || data !== true) return failure('unavailable', 503)
  } catch {
    return failure('unavailable', 503)
  }

  let body: Record<string, unknown>
  try {
    body = await readBody(request)
  } catch {
    return failure('invalid_challenge', 400)
  }
  if (request.method === 'POST') {
    if (Object.keys(body).length !== 0) return failure('invalid_challenge', 400)
    return json({ challenge: issueChallenge(userId, secret), waitMs: WAIT_MS })
  }

  if (body.confirmation !== CONFIRMATION) return failure('invalid_confirmation', 400)
  if (Object.keys(body).some(key => key !== 'challenge' && key !== 'confirmation')) {
    return failure('invalid_challenge', 400)
  }
  const challenge = verifyChallenge(body.challenge, userId, secret)
  if (!challenge) return failure('invalid_challenge', 400)
  const now = Date.now()
  if (now >= challenge.expires) return failure('challenge_expired', 400)
  if (now < challenge.notBefore) {
    return failure('wait_required', 425, { retryAfterMs: challenge.notBefore - now })
  }

  try {
    await removeAvatars(admin, userId)
    // The auth.users BEFORE DELETE trigger owns the atomic relational cleanup.
    const { error } = await admin.auth.admin.deleteUser(userId, false)
    if (error) return failure('delete_failed', 500)
    return json({ deleted: true })
  } catch {
    return failure('delete_failed', 500)
  }
}

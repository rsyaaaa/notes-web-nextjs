import assert from 'node:assert/strict'
import { createRequire } from 'node:module'
import { readFileSync } from 'node:fs'
import { dirname, resolve } from 'node:path'
import test from 'node:test'
import { fileURLToPath } from 'node:url'
import vm from 'node:vm'
import ts from 'typescript'

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..')
const require = createRequire(import.meta.url)
const secret = 'server-only-service-role-test-secret'
const phrase = 'DELETE ACCOUNT NOW'
const source = readFileSync(resolve(root, 'lib/server/account-deletion.ts'), 'utf8')

function evaluate(source, globals) {
  const cjsModule = { exports: {} }
  vm.runInNewContext(ts.transpileModule(source, {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
  }).outputText, { module: cjsModule, exports: cjsModule.exports, ...globals })
  return cjsModule.exports
}

function harness(options = {}) {
  const calls = []
  const state = { now: 1_800_000_000_000, user: 'account-a', readiness: true, ...options }
  const env = {
    NEXT_PUBLIC_SUPABASE_URL: 'https://project.supabase.test',
    SUPABASE_SERVICE_ROLE_KEY: secret,
    ...options.env,
  }
  const admin = {
    async rpc(name, ...args) {
      calls.push(['rpc', name])
      assert.equal(name, 'account_deletion_ready')
      assert.equal(args.length, 0)
      if (state.readinessThrows) throw new Error('private readiness network details')
      return { data: state.readiness, error: state.readinessError ?? null }
    },
    auth: {
      async getUser(token) {
        calls.push(['getUser', token])
        if (state.authThrows) throw new Error('private auth network details')
        return { data: { user: state.user ? { id: state.user } : null }, error: state.authError }
      },
      admin: {
        async deleteUser(id, softDelete) {
          calls.push(['deleteUser', id, softDelete])
          if (state.deleteThrows) throw new Error('private database details')
          return { error: state.deleteError }
        },
      },
    },
    storage: {
      from(bucket) {
        assert.equal(bucket, 'avatars')
        return {
          async list(prefix, settings) {
            calls.push(['list', prefix, settings.offset, settings.limit])
            assert.equal(settings.sortBy.column, 'name')
            assert.equal(settings.sortBy.order, 'asc')
            if (state.listThrows) throw new Error('private storage details')
            if (state.listError) return { data: null, error: state.listError }
            return { data: (state.files?.[prefix] ?? []).slice(settings.offset, settings.offset + settings.limit), error: null }
          },
          async remove(paths) {
            calls.push(['remove', Array.from(paths)])
            if (state.removeThrows) throw new Error('private storage details')
            return { error: state.removeError }
          },
        }
      },
    },
  }
  const helper = evaluate(source, {
    Buffer, Response, TextDecoder, URL,
    Date: class extends Date { static now() { return state.now } },
    process: { env },
    require(name) {
      if (name === 'server-only') return {}
      if (name === 'node:crypto') return require(name)
      if (name === '@supabase/supabase-js') return {
        createClient(url, key, settings) {
          assert.equal(url, env.NEXT_PUBLIC_SUPABASE_URL)
          assert.equal(key, env.SUPABASE_SERVICE_ROLE_KEY)
          assert.equal(settings.auth.persistSession, false)
          assert.equal(settings.auth.autoRefreshToken, false)
          assert.equal(settings.auth.detectSessionInUrl, false)
          if (state.clientThrows) throw new Error('private configuration details')
          calls.push(['createClient'])
          return admin
        },
      }
      assert.fail(`Unexpected import ${name}`)
    },
  })
  const route = evaluate(readFileSync(resolve(root, 'app/api/account/route.ts'), 'utf8'), {
    require(name) {
      assert.equal(name, '@/lib/server/account-deletion')
      return helper
    },
  })
  // Cache Components requires the implicit default Node runtime.
  assert.equal(route.runtime, undefined)
  async function request(method, body, settings = {}) {
    const headers = { authorization: 'Bearer browser-access-token', ...settings.headers }
    if (body !== undefined && !headers['content-type']) headers['content-type'] = 'application/json'
    const request = new Request('https://notes.test/api/account', {
      method, headers, body: body === undefined ? undefined : typeof body === 'string' ? body : JSON.stringify(body),
    })
    const response = await route[method](request)
    assert.equal(response.headers.get('cache-control'), 'no-store')
    return { status: response.status, body: await response.json() }
  }
  async function challenge() {
    const result = await request('POST')
    assert.equal(result.status, 200)
    assert.equal(result.body.waitMs, 5000)
    assert.equal(typeof result.body.challenge, 'string')
    assert.ok(!result.body.challenge.includes(secret))
    return result.body.challenge
  }
  return { state, env, calls, request, challenge }
}

async function ready(options) {
  const h = harness(options)
  const challenge = await h.challenge()
  h.state.now += 5000
  return { ...h, body: { challenge, confirmation: phrase } }
}

function noDeletion(h) {
  assert.ok(!h.calls.some(([name]) => ['list', 'remove', 'deleteUser'].includes(name)))
}

test('wait is enforced on the server through the exact five-second boundary', async () => {
  const h = harness()
  const challenge = await h.challenge()
  const body = { challenge, confirmation: phrase }
  assert.deepEqual(await h.request('DELETE', body), { status: 425, body: { error: 'wait_required', retryAfterMs: 5000 } })
  h.state.now += 4999
  assert.deepEqual(await h.request('DELETE', body), { status: 425, body: { error: 'wait_required', retryAfterMs: 1 } })
  noDeletion(h)
  h.state.now += 1
  assert.deepEqual(await h.request('DELETE', body), { status: 200, body: { deleted: true } })
  assert.deepEqual(h.calls.at(-1), ['deleteUser', 'account-a', false])
  assert.equal(h.calls.filter(([name]) => name === 'getUser').length, 4)
})

test('confirmation must match exactly and cannot supply an identity', async () => {
  const h = await ready()
  for (const confirmation of ['', 'delete account now', `${phrase} `, ` ${phrase}`, `${phrase}\n`, null, 1]) {
    assert.deepEqual(await h.request('DELETE', { ...h.body, confirmation }), {
      status: 400, body: { error: 'invalid_confirmation' },
    })
  }
  assert.equal((await h.request('DELETE', { ...h.body, userId: 'account-b' })).body.error, 'invalid_challenge')
  assert.equal((await h.request('POST', { userId: 'account-b' })).body.error, 'invalid_challenge')
  noDeletion(h)
})

test('challenges are user-bound, tamper-resistant, canonical, and required', async () => {
  const h = await ready()
  h.state.user = 'account-b'
  assert.equal((await h.request('DELETE', h.body)).body.error, 'invalid_challenge')
  h.state.user = 'account-a'
  const [payload, signature] = h.body.challenge.split('.')
  const changed = Buffer.from(JSON.stringify({ ...JSON.parse(Buffer.from(payload, 'base64url')), user: 'account-b' })).toString('base64url')
  for (const challenge of [undefined, null, {}, '', 'x', `${payload}.a`, `${payload}.${'A'.repeat(43)}`, `${changed}.${signature}`, `${payload}.${signature}=`, `${payload}.${signature}.extra`, 'a'.repeat(2049)]) {
    const result = await h.request('DELETE', { ...h.body, challenge })
    assert.deepEqual(result, { status: 400, body: { error: 'invalid_challenge' } })
  }
  noDeletion(h)
})

test('challenges expire at ten minutes and work across independent server instances', async () => {
  const first = harness()
  const challenge = await first.challenge()
  const other = harness()
  other.state.now += 599999
  assert.equal((await other.request('DELETE', { challenge, confirmation: phrase })).status, 200)
  first.state.now += 600000
  assert.deepEqual(await first.request('DELETE', { challenge, confirmation: phrase }), {
    status: 400, body: { error: 'challenge_expired' },
  })
  noDeletion(first)
  const rotated = harness({ env: { SUPABASE_SERVICE_ROLE_KEY: 'rotated-service-secret' } })
  rotated.state.now += 5000
  assert.equal((await rotated.request('DELETE', { challenge, confirmation: phrase })).body.error, 'invalid_challenge')
})

test('same-origin is required when supplied, but origin-less bearer clients are supported', async () => {
  const h = await ready()
  for (const method of ['POST', 'DELETE']) {
    for (const origin of ['https://evil.test', 'http://notes.test', 'https://notes.test:444', 'null', 'not-an-origin', '']) {
      assert.deepEqual(await h.request(method, method === 'DELETE' ? h.body : undefined, { headers: { origin } }), {
        status: 403, body: { error: 'unauthorized' },
      })
    }
  }
  noDeletion(h)
  assert.equal((await h.request('POST', {}, { headers: { origin: 'https://notes.test' } })).status, 200)
  assert.equal((await h.request('DELETE', h.body)).status, 200)
})

test('both endpoints require a verified bearer, not cookies or body identity', async () => {
  for (const method of ['POST', 'DELETE']) {
    const h = await ready()
    for (const authorization of ['', 'Basic abc', 'Bearer', 'Bearer a b', 'Bearer a,b']) {
      assert.equal((await h.request(method, method === 'DELETE' ? h.body : undefined, {
        headers: { authorization, cookie: 'session=not-bearer-auth' },
      })).body.error, 'unauthorized')
    }
    h.state.authError = { message: 'private auth error' }
    assert.deepEqual(await h.request(method, method === 'DELETE' ? h.body : undefined), {
      status: 401, body: { error: 'unauthorized' },
    })
    h.state.authError = null
    h.state.user = null
    assert.equal((await h.request(method, method === 'DELETE' ? h.body : undefined)).status, 401)
    noDeletion(h)
  }
})

test('missing configuration fails closed without a public service-key fallback', async () => {
  for (const env of [
    { SUPABASE_SERVICE_ROLE_KEY: undefined, NEXT_PUBLIC_SUPABASE_SERVICE_ROLE_KEY: secret },
    { SUPABASE_SERVICE_ROLE_KEY: ' ' },
    { NEXT_PUBLIC_SUPABASE_URL: undefined },
  ]) {
    const h = harness({ env })
    for (const method of ['POST', 'DELETE']) {
      assert.deepEqual(await h.request(method), { status: 503, body: { error: 'unavailable' } })
    }
    assert.equal(h.calls.length, 0)
  }
  for (const options of [{ authThrows: true }, { clientThrows: true }]) {
    const h = harness(options)
    assert.deepEqual(await h.request('POST'), { status: 503, body: { error: 'unavailable' } })
  }
})

test('readiness fails closed before challenge issuance or deletion and is rechecked on every request', async () => {
  for (const options of [
    { readiness: false }, { readiness: null }, { readiness: undefined },
    { readiness: 'true' }, { readiness: 1 }, { readiness: [true] },
    { readiness: null, readinessError: { code: 'PGRST202', message: 'private missing RPC details' } },
    { readinessError: { message: 'private database error' } },
    { readinessThrows: true },
  ]) {
    const h = await ready()
    assert.deepEqual(h.calls.filter(([name]) => name === 'rpc'), [['rpc', 'account_deletion_ready']])
    assert.ok(h.calls.findIndex(([name]) => name === 'rpc') > h.calls.findIndex(([name]) => name === 'getUser'))
    Object.assign(h.state, options)
    for (const method of ['POST', 'DELETE']) {
      const result = await h.request(method, method === 'DELETE' ? h.body : undefined)
      assert.deepEqual(result, { status: 503, body: { error: 'unavailable' } })
      assert.ok(!('challenge' in result.body))
      noDeletion(h)
    }
    assert.equal(h.calls.filter(([name]) => name === 'rpc').length, 3)
  }
})

test('body validation rejects malformed, non-object, non-JSON and oversized input', async () => {
  const h = await ready()
  for (const method of ['POST', 'DELETE']) {
    for (const body of ['{', 'null', '[]', 'true', '"hello"', `{"padding":"${'x'.repeat(8192)}"}`]) {
      assert.equal((await h.request(method, body)).body.error, 'invalid_challenge')
    }
    assert.equal((await h.request(method, {}, { headers: { 'content-type': 'text/plain' } })).body.error, 'invalid_challenge')
    assert.equal((await h.request(method, {}, { headers: { 'content-length': '9000' } })).body.error, 'invalid_challenge')
  }
  assert.equal((await h.request('DELETE')).body.error, 'invalid_challenge')
  assert.equal((await h.request('DELETE', {})).body.error, 'invalid_confirmation')
  noDeletion(h)
})

test('all avatar pages and nested paths are removed before hard auth deletion', async () => {
  const files = Array.from({ length: 205 }, (_, index) => ({ id: `id-${index}`, name: `${String(index).padStart(3, '0')}.png` }))
  files.push({ id: null, name: 'nested' })
  const h = await ready({ files: {
    'account-a': files,
    'account-a/nested': [{ id: 'nested-id', name: 'avatar.png' }, { id: null, name: 'deeper' }],
    'account-a/nested/deeper': [{ id: 'deep-id', name: 'old.png' }],
  } })
  assert.deepEqual(await h.request('DELETE', h.body), { status: 200, body: { deleted: true } })
  const lists = h.calls.filter(([name]) => name === 'list')
  assert.deepEqual(lists, [
    ['list', 'account-a', 0, 100], ['list', 'account-a', 100, 100], ['list', 'account-a', 200, 100],
    ['list', 'account-a/nested', 0, 100], ['list', 'account-a/nested/deeper', 0, 100],
  ])
  const removes = h.calls.filter(([name]) => name === 'remove')
  assert.deepEqual(removes.map(([, paths]) => paths.length), [100, 100, 5, 1, 1])
  assert.equal(new Set(removes.flatMap(([, paths]) => paths)).size, 207)
  assert.ok(removes.flatMap(([, paths]) => paths).every(path => path.startsWith('account-a/')))
  assert.deepEqual(h.calls.at(-1), ['deleteUser', 'account-a', false])
  assert.ok(h.calls.findIndex(([name]) => name === 'remove') > h.calls.findIndex((call) => call[0] === 'list' && call[2] === 200))
})

test('exact-page listings fetch the terminal page, and empty storage skips remove', async () => {
  const h = await ready({ files: { 'account-a': Array.from({ length: 100 }, (_, i) => ({ id: String(i), name: `${i}.png` })) } })
  assert.equal((await h.request('DELETE', h.body)).status, 200)
  assert.ok(h.calls.some(call => call[0] === 'list' && call[2] === 100))
  const empty = await ready()
  assert.equal((await empty.request('DELETE', empty.body)).status, 200)
  assert.ok(!empty.calls.some(([name]) => name === 'remove'))
})

test('storage failures prevent auth deletion; auth failures return only generic codes', async () => {
  for (const options of [
    { listError: { message: 'secret storage error' } }, { listThrows: true },
    { removeError: { message: 'secret storage error' } }, { removeThrows: true },
    { files: { 'account-a': [{ id: 'bad', name: '../foreign-avatar.png' }] } },
  ]) {
    const h = await ready({ files: { 'account-a': [{ id: 'avatar', name: 'avatar.png' }] }, ...options })
    assert.deepEqual(await h.request('DELETE', h.body), { status: 500, body: { error: 'delete_failed' } })
    assert.ok(!h.calls.some(([name]) => name === 'deleteUser'))
  }
  for (const options of [{ deleteError: { message: 'secret database error' } }, { deleteThrows: true }]) {
    const h = await ready(options)
    assert.deepEqual(await h.request('DELETE', h.body), { status: 500, body: { error: 'delete_failed' } })
    assert.deepEqual(h.calls.at(-1), ['deleteUser', 'account-a', false])
  }
})

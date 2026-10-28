import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { dirname, resolve } from 'node:path'
import test from 'node:test'
import { fileURLToPath } from 'node:url'
import vm from 'node:vm'
import ts from 'typescript'

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..')
const source = readFileSync(resolve(root, 'components/DeleteAccountDialog.tsx'), 'utf8')
const compile = text => ts.transpileModule(text, {
  compilerOptions: { module: ts.ModuleKind.CommonJS, jsx: ts.JsxEmit.ReactJSX },
}).outputText
const componentCode = compile(source)
const translationsModule = { exports: {} }
vm.runInNewContext(compile(readFileSync(resolve(root, 'lib/i18n-deletion.ts'), 'utf8')), {
  module: translationsModule, exports: translationsModule.exports,
})
const translations = translationsModule.exports.deletionTranslations
const response = (body, status = 200) => ({ ok: status < 300, status, json: async () => body })
const deferred = () => {
  let resolve
  const promise = new Promise(done => { resolve = done })
  return { promise, resolve }
}
const flush = async () => { for (let i = 0; i < 15; i++) await Promise.resolve() }

function harness(options = {}) {
  let cursor = 0
  let now = 0
  let tree
  let mounted = true
  let stateWrites = 0
  let sessionUser = options.sessionUser === undefined ? 'owner' : options.sessionUser
  let sessionImpl
  let closeCalls = 0
  let deletedCalls = 0
  const slots = []
  const effects = []
  const timers = new Set()
  const listeners = new Map()
  const requests = []
  const element = () => ({ isConnected: true, focus() { document.activeElement = this } })
  const document = {
    activeElement: null,
    addEventListener(name, callback) { listeners.set(name, callback) },
    removeEventListener(name) { listeners.delete(name) },
  }
  const trigger = element()
  document.activeElement = trigger
  const props = {
    userId: 'owner', isDark: false,
    onClose() { closeCalls++ },
    async onDeleted() { deletedCalls++; await options.onDeleted?.() },
  }
  const react = {
    useState(initial) {
      const index = cursor++
      if (!(index in slots)) slots[index] = initial
      return [slots[index], value => {
        stateWrites++
        slots[index] = typeof value === 'function' ? value(slots[index]) : value
      }]
    },
    useRef(initial) {
      const index = cursor++
      if (!(index in slots)) slots[index] = { current: initial }
      return slots[index]
    },
    useEffect(effect, deps) {
      const index = cursor++
      const previous = slots[index]
      if (!previous || deps.some((value, i) => value !== previous.deps[i])) {
        effects.push(() => {
          previous?.cleanup?.()
          slots[index] = { deps, cleanup: effect() }
        })
      }
    },
  }
  const jsx = (type, props) => ({ type, props })
  const mocks = {
    react,
    'react/jsx-runtime': { jsx, jsxs: jsx },
    'react-icons/hi': {},
    '@/components/LanguageProvider': { useLanguage: () => ({ t: (key, values = {}) => {
      const text = options.english ? translations[key] : key
      assert.equal(typeof text, 'string', `Missing translation: ${key}`)
      return text.replace(/\{(\w+)\}/g, (match, name) => values[name] ?? match)
    } }) },
    '@/lib/supabaseClient': { supabase: { auth: {
      getSession: () => sessionImpl ? sessionImpl() : Promise.resolve({
        data: { session: sessionUser ? { user: { id: sessionUser }, access_token: `token-${sessionUser}` } : null }, error: null,
      }),
    } } },
  }
  const cjsModule = { exports: {} }
  vm.runInNewContext(componentCode, {
    module: cjsModule, exports: cjsModule.exports,
    require: name => { assert.ok(name in mocks, name); return mocks[name] },
    document, HTMLElement: Object, AbortController,
    performance: { now: () => now },
    window: {
      setInterval(callback) { timers.add(callback); return callback },
      clearInterval(callback) { timers.delete(callback) },
    },
    async fetch(url, init) {
      requests.push({ url, ...init })
      return options.fetch ? options.fetch(init, requests.length) : response({ challenge: `challenge-${requests.length}`, waitMs: 5000 })
    },
  })
  function nodes(node = tree) {
    if (!node || typeof node !== 'object') return []
    return [node, ...[node.props?.children].flat(Infinity).flatMap(child => nodes(child ?? null))]
  }
  function render(nextProps = {}) {
    assert.ok(mounted)
    Object.assign(props, nextProps)
    cursor = 0
    tree = cjsModule.exports.default(props)
    for (const node of nodes()) {
      if (!node.props?.ref) continue
      if (!node.props.ref.current) node.props.ref.current = element()
      if (node.type === 'section') node.props.ref.current.querySelectorAll = () => nodes()
        .filter(item => (item.type === 'button' || item.type === 'input') && !item.props.disabled)
        .map(item => item.props.ref?.current ?? element())
    }
    while (effects.length) effects.shift()()
    return tree
  }
  render()
  return {
    render, nodes, requests, document, trigger,
    find: predicate => nodes().find(predicate),
    button: label => nodes().find(node => node.type === 'button' && node.props.children === label),
    async ready() { render(); await flush(); render(); await flush(); return render() },
    advance(ms, tick = true) { now += ms; if (tick) [...timers].forEach(callback => callback()); render() },
    tick() { [...timers].forEach(callback => callback()); render() },
    setSession(user) { sessionUser = user },
    setSessionImpl(impl) { sessionImpl = impl },
    unmount() { mounted = false; slots.forEach(slot => slot?.cleanup?.()) },
    get tree() { return tree },
    get closeCalls() { return closeCalls },
    get deletedCalls() { return deletedCalls },
    get stateWrites() { return stateWrites },
    get timerCount() { return timers.size },
  }
}

const submit = h => h.find(node => node.type === 'form').props.onSubmit({ preventDefault() {} })
const type = (h, value) => { h.find(node => node.type === 'input').props.onChange({ target: { value } }); h.render() }
async function stageTwo(h) {
  await h.ready()
  h.advance(5000)
  h.button('Lanjutkan').props.onClick()
  h.render()
}

test('countdown starts after POST, uses elapsed time, and stage one cannot submit deletion', async () => {
  const post = deferred()
  const h = harness({ fetch: () => post.promise })
  await flush()
  h.advance(20000)
  assert.equal(h.button('Lanjutkan').props.disabled, true)
  assert.equal(h.find(node => node.type === 'form'), undefined)
  h.button('Lanjutkan').props.onClick()
  assert.equal(h.find(node => node.type === 'input'), undefined)
  post.resolve(response({ challenge: 'opaque', waitMs: 5000 }))
  await h.ready()
  for (let i = 0; i < 70; i++) h.tick()
  assert.equal(h.button('Lanjutkan').props.disabled, true)
  h.advance(4999)
  h.button('Lanjutkan').props.onClick()
  h.render()
  assert.equal(h.find(node => node.type === 'input'), undefined)
  h.advance(1)
  assert.equal(h.button('Lanjutkan').props.disabled, false)
  assert.equal(h.requests.length, 1)
  assert.equal(h.requests[0].method, 'POST')
  assert.equal(h.requests[0].headers.Authorization, 'Bearer token-owner')
  h.unmount()
})

test('a throttled timer catches up to actual elapsed time, never counts callbacks', async () => {
  const h = harness()
  await h.ready()
  h.advance(6000, false)
  assert.equal(h.button('Lanjutkan').props.disabled, true)
  h.tick()
  assert.equal(h.button('Lanjutkan').props.disabled, false)
  h.unmount()
})

test('exact immutable phrase, fresh session and authenticated DELETE; awaits parent cleanup', async () => {
  const cleanup = deferred()
  const h = harness({ onDeleted: () => cleanup.promise })
  await stageTwo(h)
  for (const value of ['delete account now', 'DELETE ACCOUNT NOW ', ' DELETE ACCOUNT NOW', 'DELETE ACCOUNT NOW\n']) {
    type(h, value)
    assert.equal(h.button('Hapus akun secara permanen').props.disabled, true)
    await submit(h)
    assert.equal(h.requests.length, 1)
  }
  type(h, 'DELETE ACCOUNT NOW')
  assert.equal(h.button('Hapus akun secara permanen').props.disabled, false)
  const deleting = submit(h)
  await flush()
  h.render()
  assert.equal(h.deletedCalls, 1)
  assert.ok(h.nodes().filter(node => node.type === 'button' || node.type === 'input').every(node => node.props.disabled))
  const request = h.requests[1]
  assert.equal(request.method, 'DELETE')
  assert.equal(request.headers.Authorization, 'Bearer token-owner')
  assert.equal(request.headers['Content-Type'], 'application/json')
  assert.deepEqual(JSON.parse(request.body), { challenge: 'challenge-1', confirmation: 'DELETE ACCOUNT NOW' })
  assert.equal(request.signal, undefined)
  cleanup.resolve()
  await deleting
  h.unmount()
})

test('authentication checks reject signed-out or different accounts on every POST/DELETE', async () => {
  for (const user of [null, 'other']) {
    const h = harness({ sessionUser: user })
    await h.ready()
    assert.equal(h.requests.length, 0)
    assert.ok(h.button('Mulai ulang konfirmasi'))
    h.unmount()
    const final = harness()
    await stageTwo(final)
    type(final, 'DELETE ACCOUNT NOW')
    final.setSession(user)
    await submit(final)
    await final.ready()
    assert.equal(final.requests.length, 1)
    assert.equal(final.deletedCalls, 0)
    final.unmount()
  }
})

test('a changed userId or closing during auth preflight cannot send DELETE', async () => {
  for (const nextProps of [{ userId: 'other' }, { isClosing: true }]) {
    const h = harness()
    await stageTwo(h)
    type(h, 'DELETE ACCOUNT NOW')
    const session = deferred()
    h.setSessionImpl(() => session.promise)
    const deleting = submit(h)
    h.render(nextProps)
    session.resolve({ data: { session: { user: { id: 'owner' }, access_token: 'token' } }, error: null })
    await deleting
    assert.equal(h.requests.length, 1)
    h.unmount()
  }
})

test('all API error codes are generic, translated, and require an explicit fresh challenge', async () => {
  for (const code of ['unauthorized', 'invalid_confirmation', 'invalid_challenge', 'wait_required', 'challenge_expired', 'unavailable', 'delete_failed']) {
    const h = harness({ fetch: init => init.method === 'POST'
      ? response({ challenge: 'fresh', waitMs: 5000 })
      : response({ error: code, message: 'PRIVATE SERVER DETAIL' }, 400) })
    await stageTwo(h)
    type(h, 'DELETE ACCOUNT NOW')
    await submit(h)
    await h.ready()
    assert.equal(h.button('Hapus akun secara permanen').props.disabled, true)
    assert.ok(!JSON.stringify(h.tree).includes('PRIVATE SERVER DETAIL'))
    assert.equal(h.requests.length, 2)
    h.button('Mulai ulang konfirmasi').props.onClick()
    await h.ready()
    assert.equal(h.requests.length, 3)
    assert.equal(h.button('Lanjutkan').props.disabled, true)
    h.advance(5000)
    h.button('Lanjutkan').props.onClick()
    h.render()
    assert.equal(h.find(node => node.type === 'input').props.value, '')
    h.unmount()
  }
})

test('unmount aborts initial POST and ignores late results; timers are cleaned up', async () => {
  const post = deferred()
  const h = harness({ fetch: () => post.promise })
  await flush()
  h.unmount()
  assert.equal(h.requests[0].signal.aborted, true)
  const writes = h.stateWrites
  post.resolve(response({ challenge: 'late', waitMs: 5000 }))
  await flush()
  assert.equal(h.stateWrites, writes)
  const ready = harness()
  await ready.ready()
  assert.equal(ready.timerCount, 1)
  ready.unmount()
  assert.equal(ready.timerCount, 0)
})

test('cancel is possible before deletion, not after send, and duplicate submits do not resend', async () => {
  const h = harness()
  await h.ready()
  h.button('Batal').props.onClick()
  assert.equal(h.closeCalls, 1)
  h.unmount()
  const pending = deferred()
  const deleting = harness({ fetch: init => init.method === 'POST'
    ? response({ challenge: 'opaque', waitMs: 5000 }) : pending.promise })
  await stageTwo(deleting)
  type(deleting, 'DELETE ACCOUNT NOW')
  const operation = submit(deleting)
  await flush()
  deleting.render()
  await submit(deleting)
  deleting.tree.props.onKeyDown({ key: 'Escape', stopPropagation() {}, preventDefault() {} })
  assert.equal(deleting.closeCalls, 0)
  assert.equal(deleting.requests.length, 2)
  pending.resolve(response(null, 204))
  await operation
  assert.equal(deleting.deletedCalls, 1)
  deleting.unmount()
})

test('parent cleanup failure retries only the callback, not account deletion', async () => {
  let fail = true
  const h = harness({ onDeleted: async () => { if (fail) throw new Error('cleanup') } })
  await stageTwo(h)
  type(h, 'DELETE ACCOUNT NOW')
  await submit(h)
  await h.ready()
  assert.ok(h.button('Selesaikan keluar'))
  fail = false
  h.button('Selesaikan keluar').props.onClick()
  await flush()
  assert.equal(h.requests.length, 2)
  assert.equal(h.deletedCalls, 2)
  h.unmount()
})

test('focus traps, restores before inert closing, and uses shared motion classes', async () => {
  const h = harness()
  await h.ready()
  assert.notEqual(h.document.activeElement, h.trigger)
  h.document.activeElement = h.trigger
  const event = { key: 'Tab', shiftKey: true, stopPropagation() {}, preventDefault() { this.prevented = true } }
  h.tree.props.onKeyDown(event)
  assert.equal(event.prevented, true)
  assert.notEqual(h.document.activeElement, h.trigger)
  assert.match(h.tree.props.className, /z-\[150\].*animate-modal-backdrop/)
  assert.match(h.find(node => node.type === 'section').props.className, /animate-modal-enter/)
  h.render({ isClosing: true })
  assert.equal(h.tree.props.inert, true)
  assert.equal(h.tree.props['data-motion-state'], 'closing')
  assert.equal(h.document.activeElement, h.trigger)
  h.unmount()
})

test('English UI and every literal t source are covered; confirmation phrase is not translated', async () => {
  const ast = ts.createSourceFile('dialog.tsx', source, ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX)
  function visit(node) {
    if (ts.isCallExpression(node) && node.expression.getText(ast) === 't' && ts.isStringLiteral(node.arguments[0])) {
      assert.ok(node.arguments[0].text in translations, node.arguments[0].text)
    }
    ts.forEachChild(node, visit)
  }
  visit(ast)
  for (const [key, value] of Object.entries(translations)) {
    const placeholders = text => [...text.matchAll(/\{(\w+)\}/g)].map(match => match[1]).sort()
    assert.deepEqual(placeholders(key), placeholders(value))
  }
  for (const key of ['Catatan dihapus', 'Catatan ini sudah dihapus oleh pemilik.', 'Kembali ke Catatan', 'Hapus Akun', 'Hapus akun dan semua catatan milikmu secara permanen.']) assert.ok(key in translations)
  assert.ok(!('DELETE ACCOUNT NOW' in translations))
  const h = harness({ english: true })
  await h.ready()
  h.advance(5000)
  h.button('Continue').props.onClick()
  h.render()
  const phrase = h.find(node => node.props?.children === 'DELETE ACCOUNT NOW')
  assert.equal(phrase.props.translate, 'no')
  assert.equal(phrase.props.lang, 'en')
  h.unmount()
})

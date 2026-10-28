import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { dirname, resolve } from 'node:path'
import test from 'node:test'
import { fileURLToPath } from 'node:url'
import vm from 'node:vm'
import ts from 'typescript'

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..')

function loadTypeScript(file, mocks = {}) {
  const filename = resolve(root, file)
  const cjsModule = { exports: {} }
  const code = ts.transpileModule(readFileSync(filename, 'utf8'), {
    compilerOptions: { module: ts.ModuleKind.CommonJS, jsx: ts.JsxEmit.ReactJSX },
  }).outputText
  vm.runInNewContext(code, {
    module: cjsModule,
    exports: cjsModule.exports,
    require(name) {
      if (name in mocks) return mocks[name]
      const target = name.startsWith('@/') ? resolve(root, name.slice(2)) : resolve(dirname(filename), name)
      return loadTypeScript(`${target}.ts`, mocks)
    },
    ...mocks.globals,
  }, { filename })
  return cjsModule.exports
}

const i18n = loadTypeScript('lib/i18n.ts')

function createProviderHarness(initialUser, sessionPromise) {
  let user = initialUser
  let listener
  let cursor = 0
  let nextError = null
  let updateImpl
  const slots = []
  const pendingEffects = []
  const calls = []
  const document = { documentElement: { lang: 'id' }, title: '' }
  const react = {
    createContext: () => ({ Provider: 'LanguageContext' }),
    useState(initial) {
      const index = cursor++
      if (!(index in slots)) slots[index] = initial
      return [slots[index], value => { slots[index] = value }]
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
        pendingEffects.push(() => {
          previous?.cleanup?.()
          slots[index] = { deps, cleanup: effect() }
        })
      }
    },
    useCallback: callback => callback,
    useMemo: compute => compute(),
  }
  const auth = {
    onAuthStateChange(callback) {
      listener = callback
      return { data: { subscription: { unsubscribe() { listener = null } } } }
    },
    getSession: () => sessionPromise ?? Promise.resolve({ data: { session: user ? { user } : null }, error: null }),
    async updateUser(payload) {
      calls.push(payload)
      if (updateImpl) return updateImpl(payload)
      if (nextError) return { data: { user: null }, error: nextError }
      user = { ...user, user_metadata: { ...user.user_metadata, ...payload.data } }
      listener?.('USER_UPDATED', { user })
      return { data: { user }, error: null }
    },
  }
  const { default: Provider } = loadTypeScript('components/LanguageProvider.tsx', {
    react,
    'react/jsx-runtime': { jsx: (type, props) => ({ type, props }) },
    '@/lib/i18n': i18n,
    '@/lib/supabaseClient': { supabase: { auth }, supabaseConfigReady: true },
    globals: { document },
  })
  return {
    render() {
      cursor = 0
      const value = Provider({ children: null }).props.value
      while (pendingEffects.length) pendingEffects.shift()()
      return value
    },
    signIn(nextUser) { user = nextUser; listener('SIGNED_IN', { user }) },
    signOut() { user = null; listener('SIGNED_OUT', null) },
    failNextSave(error) { nextError = error },
    overrideUpdate(callback) { updateImpl = callback },
    unmount() { slots.forEach(slot => slot?.cleanup?.()) },
    get user() { return user },
    get subscribed() { return Boolean(listener) },
    calls,
    document,
  }
}

const accountA = { id: 'account-a', user_metadata: { full_name: 'Example A', language: 'en' } }
const accountB = { id: 'account-b', user_metadata: { full_name: 'Example B' } }

async function initialize(harness) {
  harness.render()
  await Promise.resolve()
  await Promise.resolve()
  return harness.render()
}

test('unsupported or missing metadata defaults to Indonesian', () => {
  for (const value of [undefined, null, {}, { language: 'fr' }, { language: false }]) {
    assert.equal(i18n.getAccountLanguage(value), 'id')
  }
  assert.equal(i18n.getAccountLanguage({ language: 'en' }), 'en')
})

test('legacy labels are consistent and interpolation preserves user content', () => {
  assert.equal(i18n.translate('id', 'New Notes'), 'Catatan Baru')
  assert.equal(i18n.translate('en', 'New Notes'), 'New Note')
  assert.equal(i18n.translate('id', 'Free Plan'), 'Paket Gratis')
  assert.equal(i18n.translate('id', 'Autosave complete'), 'Tersimpan otomatis')
  const name = 'Catatan $& {other} <script>'
  assert.equal(i18n.translate('en', 'Buka catatan {name}', { name }), `Open note ${name}`)
  assert.equal(i18n.translate('en', 'Buka catatan {name}'), 'Open note {name}')
})

test('translations preserve interpolation placeholders', () => {
  const placeholders = text => [...text.matchAll(/\{(\w+)\}/g)].map(match => match[1]).sort()
  for (const [source, translated] of Object.entries(i18n.englishTranslations)) {
    assert.deepEqual(placeholders(translated), placeholders(source), source)
  }
})

test('all literal UI translation keys have English coverage', () => {
  const brands = new Set(['Notes', 'Premium'])
  for (const file of ['app/page.tsx', 'app/notes/[id]/page.tsx', 'components/DashboardNotes.tsx', 'components/ApplicationSettings.tsx', 'components/NewNoteButton.tsx', 'components/DeleteAccountDialog.tsx', 'components/DeletedNoteCard.tsx']) {
    const source = ts.createSourceFile(file, readFileSync(resolve(root, file), 'utf8'), ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX)
    function visit(node) {
      if (ts.isCallExpression(node) && node.expression.getText(source) === 't' && ts.isStringLiteral(node.arguments[0])) {
        const key = node.arguments[0].text
        assert.ok(key in i18n.englishTranslations || brands.has(key), `${file}: ${key}`)
      }
      ts.forEachChild(node, visit)
    }
    visit(source)
  }
})

test('restores the account language, updates HTML language, and isolates sign-in/sign-out', async () => {
  const harness = createProviderHarness(accountA)
  assert.equal((await initialize(harness)).language, 'en')
  assert.equal(harness.document.documentElement.lang, 'en')
  harness.signIn(accountB)
  assert.equal(harness.render().language, 'id')
  harness.signIn(accountA)
  assert.equal(harness.render().language, 'en')
  harness.signOut()
  assert.equal(harness.render().language, 'id')
  harness.unmount()
  assert.equal(harness.subscribed, false)
})

test('saves to account metadata, preserves other fields, and restores on a new session', async () => {
  const harness = createProviderHarness(accountB)
  const context = await initialize(harness)
  await context.setLanguage('en')
  assert.equal(harness.calls.length, 1)
  assert.equal(harness.calls[0].data.language, 'en')
  assert.equal(harness.user.user_metadata.full_name, 'Example B')
  assert.equal(harness.render().language, 'en')
  assert.equal((await initialize(createProviderHarness(harness.user))).language, 'en')
})

test('save failures leave the active language unchanged; signed-out users cannot save', async () => {
  const harness = createProviderHarness(accountB)
  const context = await initialize(harness)
  harness.failNextSave(new Error('Network unavailable'))
  await assert.rejects(context.setLanguage('en'), /Network unavailable/)
  assert.equal(harness.render().language, 'id')
  harness.signOut()
  await assert.rejects(harness.render().setLanguage('en'), /Masuk kembali/)
  await assert.rejects(harness.render().setLanguage('fr'), /tidak didukung/)
})

test('settings keyboard trap uses the checked radio as the last Tab stop', () => {
  const refs = []
  const document = { activeElement: null }
  const { default: ApplicationSettings } = loadTypeScript('components/ApplicationSettings.tsx', {
    react: {
      useState: value => [value, () => {}],
      useEffect() {},
      useRef(value) { const ref = { current: value }; refs.push(ref); return ref },
    },
    'react/jsx-runtime': { jsx: (type, props) => ({ type, props }), jsxs: (type, props) => ({ type, props }) },
    'react-icons/hi': {},
    '@/components/LanguageProvider': { useLanguage: () => ({ language: 'id', ready: true, t: source => source }) },
    globals: { document },
  })
  const overlay = ApplicationSettings({ isDark: false, onClose() {} })
  const closeButton = { focus() { document.activeElement = closeButton } }
  const checkedRadio = { focus() { document.activeElement = checkedRadio } }
  refs[0].current = {
    querySelectorAll(selector) {
      assert.match(selector, /:checked/)
      return [closeButton, checkedRadio]
    },
  }
  const event = { key: 'Tab', shiftKey: false, preventDefault() { this.prevented = true } }
  document.activeElement = checkedRadio
  overlay.props.onKeyDown(event)
  assert.equal(event.prevented, true)
  assert.equal(document.activeElement, closeButton)
  event.shiftKey = true
  overlay.props.onKeyDown(event)
  assert.equal(document.activeElement, checkedRadio)
})

test('late startup session results do not overwrite a newer account', async () => {
  let resolveSession
  const harness = createProviderHarness(accountA, new Promise(resolve => { resolveSession = resolve }))
  harness.render()
  harness.signIn(accountB)
  resolveSession({ data: { session: { user: accountA } }, error: null })
  await Promise.resolve()
  assert.equal(harness.render().language, 'id')
})

test('an in-flight save result cannot apply to a different signed-in account', async () => {
  let resolveUpdate
  const harness = createProviderHarness(accountB)
  const context = await initialize(harness)
  harness.overrideUpdate(() => new Promise(resolve => { resolveUpdate = resolve }))
  const saving = context.setLanguage('en')
  harness.signIn({ id: 'account-c', user_metadata: { language: 'id' } })
  resolveUpdate({ data: { user: { ...accountB, user_metadata: { language: 'en' } } }, error: null })
  await assert.rejects(saving, /Masuk kembali/)
  assert.equal(harness.render().language, 'id')
})

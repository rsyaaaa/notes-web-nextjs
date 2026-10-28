import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import test from 'node:test'
import vm from 'node:vm'
import ts from 'typescript'

const paths = {
  home: 'app/page.tsx',
  detail: 'app/notes/[id]/page.tsx',
  dashboard: 'components/DashboardNotes.tsx',
}
const sources = Object.fromEntries(Object.entries(paths).map(([key, path]) => [
  key, ts.createSourceFile(path, readFileSync(new URL(`../${path}`, import.meta.url), 'utf8'), ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX),
]))

// Execute the real callbacks without mounting unrelated page UI or introducing a DOM dependency.
function callback(page, name, globals) {
  const source = sources[page]
  let initializer
  function visit(node) {
    if (ts.isVariableDeclaration(node) && node.name.getText(source) === name) initializer = node.initializer
    ts.forEachChild(node, visit)
  }
  visit(source)
  assert.ok(initializer, `${page}: ${name}`)
  if (ts.isCallExpression(initializer) && initializer.expression.getText(source) === 'useCallback') initializer = initializer.arguments[0]
  const code = ts.transpileModule(`module.exports = (${initializer.getText(source)})`, {
    compilerOptions: { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.CommonJS },
  }).outputText
  const cjsModule = { exports: {} }
  vm.runInNewContext(code, { module: cjsModule, console, ...globals })
  return cjsModule.exports
}

function deferred() {
  let resolve
  const promise = new Promise(done => { resolve = done })
  return { promise, resolve }
}
const ok = (data = { id: 7 }) => ({ data, error: null })
const draft = { title: 'Private draft', content: 'Unsaved content', accentColor: '#ffffff', folderId: '' }

function harness(page, response = ok()) {
  const writes = []
  const queries = []
  const state = { title: draft.title, content: draft.content, isFormOpen: true, notes: [{ id: 7 }], deletionNotices: [] }
  const globals = {
    user: { id: 'account-a' },
    accountScopeRef: { current: { active: true, userId: 'account-a' } },
    editorVersionRef: { current: 1 },
    notesFetchVersionRef: { current: 0 },
    deletedNoteIdsRef: { current: new Set() },
    deletedRef: { current: false },
    autoSaveTimerRef: { current: null },
    currentDraftRef: { current: draft },
    savedDraftRef: { current: draft },
    lastSavedRef: { current: draft },
    lastSavedDraft: { current: draft },
    isNavigatingAwayRef: { current: true },
    editingNoteId: 7, noteId: 7, isNew: false,
    title: draft.title, content: draft.content, accentColor: '#ffffff', folderId: '', selectedFolderId: '',
    isFormOpen: true, isFormClosing: false,
    t: value => value,
    fetchNotes: async () => { writes.push(['fetchNotes']) },
    reloadNotes: async () => { writes.push(['reloadNotes']) },
    findDeletionNotice: async () => null,
    isCurrent: () => true,
    router: { replace: path => writes.push(['replace', path]), push: path => writes.push(['push', path]) },
    window: { setTimeout: fn => { globals.closeTimer = fn }, clearTimeout() {} },
    getMotionDuration: value => value,
  }
  for (const name of new Set(sources[page].text.match(/\bset[A-Z]\w*(?=\()/g))) {
    globals[name] = value => {
      const key = name[3].toLowerCase() + name.slice(4)
      state[key] = typeof value === 'function' ? value(state[key]) : value
      writes.push([name, state[key]])
    }
  }
  globals.supabase = {
    from(table) {
      const query = { table, selected: false }
      const chain = {
        update(payload) { query.operation = 'update'; query.payload = payload; return chain },
        insert(payload) { query.operation = 'insert'; query.payload = payload; return chain },
        select(columns) { query.selected = columns; return chain },
        eq() { return chain }, order() { return chain }, limit() { return chain },
        single() { return chain }, maybeSingle() { return chain },
        then(resolve, reject) {
          queries.push(query)
          return Promise.resolve(table === 'note_deletion_notices' ? globals.noticeResponse ?? ok(null) : response).then(resolve, reject)
        },
      }
      return chain
    },
  }
  globals.markDeleted = callback('detail', 'markDeleted', globals)
  globals.closeNoteForm = callback('home', 'closeNoteForm', globals)
  const save = page === 'home' ? 'saveEditorDraft' : page === 'detail' ? 'saveNote' : 'handleSaveModal'
  return { globals, state, writes, queries, save: callback(page, save, globals) }
}

for (const page of Object.keys(paths)) {
  test(`${page}: a returned row allows normal save completion`, async () => {
    const h = harness(page)
    await h.save(page === 'home' ? draft : undefined)
    assert.equal(h.queries[0].selected, 'id')
    if (page === 'dashboard') assert.equal(h.state.isFormOpen, false)
    else assert.equal(h.state.saveStatus, 'saved')
    assert.equal(h.state.content, draft.content)
  })

  test(`${page}: update success requires a returned row`, async () => {
    const h = harness(page, ok(null))
    await h.save(page === 'home' ? draft : undefined)
    assert.equal(h.queries[0].selected, 'id')
    assert.ok(!h.writes.some(([name, value]) => name === 'setSaveStatus' && value === 'saved'))
    assert.ok(!h.writes.some(([name]) => name === 'setLastSavedDraft'))
    if (page === 'detail') {
      assert.equal(h.globals.deletedRef.current, true)
      assert.equal(h.state.content, '')
    } else {
      assert.equal(h.globals.deletedNoteIdsRef.current.has(7), true)
      assert.equal(h.state.isFormOpen, false)
      assert.equal(h.state.content, '')
    }
  })

  test(`${page}: network error preserves the draft and baseline`, async () => {
    const h = harness(page, { data: null, error: { message: 'Temporary connection failure' } })
    const baseline = h.globals.lastSavedRef.current
    await h.save(page === 'home' ? draft : undefined)
    assert.equal(h.state.content, draft.content)
    assert.equal(h.globals.lastSavedRef.current, baseline)
    assert.equal(h.globals.deletedRef.current, false)
    assert.equal(h.globals.deletedNoteIdsRef.current.size, 0)
    assert.equal(h.state.isFormOpen, true)
  })

  for (const isNew of [false, true]) {
    test(`${page}: late ${isNew ? 'insert' : 'update'} does not affect another account`, async () => {
      const pending = deferred()
      const h = harness(page, pending.promise)
      h.globals.isNew = isNew
      h.globals.editingNoteId = isNew ? null : 7
      const saveName = page === 'home' ? 'saveEditorDraft' : page === 'detail' ? 'saveNote' : 'handleSaveModal'
      const save = callback(page, saveName, h.globals)
      const operation = save(page === 'home' ? draft : undefined)
      const oldScope = h.globals.accountScopeRef.current
      oldScope.active = false
      h.globals.accountScopeRef.current = { active: true, userId: 'account-b' }
      h.globals.editorVersionRef.current++
      const before = h.writes.length
      pending.resolve(ok())
      await operation
      assert.equal(h.writes.length, before)
      assert.equal(h.queries.length, 1)
    })
  }

  test(`${page}: late failure does not change the next account's state`, async () => {
    const pending = deferred()
    const h = harness(page, pending.promise)
    const operation = h.save(page === 'home' ? draft : undefined)
    h.globals.accountScopeRef.current.active = false
    h.globals.accountScopeRef.current = { active: true, userId: 'account-b' }
    h.globals.editorVersionRef.current++
    const before = h.writes.length
    pending.resolve({ data: null, error: { message: 'Late failure' } })
    await operation
    assert.equal(h.writes.length, before)
  })
}

for (const page of ['home', 'dashboard']) {
  test(`${page}: confirmed absence closes immediately; a late notice cannot affect another account`, async () => {
    const h = harness(page, ok(null))
    const notice = deferred()
    h.globals.noticeResponse = notice.promise
    const operation = h.save(page === 'home' ? draft : undefined)
    for (let i = 0; i < 8; i++) await Promise.resolve()
    assert.equal(h.state.isFormOpen, false)
    assert.equal(h.state.content, '')
    h.globals.accountScopeRef.current.active = false
    h.globals.accountScopeRef.current = { active: true, userId: 'account-b' }
    const before = h.writes.length
    notice.resolve(ok({ note_id: 7, user_id: 'account-a' }))
    await operation
    assert.equal(h.writes.length, before)
  })
}

test('detail: availability network errors do not mark deletion or discard unsaved edits', async () => {
  const h = harness('detail', { data: null, error: { message: 'Offline' } })
  await callback('detail', 'checkMissingNote', h.globals)()
  assert.equal(h.globals.deletedRef.current, false)
  assert.equal(h.state.content, draft.content)
  assert.equal(h.state.saveStatus, 'error')
})

test('detail: confirmed absence marks deletion and retrieves only the current recipient notice', async () => {
  const h = harness('detail', ok(null))
  const notice = { note_id: 7, user_id: 'account-a' }
  h.globals.findDeletionNotice = async (noteId, userId) => {
    assert.equal(noteId, 7)
    assert.equal(userId, 'account-a')
    return notice
  }
  await callback('detail', 'checkMissingNote', h.globals)()
  assert.equal(h.globals.deletedRef.current, true)
  assert.equal(h.state.deletionNotice, notice)
})

test('home: sign-out clears an open new-note draft and invalidates pending work before next login', () => {
  const h = harness('home')
  h.globals.setUser = value => h.writes.push(['setUser', value])
  const acceptUser = callback('home', 'acceptUser', h.globals)
  const oldScope = h.globals.accountScopeRef.current
  acceptUser(null)
  assert.notEqual(h.globals.accountScopeRef.current, oldScope)
  assert.equal(h.globals.accountScopeRef.current.userId, null)
  assert.equal(h.state.isFormOpen, false)
  assert.equal(h.state.editingNoteId, null)
  assert.equal(h.state.content, '')
  assert.equal(h.globals.currentDraftRef.current.content, '')
  acceptUser({ id: 'account-b' })
  assert.equal(h.state.isFormOpen, false)
  assert.equal(h.state.content, '')
})

test('home: a delayed modal close cannot close the next account or a newly opened editor', () => {
  for (const switchAccount of [false, true]) {
    const h = harness('home')
    h.globals.closeNoteForm()
    if (switchAccount) h.globals.accountScopeRef.current = { userId: 'account-b' }
    else h.globals.editorVersionRef.current++
    const before = h.writes.length
    h.globals.closeTimer()
    assert.equal(h.writes.length, before)
  }
})

test('detail: late latest-note lookup cannot navigate another account', async () => {
  const h = harness('detail')
  const latest = deferred()
  h.globals.isNew = true
  h.globals.isNavigatingAwayRef.current = false
  h.globals.supabase = {
    from() {
      return {
        insert: async () => ok(),
        select() { return this }, eq() { return this }, order() { return this }, limit() { return this },
        maybeSingle: () => latest.promise,
      }
    },
  }
  const operation = callback('detail', 'saveNote', h.globals)()
  await Promise.resolve()
  h.globals.accountScopeRef.current.active = false
  const before = h.writes.length
  latest.resolve(ok({ id: 99 }))
  await operation
  assert.equal(h.writes.length, before)
})

test('dashboard: a refetch finishing after an account switch cannot close the new modal', async () => {
  const h = harness('dashboard')
  const reload = deferred()
  h.globals.reloadNotes = () => reload.promise
  const operation = callback('dashboard', 'handleSaveModal', h.globals)()
  for (let i = 0; i < 5; i++) await Promise.resolve()
  h.globals.accountScopeRef.current.active = false
  const before = h.writes.length
  reload.resolve()
  await operation
  assert.equal(h.writes.length, before)
})

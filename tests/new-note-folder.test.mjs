import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { dirname, resolve } from 'node:path'
import test from 'node:test'
import { fileURLToPath } from 'node:url'
import vm from 'node:vm'
import ts from 'typescript'

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..')

function evaluate(code, globals = {}) {
  const cjsModule = { exports: {} }
  vm.runInNewContext(ts.transpileModule(code, {
    compilerOptions: { module: ts.ModuleKind.CommonJS },
  }).outputText, { module: cjsModule, exports: cjsModule.exports, ...globals })
  return cjsModule.exports
}

const helpers = evaluate(readFileSync(resolve(root, 'lib/new-note-folder.ts'), 'utf8'))
const { getNewNoteFolderId, getNewNoteHref } = helpers
const folders = [{ id: 7 }, { id: 42 }]

function findArrow(file, name) {
  const source = ts.createSourceFile(file, readFileSync(resolve(root, file), 'utf8'), ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX)
  let result
  function visit(node) {
    if (ts.isVariableDeclaration(node) && node.name.getText(source) === name && node.initializer && ts.isArrowFunction(node.initializer)) {
      result = node.initializer.getText(source)
    }
    ts.forEachChild(node, visit)
  }
  visit(source)
  assert.ok(result, `${file}: ${name}`)
  return result
}

function handler(file, name, globals) {
  return evaluate(`exports.run = ${findArrow(file, name)}`, globals).run
}

test('inherits an existing folder but ignores all-notes/no-folder filters and invalid IDs', () => {
  assert.equal(getNewNoteFolderId('42', folders), '42')
  for (const value of ['all', 'none', '', null, '999', '-1', '42abc', '042', '0']) {
    assert.equal(getNewNoteFolderId(value, folders), '', String(value))
  }
  assert.equal(getNewNoteFolderId('42', []), '')
})

test('mobile URL carries the selected folder, but not stale or foreign folder IDs', () => {
  assert.equal(getNewNoteHref('42', folders), '/notes/new?folder=42')
  assert.equal(new URL(getNewNoteHref('42', folders), 'https://example.test').searchParams.get('folder'), '42')
  for (const value of ['all', 'none', '', null, '999']) {
    assert.equal(getNewNoteHref(value, folders), '/notes/new')
  }
})

test('desktop dashboard initializes the picker and saved draft with the active folder', () => {
  for (const folderFilter of ['42', 'all', '']) {
    const state = {}
    const globals = { ...helpers, folders, folderFilter }
    for (const name of ['NoteMembers', 'OnlineMembers', 'EditingNoteId', 'Title', 'Content', 'AccentColor', 'SelectedFolderId', 'LastSavedDraft', 'SaveStatus', 'IsFormOpen']) {
      globals[`set${name}`] = value => { state[name] = value }
    }
    handler('app/page.tsx', 'openNewNote', globals)()
    const expected = folderFilter === '42' ? '42' : ''
    assert.equal(state.SelectedFolderId, expected)
    assert.equal(state.LastSavedDraft.folderId, expected)
    assert.equal(state.IsFormOpen, true)
  }
})

test('mobile dashboard navigation passes the folder context', () => {
  let destination
  const globals = {
    ...helpers, folders, folderFilter: '42',
    window: { innerWidth: 390, setTimeout() {} },
    router: { push: href => { destination = href } },
    setOpeningNoteId() {},
  }
  handler('app/page.tsx', 'handleNewNoteClick', globals)()
  assert.equal(destination, '/notes/new?folder=42')
})

test('alternate dashboard preserves the folder on both screen sizes', () => {
  for (const width of [390, 1280]) {
    const state = {}
    const lastSavedDraft = { current: null }
    const globals = {
      ...helpers, folders, folderFilter: '7', lastSavedDraft,
      window: { innerWidth: width },
      router: { push: href => { state.destination = href } },
    }
    for (const name of ['EditingNoteId', 'Title', 'Content', 'AccentColor', 'SelectedFolderId', 'IsFormOpen']) {
      globals[`set${name}`] = value => { state[name] = value }
    }
    handler('components/DashboardNotes.tsx', 'handleNewNoteClick', globals)()
    if (width < 768) assert.equal(state.destination, '/notes/new?folder=7')
    else {
      assert.equal(state.SelectedFolderId, '7')
      assert.equal(lastSavedDraft.current.folderId, '7')
    }
  }
})

test('new-note page validates the requested folder against folders fetched for the signed-in account', async () => {
  for (const requestedFolder of ['42', '999', null]) {
    const state = {}
    const lastSavedRef = { current: null }
    const authUser = { id: 'account-a', user_metadata: {} }
    const queries = []
    const globals = {
      ...helpers, requestedFolder, isNew: true, isMounted: true, supabaseConfigReady: true, lastSavedRef,
      router: { push() { assert.fail('Unexpected redirect') } },
      supabase: {
        auth: { getUser: async () => ({ data: { user: authUser } }) },
        from(table) {
          const query = {
            select() { return query },
            eq(column, value) { queries.push({ table, column, value }); return query },
            maybeSingle: async () => ({ data: { full_name: 'Example' } }),
            order: async () => ({ data: folders }),
          }
          return query
        },
      },
    }
    for (const name of ['User', 'Profile', 'Folders', 'NoteOwnerId', 'OwnerPerson', 'Title', 'Content', 'AccentColor', 'FolderId', 'IsPinned', 'IsTrashed', 'Loading']) {
      globals[`set${name}`] = value => { state[name] = value }
    }
    await handler('app/notes/[id]/page.tsx', 'init', globals)()
    const expected = requestedFolder === '42' ? '42' : ''
    assert.equal(state.FolderId, expected)
    assert.equal(lastSavedRef.current.folderId, expected)
    assert.equal(state.Loading, false)
    assert.ok(queries.some(query => query.table === 'note_folders' && query.column === 'user_id' && query.value === authUser.id))
  }
})

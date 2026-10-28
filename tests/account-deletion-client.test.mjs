import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import vm from 'node:vm'
import test from 'node:test'
import ts from 'typescript'

const storageKey = 'sb-example-auth-token'

function harness({ signOutError = null, throws = false, storageBlocked = false } = {}) {
  const calls = []
  const stored = new Map([
    [storageKey, 'deleted-session'],
    [`${storageKey}-user`, 'deleted-user'],
    [`${storageKey}-code-verifier`, 'legacy-verifier'],
    [`${storageKey}-flows-code-verifier`, 'flows'],
    [`${storageKey}-flow-example-code-verifier`, 'verifier'],
    ['sb-other-auth-token', 'other-project-session'],
    ['theme', 'dark'],
  ])
  const auth = {
    async stopAutoRefresh() { calls.push('stop') },
    async signOut(options) {
      calls.push(options.scope)
      if (throws) throw new Error('Offline')
      return { error: signOutError }
    },
  }
  const window = {
    get localStorage() {
      if (storageBlocked) throw new Error('Storage blocked')
      return {
        get length() { return stored.size },
        key(index) { return [...stored.keys()][index] ?? null },
        removeItem(key) { stored.delete(key) },
      }
    },
    location: { replace(path) { calls.push(path) } },
  }
  const mod = { exports: {} }
  const source = readFileSync(new URL('../lib/delete-account-client.ts', import.meta.url), 'utf8')
  vm.runInNewContext(ts.transpileModule(source, {
    compilerOptions: { module: ts.ModuleKind.CommonJS },
  }).outputText, {
    module: mod, exports: mod.exports, window,
    require(name) {
      assert.equal(name, '@/lib/supabaseClient')
      return { supabase: { auth }, supabaseAuthStorageKey: storageKey }
    },
  })
  return { finish: mod.exports.finishAccountDeletion, stored, calls }
}

for (const options of [{}, { signOutError: new Error('Deleted user') }, { throws: true }]) {
  test(`clears only the app session then returns to login (${options.throws ? 'throw' : options.signOutError ? 'auth error' : 'success'})`, async () => {
    const h = harness(options)
    await h.finish()
    assert.deepEqual([...h.stored.keys()], ['sb-other-auth-token', 'theme'])
    assert.deepEqual(h.calls, ['stop', 'local', '/'])
  })
}

test('successful SDK sign-out can navigate when browser storage is blocked', async () => {
  const h = harness({ storageBlocked: true })
  await h.finish()
  assert.equal(h.calls.at(-1), '/')
})

test('failed sign-out and blocked storage leave a retryable cleanup failure', async () => {
  const h = harness({ storageBlocked: true, throws: true })
  await assert.rejects(h.finish(), /Storage blocked/)
  assert.equal(h.calls.includes('/'), false)
})

test('deleted-note cards contain no original note content or account-deletion reason', () => {
  const source = readFileSync(new URL('../components/DeletedNoteCard.tsx', import.meta.url), 'utf8')
  assert.match(source, /HiOutlineTrash/)
  assert.match(source, /Catatan ini sudah dihapus oleh pemilik\./)
  assert.doesNotMatch(source, /notice\.(title|content|owner|reason)|onClick|tabIndex|role="button"/)
})

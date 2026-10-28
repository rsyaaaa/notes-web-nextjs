'use client'

import { supabase, supabaseAuthStorageKey } from '@/lib/supabaseClient'

// Only call after the server has confirmed permanent account deletion.
export async function finishAccountDeletion(): Promise<void> {
  await supabase.auth.stopAutoRefresh()
  let signedOut = false
  try {
    const { error } = await supabase.auth.signOut({ scope: 'local' })
    signedOut = !error
  } catch {
    // A deleted/expired session or network failure must not leave a cached login.
  }

  try {
    const storage = window.localStorage
    const keys: string[] = []
    for (let index = 0; index < storage.length; index += 1) {
      const key = storage.key(index)
      if (key === supabaseAuthStorageKey || key === `${supabaseAuthStorageKey}-user`
        || key === `${supabaseAuthStorageKey}-code-verifier`
        || key === `${supabaseAuthStorageKey}-flows-code-verifier`
        || (key?.startsWith(`${supabaseAuthStorageKey}-flow-`) && key.endsWith('-code-verifier'))) {
        keys.push(key)
      }
    }
    keys.forEach((key) => storage.removeItem(key))
  } catch (error) {
    if (!signedOut) throw error
  }

  // A full navigation also discards in-memory notes and the deleted auth session.
  window.location.replace('/')
}

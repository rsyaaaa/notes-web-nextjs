'use client'

import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react'
import type { ReactNode } from 'react'
import type { User } from '@supabase/supabase-js'
import { getAccountLanguage, isLanguage, languageLocales, translate } from '@/lib/i18n'
import type { Language, TranslationValues } from '@/lib/i18n'
import { supabase, supabaseConfigReady } from '@/lib/supabaseClient'

interface LanguageContextValue {
  language: Language
  locale: string
  ready: boolean
  t: (source: string, values?: TranslationValues) => string
  setLanguage: (language: Language) => Promise<void>
}

const LanguageContext = createContext<LanguageContextValue | null>(null)

export default function LanguageProvider({ children }: { children: ReactNode }) {
  const [language, setCurrentLanguage] = useState<Language>('id')
  const [ready, setReady] = useState(!supabaseConfigReady)
  const userRef = useRef<User | null>(null)

  useEffect(() => {
    if (!supabaseConfigReady) return

    let active = true
    let authChanged = false
    const applyUser = (user: User | null) => {
      if (!active) return
      userRef.current = user
      // Never carry a previous account's language into another account or sign-out.
      setCurrentLanguage(getAccountLanguage(user?.user_metadata))
      setReady(true)
    }

    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      authChanged = true
      applyUser(session?.user ?? null)
    })

    void supabase.auth.getSession().then(({ data, error }) => {
      if (!authChanged) applyUser(error ? null : data.session?.user ?? null)
    }).catch(() => {
      if (!authChanged) applyUser(null)
    })

    return () => {
      active = false
      subscription.unsubscribe()
    }
  }, [])

  useEffect(() => {
    document.documentElement.lang = language
    document.title = translate(language, 'Notes — Ruang tenang untuk semua idemu')
  }, [language])

  const setLanguage = useCallback(async (nextLanguage: Language) => {
    if (!isLanguage(nextLanguage)) throw new Error('Bahasa tidak didukung.')
    const userId = userRef.current?.id
    if (!supabaseConfigReady || !userId) {
      throw new Error('Masuk kembali untuk menyimpan pengaturan bahasa.')
    }

    // Supabase merges user metadata, preserving the account's name/avatar fields.
    const { data, error } = await supabase.auth.updateUser({ data: { language: nextLanguage } })
    if (error) throw error
    if (!data.user || data.user.id !== userId || userRef.current?.id !== userId) {
      throw new Error('Masuk kembali untuk menyimpan pengaturan bahasa.')
    }
    userRef.current = data.user
    setCurrentLanguage(getAccountLanguage(data.user.user_metadata))
  }, [])

  const t = useCallback((source: string, values?: TranslationValues) =>
    translate(language, source, values), [language])

  const value = useMemo(() => ({
    language,
    locale: languageLocales[language],
    ready,
    t,
    setLanguage,
  }), [language, ready, t, setLanguage])

  return <LanguageContext.Provider value={value}>{children}</LanguageContext.Provider>
}

export function useLanguage() {
  const context = useContext(LanguageContext)
  if (!context) throw new Error('useLanguage must be used within LanguageProvider')
  return context
}

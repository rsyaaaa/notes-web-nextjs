'use client'

import { useEffect, useRef, useState } from 'react'
import { HiOutlineCheck, HiOutlineTranslate, HiOutlineX } from 'react-icons/hi'
import { useLanguage } from '@/components/LanguageProvider'
import type { Language } from '@/lib/i18n'

interface ApplicationSettingsProps {
  isDark: boolean
  isClosing?: boolean
  onClose: () => void
}

export default function ApplicationSettings({ isDark, isClosing = false, onClose }: ApplicationSettingsProps) {
  const { language, ready, setLanguage, t } = useLanguage()
  const [draft, setDraft] = useState<Language | null>(null)
  const [isSaving, setIsSaving] = useState(false)
  const [status, setStatus] = useState<'saved' | 'error' | null>(null)
  const dialogRef = useRef<HTMLElement>(null)
  const closeRef = useRef<HTMLButtonElement>(null)
  const previousFocusRef = useRef<HTMLElement | null>(null)
  const selectedLanguage = draft ?? language

  useEffect(() => {
    previousFocusRef.current = document.activeElement instanceof HTMLElement ? document.activeElement : null
    closeRef.current?.focus()
    return () => {
      const previousFocus = previousFocusRef.current
      previousFocusRef.current = null
      if (previousFocus?.isConnected) previousFocus.focus({ preventScroll: true })
    }
  }, [])

  useEffect(() => {
    if (!isClosing) return
    // Restore focus before the inert exit, not after the delayed unmount.
    const previousFocus = previousFocusRef.current
    previousFocusRef.current = null
    if (previousFocus?.isConnected) previousFocus.focus({ preventScroll: true })
  }, [isClosing])

  const handleSave = async (event: React.FormEvent) => {
    event.preventDefault()
    if (isSaving || isClosing || !ready || selectedLanguage === language) return
    setIsSaving(true)
    setStatus(null)
    try {
      await setLanguage(selectedLanguage)
      setDraft(null)
      setStatus('saved')
    } catch {
      setStatus('error')
    } finally {
      setIsSaving(false)
    }
  }

  return (
    <div
      data-motion-state={isClosing ? 'closing' : 'open'}
      inert={isClosing}
      aria-hidden={isClosing || undefined}
      className="fixed inset-0 z-[120] flex items-center justify-center bg-black/40 p-4 backdrop-blur-sm animate-modal-backdrop"
      onMouseDown={(event) => {
        if (event.target === event.currentTarget && !isSaving && !isClosing) onClose()
      }}
      onKeyDown={(event) => {
        if (event.key === 'Escape') {
          event.stopPropagation()
          if (!isSaving && !isClosing) onClose()
        }
        if (event.key !== 'Tab') return
        // A radio group has one Tab stop: its checked option, not every radio.
        const focusable = dialogRef.current?.querySelectorAll<HTMLElement>('button:not(:disabled), input[type="radio"]:checked:not(:disabled)')
        if (!focusable?.length) {
          event.preventDefault()
          dialogRef.current?.focus()
          return
        }
        const first = focusable[0]
        const last = focusable[focusable.length - 1]
        if (event.shiftKey && document.activeElement === first) {
          event.preventDefault()
          last.focus()
        } else if (!event.shiftKey && document.activeElement === last) {
          event.preventDefault()
          first.focus()
        }
      }}
    >
      <section
        ref={dialogRef}
        tabIndex={-1}
        role="dialog"
        aria-modal="true"
        aria-labelledby="application-settings-title"
        aria-describedby="application-settings-description"
        className={`max-h-[90dvh] w-full max-w-[480px] overflow-y-auto rounded-[20px] border p-5 font-sans shadow-xl animate-modal-enter sm:p-6 ${
          isDark ? 'border-[#454549] bg-[#252527] text-[#f5f5f7]' : 'border-[#e0e0e0] bg-white text-[#1d1d1f]'
        }`}
      >
        <header className="flex items-start justify-between gap-4">
          <div>
            <h2 id="application-settings-title" className="text-[21px] font-semibold tracking-[-0.3px]">{t('Pengaturan Aplikasi')}</h2>
            <p id="application-settings-description" className={`mt-2 text-[14px] leading-relaxed ${isDark ? 'text-[#b3b3b8]' : 'text-[#7a7a7a]'}`}>
              {t('Atur bahasa tampilan aplikasi untuk akunmu.')}
            </p>
          </div>
          <button
            ref={closeRef}
            type="button"
            aria-label={t('Tutup pengaturan aplikasi')}
            onClick={onClose}
            disabled={isSaving || isClosing}
            className={`flex h-11 w-11 shrink-0 items-center justify-center rounded-full active:scale-95 disabled:opacity-50 focus-visible:outline-2 focus-visible:outline-[#0071e3] ${isDark ? 'hover:bg-white/10' : 'hover:bg-black/5'}`}
          >
            <HiOutlineX aria-hidden="true" className="h-5 w-5" />
          </button>
        </header>

        <form onSubmit={handleSave} className="mt-6">
          <fieldset disabled={!ready || isSaving || isClosing}>
            <legend className="mb-3 flex items-center gap-2 text-[14px] font-semibold">
              <HiOutlineTranslate aria-hidden="true" className="h-5 w-5" />
              {t('Bahasa Aplikasi')}
            </legend>
            <div className="space-y-2">
              {([{ value: 'id', label: 'Bahasa Indonesia' }, { value: 'en', label: 'English' }] as const).map((option) => (
                <label
                  key={option.value}
                  className={`flex min-h-14 cursor-pointer items-center gap-3 rounded-xl border px-4 text-[14px] transition-colors ${
                    selectedLanguage === option.value
                      ? isDark ? 'border-[#2997ff] bg-[#2997ff]/10' : 'border-[#0066cc] bg-[#0066cc]/5'
                      : isDark ? 'border-[#454549] hover:bg-white/5' : 'border-[#e0e0e0] hover:bg-black/[0.02]'
                  }`}
                >
                  <input
                    type="radio"
                    name="application-language"
                    value={option.value}
                    checked={selectedLanguage === option.value}
                    onChange={() => { setDraft(option.value); setStatus(null) }}
                    className="h-4 w-4 accent-[#0071e3]"
                  />
                  <span lang={option.value}>{option.label}</span>
                  {selectedLanguage === option.value && <HiOutlineCheck aria-hidden="true" className={`ml-auto h-4 w-4 ${isDark ? 'text-[#2997ff]' : 'text-[#0066cc]'}`} />}
                </label>
              ))}
            </div>
          </fieldset>
          <p className={`mt-3 text-[12px] leading-relaxed ${isDark ? 'text-[#b3b3b8]' : 'text-[#7a7a7a]'}`}>
            {t('Pilihan bahasa tersimpan di akun dan digunakan saat kamu masuk di perangkat lain.')}
          </p>
          <div role="status" aria-live="polite" className="mt-3 min-h-5 text-[13px]">
            {!ready && t('Memuat preferensi akun...')}
            {status === 'saved' && t('Bahasa aplikasi berhasil disimpan.')}
            {status === 'error' && <span className={isDark ? 'text-[#ff6961]' : 'text-[#c62828]'}>{t('Bahasa gagal disimpan. Periksa koneksi lalu coba lagi.')}</span>}
          </div>
          <button
            type="submit"
            disabled={!ready || isSaving || isClosing || selectedLanguage === language}
            aria-busy={isSaving}
            className="mt-4 min-h-11 w-full rounded-full bg-[#0066cc] px-5 text-[14px] font-medium text-white transition-colors hover:bg-[#0071e3] active:scale-[0.98] disabled:cursor-not-allowed disabled:opacity-50 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#0071e3]"
          >
            {isSaving ? t('Menyimpan...') : t('Simpan Perubahan')}
          </button>
        </form>
      </section>
    </div>
  )
}

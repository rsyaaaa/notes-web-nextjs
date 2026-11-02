'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import { HiOutlineTrash } from 'react-icons/hi'
import { useLanguage } from '@/components/LanguageProvider'
import type { DeletedNoteNotice } from '@/lib/types'

interface DeletedNoteCardProps {
  notice: DeletedNoteNotice
  isDark: boolean
  onDismiss?: (notice: DeletedNoteNotice) => Promise<void> | void
}

export default function DeletedNoteCard({ notice, isDark, onDismiss }: DeletedNoteCardProps) {
  const { t } = useLanguage()
  const [isDismissing, setIsDismissing] = useState(false)
  const buttonRef = useRef<HTMLButtonElement>(null)

  const handleDismiss = useCallback(async () => {
    if (!onDismiss || isDismissing) return
    setIsDismissing(true)
    try {
      await onDismiss(notice)
    } finally {
      setIsDismissing(false)
    }
  }, [isDismissing, notice, onDismiss])

  useEffect(() => {
    const el = buttonRef.current
    if (!el || !onDismiss) return
    const listener = (event: MouseEvent) => {
      event.preventDefault()
      event.stopPropagation()
      void handleDismiss()
    }
    el.addEventListener('click', listener)
    return () => el.removeEventListener('click', listener)
  }, [handleDismiss, onDismiss])

  return (
    <article
      data-deleted-note-card={notice.note_id}
      className={`flex min-h-48 flex-col justify-center rounded-2xl border p-6 ${
        isDark
          ? 'border-white/10 bg-white/[0.035] text-zinc-400'
          : 'border-zinc-200 bg-zinc-100/80 text-zinc-500'
      }`}
    >
      <button
        ref={buttonRef}
        type="button"
        disabled={isDismissing || !onDismiss}
        aria-label={t('Hapus')}
        className={`mb-4 inline-flex h-10 w-10 items-center justify-center rounded-xl cursor-pointer transition-all active:scale-95 disabled:cursor-default ${
          isDark
            ? 'bg-white/5 hover:bg-white/15 disabled:hover:bg-white/5'
            : 'bg-zinc-200/60 hover:bg-zinc-300/80 disabled:hover:bg-zinc-200/60'
        } ${isDismissing ? 'opacity-50' : ''}`}
      >
        <HiOutlineTrash className="h-5 w-5" aria-hidden="true" />
      </button>
      <h3 className="text-base font-semibold">{t('Catatan dihapus')}</h3>
      <p className="mt-2 text-sm leading-relaxed">{t('Catatan ini sudah dihapus oleh pemilik.')}</p>
    </article>
  )
}

'use client'

import { HiOutlineTrash } from 'react-icons/hi'
import { useLanguage } from '@/components/LanguageProvider'
import type { DeletedNoteNotice } from '@/lib/types'

interface DeletedNoteCardProps {
  notice: DeletedNoteNotice
  isDark: boolean
}

export default function DeletedNoteCard({ notice, isDark }: DeletedNoteCardProps) {
  const { t } = useLanguage()

  return (
    <article
      data-deleted-note-card={notice.note_id}
      className={`flex min-h-48 flex-col justify-center rounded-2xl border p-6 ${
        isDark
          ? 'border-white/10 bg-white/[0.035] text-zinc-400'
          : 'border-zinc-200 bg-zinc-100/80 text-zinc-500'
      }`}
    >
      <span className={`mb-4 inline-flex h-10 w-10 items-center justify-center rounded-xl ${isDark ? 'bg-white/5' : 'bg-zinc-200/60'}`}>
        <HiOutlineTrash className="h-5 w-5" aria-hidden="true" />
      </span>
      <h3 className="text-base font-semibold">{t('Catatan dihapus')}</h3>
      <p className="mt-2 text-sm leading-relaxed">{t('Catatan ini sudah dihapus oleh pemilik.')}</p>
    </article>
  )
}

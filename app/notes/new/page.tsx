'use client'

import NoteDetailPage from '@/app/notes/[id]/page'

export default function NewNotePage() {
  return <NoteDetailPage isNewOverride={true} />
}


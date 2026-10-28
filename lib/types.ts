export interface Note {
  id: number
  user_id: string
  title: string
  content: string
  accent_color: string
  folder_id: number | null
  is_pinned: boolean
  is_trashed: boolean
  created_at: string
  updated_at: string
}

export interface NoteDraft {
  title: string
  content: string
  accentColor: string
  folderId: string
}

export interface UserProfile {
  full_name: string
  avatar_url: string | null
  plan: 'free' | 'premium'
  premium_expires_at: string | null
}

export interface NotePerson {
  user_id: string
  full_name: string
  avatar_url: string | null
}

export interface NoteFolder {
  id: number
  name: string
}

export interface DeletedNoteNotice {
  id: string
  note_id: number
  user_id: string
  deleted_at: string
}

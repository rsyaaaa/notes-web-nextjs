'use client'

import { Suspense, useCallback, useEffect, useRef, useState } from 'react'
import { useParams, usePathname, useRouter, useSearchParams } from 'next/navigation'
import type { User } from '@supabase/supabase-js'
import Image from 'next/image'
import { FaApple } from 'react-icons/fa'
import { HiStar, HiOutlineExclamation, HiOutlineChevronLeft, HiOutlineChevronDown, HiOutlineFolder, HiOutlineMail, HiOutlineUsers, HiOutlineTrash, HiOutlineCheck } from 'react-icons/hi'
import { BsPin, BsPinFill } from 'react-icons/bs'
import { ImSpinner2 } from 'react-icons/im'
import { supabase, supabaseConfigReady } from '@/lib/supabaseClient'
import type { Note, NoteDraft, NoteFolder, NotePerson, UserProfile } from '@/lib/types'
import AppleNoteLoader from '@/components/AppleNoteLoader'
import PageTransition from '@/components/PageTransition'
import { useAnimatedPresence } from '@/lib/useAnimatedPresence'
import { useLanguage } from '@/components/LanguageProvider'
import { getNewNoteFolderId } from '@/lib/new-note-folder'

interface ColorOption {
  label: string
  hex: string
  lightSurface: string
  darkSurface: string
  lightBorder: string
  darkBorder: string
}

const COLOR_OPTIONS: ColorOption[] = [
  { label: 'Putih', hex: '#ffffff', lightSurface: '#ffffff', darkSurface: '#1d1d1f', lightBorder: '#e0e0e0', darkBorder: '#3a3a3e' },
  { label: 'Perkamen', hex: '#f5f5f7', lightSurface: '#f5f5f7', darkSurface: '#252527', lightBorder: '#e0e0e0', darkBorder: '#3a3a3e' },
  { label: 'Kuning', hex: '#fef3c7', lightSurface: '#fefce8', darkSurface: '#2c2514', lightBorder: '#fde68a', darkBorder: '#4a3d1b' },
  { label: 'Amber Lembut', hex: '#fff8e6', lightSurface: '#fffbf0', darkSurface: '#2d2616', lightBorder: '#fde68a', darkBorder: '#4d3f1a' },
  { label: 'Mint', hex: '#dcfce7', lightSurface: '#f0fdf4', darkSurface: '#162b21', lightBorder: '#bbf7d0', darkBorder: '#234937' },
  { label: 'Mint Lembut', hex: '#eafaf1', lightSurface: '#f4fbf7', darkSurface: '#162b21', lightBorder: '#bbf7d0', darkBorder: '#234937' },
  { label: 'Biru Langit', hex: '#e0f2fe', lightSurface: '#f0f9ff', darkSurface: '#162836', lightBorder: '#bae6fd', darkBorder: '#23435c' },
  { label: 'Biru Lembut', hex: '#e8f2ff', lightSurface: '#f2f7ff', darkSurface: '#162838', lightBorder: '#bae6fd', darkBorder: '#23435c' },
  { label: 'Merah Muda', hex: '#ffe4e6', lightSurface: '#fff1f2', darkSurface: '#2e1a22', lightBorder: '#fecdd3', darkBorder: '#4d2735' },
  { label: 'Lavender', hex: '#f2edff', lightSurface: '#faf7ff', darkSurface: '#272238', lightBorder: '#ddd6fe', darkBorder: '#433868' },
  { label: 'Persik', hex: '#fff0e6', lightSurface: '#fff6f0', darkSurface: '#332219', lightBorder: '#fed7aa', darkBorder: '#573928' },
  { label: 'Hijau Kebiruan', hex: '#e6f7f7', lightSurface: '#f2fbfb', darkSurface: '#172c2f', lightBorder: '#bbf0f0', darkBorder: '#26474b' },
  { label: 'Hijau Sage', hex: '#edf4e8', lightSurface: '#f6faf3', darkSurface: '#222c1d', lightBorder: '#cce3be', darkBorder: '#36482e' },
  { label: 'Perak', hex: '#eceff1', lightSurface: '#f4f6f7', darkSurface: '#242a2e', lightBorder: '#cfd8dc', darkBorder: '#3b454b' },
]

const PALETTE_SWATCHES = [
  { label: 'Putih', hex: '#ffffff' },
  { label: 'Perkamen', hex: '#f5f5f7' },
  { label: 'Kuning', hex: '#fef3c7' },
  { label: 'Mint', hex: '#dcfce7' },
  { label: 'Biru Langit', hex: '#e0f2fe' },
  { label: 'Merah Muda', hex: '#ffe4e6' },
  { label: 'Lavender', hex: '#f2edff' },
  { label: 'Persik', hex: '#fff0e6' },
]

const getSurfaceColor = (hex: string, isDark: boolean) => {
  const normalized = (hex || '#ffffff').toLowerCase()
  const matched = COLOR_OPTIONS.find((c) => c.hex.toLowerCase() === normalized)
  if (matched) {
    return isDark ? matched.darkSurface : matched.lightSurface
  }
  return isDark ? '#1d1d1f' : hex
}



function NoteDetailContent({ isNewOverride = false }: { isNewOverride?: boolean }) {
  const { locale, t } = useLanguage()
  const params = useParams<{ id: string }>()
  const pathname = usePathname()
  const searchParams = useSearchParams()
  const router = useRouter()
  const noteIdRaw = params?.id
  const isNew = Boolean(
    isNewOverride ||
    noteIdRaw === 'new' ||
    pathname === '/notes/new' ||
    pathname?.endsWith('/notes/new')
  )
  const noteId = isNew ? null : (noteIdRaw ? Number(noteIdRaw) : null)
  const requestedFolder = isNew ? searchParams.get('folder') : null

  const isNavigatingAwayRef = useRef(false)

  const [user, setUser] = useState<User | null>(null)
  const [profile, setProfile] = useState<UserProfile | null>(null)
  const [loading, setLoading] = useState(true)
  const [errorMsg, setErrorMsg] = useState<{ source: string; raw?: boolean } | null>(null)

  // Theme state
  const [isDarkMode, setIsDarkMode] = useState(false)

  // Note fields
  const [title, setTitle] = useState('')
  const [content, setContent] = useState('')
  const [accentColor, setAccentColor] = useState('#ffffff')
  const [folderId, setFolderId] = useState<string>('')
  const [isPinned, setIsPinned] = useState(false)
  const [isTrashed, setIsTrashed] = useState(false)
  const [updatedAt, setUpdatedAt] = useState<string>('')
  const [createdAt, setCreatedAt] = useState<string>('')
  const [noteOwnerId, setNoteOwnerId] = useState<string>('')

  // Related data
  const [folders, setFolders] = useState<NoteFolder[]>([])
  const [noteMembers, setNoteMembers] = useState<NotePerson[]>([])
  const [ownerPerson, setOwnerPerson] = useState<NotePerson | null>(null)
  const [inviteEmail, setInviteEmail] = useState('')
  const [inviteLoading, setInviteLoading] = useState(false)
  const [inviteMsg, setInviteMsg] = useState<{ source: string; values?: Record<string, string | number>; raw?: boolean; isError?: boolean } | null>(null)
  const [showShareModal, setShowShareModal] = useState(false)
  const [showColorPicker, setShowColorPicker] = useState(false)
  const [showFolderPicker, setShowFolderPicker] = useState(false)
  const sharePresence = useAnimatedPresence(showShareModal)
  const colorPickerPresence = useAnimatedPresence(showColorPicker)
  const folderPickerPresence = useAnimatedPresence(showFolderPicker)

  // Auto-save state
  const [saveStatus, setSaveStatus] = useState<'idle' | 'saving' | 'saved' | 'error'>('idle')
  const [isSubmitting, setIsSubmitting] = useState(false)
  const lastSavedRef = useRef<NoteDraft>({ title: '', content: '', accentColor: '#ffffff', folderId: '' })
  const autoSaveTimerRef = useRef<NodeJS.Timeout | null>(null)
  const contentTextareaRef = useRef<HTMLTextAreaElement>(null)

  const isPremium = profile?.plan === 'premium'
  const isOwner = user && noteOwnerId ? user.id === noteOwnerId : true

  // Initialize theme from localStorage and system preference
  useEffect(() => {
    const storedTheme = window.localStorage.getItem('notes-theme')
    const prefersDark = window.matchMedia?.('(prefers-color-scheme: dark)').matches
    const shouldUseDark = storedTheme === 'dark' || (!storedTheme && prefersDark)
    const frame = window.requestAnimationFrame(() => {
      setIsDarkMode(shouldUseDark)
    })
    document.documentElement.dataset.theme = shouldUseDark ? 'dark' : 'light'

    const handleStorage = (e: StorageEvent) => {
      if (e.key === 'notes-theme') {
        const nextDark = e.newValue === 'dark'
        setIsDarkMode(nextDark)
        document.documentElement.dataset.theme = nextDark ? 'dark' : 'light'
      }
    }
    window.addEventListener('storage', handleStorage)
    return () => {
      window.cancelAnimationFrame(frame)
      window.removeEventListener('storage', handleStorage)
    }
  }, [])

  const collaboratorList = noteMembers.filter((m) => m.user_id !== noteOwnerId)

  // Fetch collaborators separately to avoid invalid foreign key join in PostgREST
  const fetchCollaborators = useCallback(async (targetNoteId: number) => {
    try {
      const { data: memberRows, error: memberError } = await supabase
        .from('note_members')
        .select('user_id, invited_by')
        .eq('note_id', targetNoteId)

      if (memberError) {
        console.error('Error fetching note members:', memberError.message)
        setNoteMembers([])
        return
      }

      if (!memberRows || memberRows.length === 0) {
        setNoteMembers([])
        return
      }

      const userIds = [...new Set(memberRows.map((r) => r.user_id))]
      const { data: profileRows, error: profileError } = await supabase
        .from('profiles')
        .select('id, full_name, avatar_url')
        .in('id', userIds)

      if (profileError) {
        console.error('Error fetching member profiles:', profileError.message)
      }

      const profileMap = new Map((profileRows || []).map((p) => [p.id, p]))
      const mapped: NotePerson[] = memberRows.map((r) => {
        const p = profileMap.get(r.user_id)
        return {
          user_id: r.user_id,
          full_name: p?.full_name || '',
          avatar_url: p?.avatar_url || null,
        }
      })

      setNoteMembers(mapped)
    } catch (err) {
      console.error('Failed to fetch collaborators:', err)
      setNoteMembers([])
    }
  }, [])

  // Auto-grow textarea height
  useEffect(() => {
    if (contentTextareaRef.current) {
      contentTextareaRef.current.style.height = 'auto'
      contentTextareaRef.current.style.height = `${Math.max(260, contentTextareaRef.current.scrollHeight)}px`
    }
  }, [content])

  // Initialize and fetch note & user data
  useEffect(() => {
    let isMounted = true

    const init = async () => {
      if (!supabaseConfigReady) {
        setErrorMsg({ source: 'Konfigurasi Supabase belum siap.' })
        setLoading(false)
        return
      }

      const { data: { user: authUser } } = await supabase.auth.getUser()
      if (!authUser) {
        router.push('/')
        return
      }

      if (!isMounted) return
      setUser(authUser)

      // Fetch profile
      const { data: profileData } = await supabase
        .from('profiles')
        .select('*')
        .eq('id', authUser.id)
        .maybeSingle()
      if (isMounted && profileData) {
        setProfile(profileData as UserProfile)
      }

      // Fetch folders
      const { data: folderList } = await supabase
        .from('note_folders')
        .select('id, name')
        .eq('user_id', authUser.id)
        .order('name')
      if (isMounted && folderList) {
        setFolders(folderList as NoteFolder[])
      }

      if (isNew) {
        if (!isMounted) return
        setNoteOwnerId(authUser.id)
        setOwnerPerson({
          user_id: authUser.id,
          full_name: profileData?.full_name || authUser.user_metadata?.full_name || '',
          avatar_url: profileData?.avatar_url || authUser.user_metadata?.avatar_url || null,
        })
        setTitle('')
        setContent('')
        setAccentColor('#ffffff')
        const initialFolderId = getNewNoteFolderId(requestedFolder, folderList ?? [])
        setFolderId(initialFolderId)
        setIsPinned(false)
        setIsTrashed(false)
        lastSavedRef.current = { title: '', content: '', accentColor: '#ffffff', folderId: initialFolderId }
        setLoading(false)
        return
      }

      if (!noteId || Number.isNaN(noteId)) {
        if (isMounted) {
          setErrorMsg({ source: 'Catatan tidak valid.' })
          setLoading(false)
        }
        return
      }

      // Fetch the specific note
      const { data: noteData, error: noteError } = await supabase
        .from('notes')
        .select('*')
        .eq('id', noteId)
        .maybeSingle()

      if (!isMounted) return

      if (noteError || !noteData) {
        setErrorMsg(noteError?.message ? { source: noteError.message, raw: true } : { source: 'Catatan tidak ditemukan atau Anda tidak memiliki akses.' })
        setLoading(false)
        return
      }

      const fetchedNote = noteData as Note
      setNoteOwnerId(fetchedNote.user_id)
      setTitle(fetchedNote.title || '')
      setContent(fetchedNote.content || '')
      setAccentColor(fetchedNote.accent_color || '#ffffff')
      setFolderId(fetchedNote.folder_id ? String(fetchedNote.folder_id) : '')
      setIsPinned(Boolean(fetchedNote.is_pinned))
      setIsTrashed(Boolean(fetchedNote.is_trashed))
      setCreatedAt(fetchedNote.created_at)
      setUpdatedAt(fetchedNote.updated_at)

      lastSavedRef.current = {
        title: fetchedNote.title || '',
        content: fetchedNote.content || '',
        accentColor: fetchedNote.accent_color || '#ffffff',
        folderId: fetchedNote.folder_id ? String(fetchedNote.folder_id) : '',
      }

      // Fetch note owner profile
      if (fetchedNote.user_id === authUser.id) {
        setOwnerPerson({
          user_id: authUser.id,
          full_name: profileData?.full_name || authUser.user_metadata?.full_name || '',
          avatar_url: profileData?.avatar_url || authUser.user_metadata?.avatar_url || null,
        })
      } else {
        const { data: ownerData } = await supabase
          .from('profiles')
          .select('id, full_name, avatar_url')
          .eq('id', fetchedNote.user_id)
          .maybeSingle()
        if (isMounted && ownerData) {
          setOwnerPerson({
            user_id: ownerData.id,
            full_name: ownerData.full_name || '',
            avatar_url: ownerData.avatar_url || null,
          })
        }
      }

      // Fetch note collaborators
      await fetchCollaborators(noteId)

      setLoading(false)
    }

    init()

    return () => {
      isMounted = false
    }
  }, [fetchCollaborators, isNew, noteId, requestedFolder, router])

  // Realtime subscription for updates
  useEffect(() => {
    if (!noteId || isNew) return

    const channel = supabase
      .channel(`note-detail:${noteId}`)
      .on(
        'postgres_changes',
        { event: 'UPDATE', schema: 'public', table: 'notes', filter: `id=eq.${noteId}` },
        (payload) => {
          const updated = payload.new as Note
          if (updated) {
            setIsPinned(Boolean(updated.is_pinned))
            setIsTrashed(Boolean(updated.is_trashed))
            setUpdatedAt(updated.updated_at)
            if (updated.title !== title && document.activeElement?.id !== 'note-title-input') {
              setTitle(updated.title || '')
            }
            if (updated.content !== content && document.activeElement?.id !== 'note-content-input') {
              setContent(updated.content || '')
            }
          }
        }
      )
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'note_members', filter: `note_id=eq.${noteId}` },
        () => {
          fetchCollaborators(noteId)
        }
      )
      .subscribe()

    return () => {
      supabase.removeChannel(channel)
    }
  }, [content, fetchCollaborators, isNew, noteId, title])

  // Save changes to Supabase
  const saveNote = useCallback(
    async (forceValues?: Partial<NoteDraft & { is_pinned?: boolean; is_trashed?: boolean }>): Promise<boolean> => {
      let currentUser = user
      if (!currentUser) {
        const { data: sessionData } = await supabase.auth.getSession()
        currentUser = sessionData?.session?.user ?? null
        if (!currentUser) {
          const { data: authData } = await supabase.auth.getUser()
          currentUser = authData?.user ?? null
        }
      }

      if (!currentUser) {
        console.error('Save failed: User is not authenticated')
        setSaveStatus('error')
        return false
      }

      const draftToSave: NoteDraft = {
        title: forceValues?.title !== undefined ? forceValues.title : title,
        content: forceValues?.content !== undefined ? forceValues.content : content,
        accentColor: forceValues?.accentColor !== undefined ? forceValues.accentColor : accentColor,
        folderId: forceValues?.folderId !== undefined ? forceValues.folderId : folderId,
      }

      const trimmedTitle = draftToSave.title.trim()
      const trimmedContent = draftToSave.content.trim()

      if (isNew && !trimmedTitle && !trimmedContent) {
        return true
      }

      setSaveStatus('saving')

      // Ensure title has a friendly fallback if user only filled in body content
      const finalTitle = trimmedTitle || (trimmedContent ? trimmedContent.slice(0, 40) : 'Tanpa Judul')

      const payload: Record<string, unknown> = {
        title: finalTitle,
        content: draftToSave.content,
        accent_color: draftToSave.accentColor || '#ffffff',
        folder_id: draftToSave.folderId ? Number(draftToSave.folderId) : null,
        updated_at: new Date().toISOString(),
      }

      if (forceValues?.is_pinned !== undefined) {
        payload.is_pinned = forceValues.is_pinned
      }
      if (forceValues?.is_trashed !== undefined) {
        payload.is_trashed = forceValues.is_trashed
      }

      try {
        if (isNew) {
          payload.user_id = currentUser.id
          payload.is_pinned = false
          payload.is_trashed = false

          // Direct insert without .select().single() to avoid RLS RETURNING evaluation constraints
          const { error } = await supabase
            .from('notes')
            .insert(payload)

          if (error) {
            console.error('Failed to create note:', error.message)
            setSaveStatus('error')
            return false
          }

          setSaveStatus('saved')
          lastSavedRef.current = draftToSave

          if (!isNavigatingAwayRef.current) {
            // If user stays on the page, query latest note ID to replace URL
            const { data: latest } = await supabase
              .from('notes')
              .select('id')
              .eq('user_id', currentUser.id)
              .order('id', { ascending: false })
              .limit(1)
              .maybeSingle()

            if (latest?.id) {
              router.replace(`/notes/${latest.id}`)
            }
          }
          return true
        } else if (noteId) {
          const { error } = await supabase
            .from('notes')
            .update(payload)
            .eq('id', noteId)

          if (error) {
            console.error('Failed to update note:', error.message)
            setSaveStatus('error')
            return false
          }

          setSaveStatus('saved')
          setUpdatedAt(payload.updated_at as string)
          lastSavedRef.current = draftToSave
          return true
        }
        return false
      } catch (err: unknown) {
        console.error('Save error:', err)
        setSaveStatus('error')
        return false
      }
    },
    [accentColor, content, folderId, isNew, noteId, router, title, user]
  )

  // Auto-save debounced effect on text change
  useEffect(() => {
    if (loading || isNew) return

    const hasChanged =
      title !== lastSavedRef.current.title ||
      content !== lastSavedRef.current.content ||
      accentColor !== lastSavedRef.current.accentColor ||
      folderId !== lastSavedRef.current.folderId

    if (!hasChanged) return

    if (autoSaveTimerRef.current) {
      clearTimeout(autoSaveTimerRef.current)
    }

    autoSaveTimerRef.current = setTimeout(() => {
      saveNote()
    }, 800)

    return () => {
      if (autoSaveTimerRef.current) {
        clearTimeout(autoSaveTimerRef.current)
      }
    }
  }, [accentColor, content, folderId, isNew, loading, saveNote, title])

  // Toggle Pin Status
  const handleTogglePin = async () => {
    const nextPinned = !isPinned
    setIsPinned(nextPinned)
    await saveNote({ is_pinned: nextPinned })
  }

  // Toggle Trash Status
  const handleToggleTrash = async () => {
    const nextTrashed = !isTrashed
    setIsTrashed(nextTrashed)
    await saveNote({ is_trashed: nextTrashed })
    if (nextTrashed) {
      router.push('/')
    }
  }

  // Delete permanently
  const handleDeletePermanently = async () => {
    if (!noteId) return
    const confirmed = window.confirm(t('Hapus catatan ini secara permanen?'))
    if (!confirmed) return

    const { error } = await supabase.from('notes').delete().eq('id', noteId)
    if (error) {
      alert(t('Gagal menghapus: {error}', { error: error.message }))
      return
    }
    router.push('/')
  }

  // Invite collaborator
  const handleInviteCollaborator = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!noteId || !inviteEmail.trim() || !user) return

    setInviteLoading(true)
    setInviteMsg(null)

    try {
      const { error } = await supabase.rpc('invite_note_collaborator', {
        target_note_id: noteId,
        collaborator_email: inviteEmail.trim(),
      })

      if (error) {
        setInviteMsg({ source: 'Gagal: {error}', values: { error: error.message }, isError: true })
      } else {
        setInviteMsg({ source: 'Undangan berhasil dikirim!' })
        setInviteEmail('')
        await fetchCollaborators(noteId)
      }
    } catch (err: unknown) {
      setInviteMsg(err instanceof Error ? { source: err.message, raw: true, isError: true } : { source: 'Terjadi kesalahan', isError: true })
    } finally {
      setInviteLoading(false)
    }
  }

  // Remove collaborator
  const handleRemoveCollaborator = async (targetUserId: string) => {
    if (!noteId || !isOwner) return
    const confirmed = window.confirm(t('Hapus kolaborator ini dari catatan?'))
    if (!confirmed) return

    try {
      const { error } = await supabase
        .from('note_members')
        .delete()
        .eq('note_id', noteId)
        .eq('user_id', targetUserId)

      if (error) {
        setInviteMsg({ source: 'Gagal: {error}', values: { error: error.message }, isError: true })
      } else {
        await fetchCollaborators(noteId)
        setInviteMsg({ source: 'Kolaborator berhasil dihapus.' })
      }
    } catch (err: unknown) {
      setInviteMsg(err instanceof Error ? { source: err.message, raw: true, isError: true } : { source: 'Terjadi kesalahan', isError: true })
    }
  }



  useEffect(() => {
    if (!sharePresence.isPresent) return
    const previousOverflow = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    return () => {
      document.body.style.overflow = previousOverflow
    }
  }, [sharePresence.isPresent])

  // Close share modal on Escape key
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && showShareModal) {
        setShowShareModal(false)
      }
    }
    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [showShareModal])

  const handleBackToDashboard = async () => {
    if (isSubmitting) return
    setIsSubmitting(true)

    isNavigatingAwayRef.current = true
    if (autoSaveTimerRef.current) {
      clearTimeout(autoSaveTimerRef.current)
    }

    const hasContent = Boolean(title.trim() || content.trim())
    const hasUnsaved =
      hasContent &&
      (isNew ||
        title !== lastSavedRef.current.title ||
        content !== lastSavedRef.current.content ||
        accentColor !== lastSavedRef.current.accentColor ||
        folderId !== lastSavedRef.current.folderId)

    if (hasUnsaved) {
      const saved = await saveNote()
      if (!saved) {
        setIsSubmitting(false)
        isNavigatingAwayRef.current = false
        alert(t('Gagal menyimpan catatan baru. Silakan periksa koneksi dan coba lagi.'))
        return
      }
    }

    if (typeof window !== 'undefined') {
      window.dispatchEvent(new CustomEvent('notes-refresh'))
    }
    router.push('/')
    router.refresh()
  }

  const formatDate = (dateStr?: string) => {
    if (!dateStr) return t('Baru saja')
    try {
      const d = new Date(dateStr)
      return d.toLocaleDateString(locale, {
        day: 'numeric',
        month: 'short',
        year: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
      })
    } catch {
      return dateStr
    }
  }

  // Cute, tasteful Apple Note loading state
  if (loading) {
    return (
      <AppleNoteLoader
        isDark={isDarkMode}
        title={isNew ? t('Membuat Catatan...') : t('Membuka Catatan...')}
        subtitle={t("Menyiapkan ruang tenang untuk idemu")}
      />
    )
  }

  if (errorMsg) {
    return (
      <main
        className={`flex min-h-screen flex-col items-center justify-center px-4 font-sans text-center transition-colors ${
          isDarkMode ? 'bg-[#1d1d1f] text-[#f5f5f7]' : 'bg-[#f5f5f7] text-[#1d1d1f]'
        }`}
      >
        <div
          className={`w-full max-w-[420px] rounded-[18px] border p-6 sm:p-8 ${
            isDarkMode ? 'border-[#3a3a3e] bg-[#252527]' : 'border-[#e0e0e0] bg-white'
          }`}
        >
          <HiOutlineExclamation aria-hidden="true" className="inline-block text-3xl" />
          <h1 className="mt-3 text-[21px] font-semibold tracking-[-0.28px]">{t("Catatan Tidak Tersedia")}</h1>
          <p
            className={`mt-2 text-[17px] leading-[1.47] tracking-[-0.374px] ${
              isDarkMode ? 'text-[#b3b3b8]' : 'text-[#7a7a7a]'
            }`}
          >
            {errorMsg.raw ? errorMsg.source : t(errorMsg.source)}
          </p>
          <button
            type="button"
            onClick={() => router.push('/')}
            className={`mt-6 inline-flex min-h-11 items-center justify-center rounded-full px-6 text-[17px] font-normal text-white transition-transform active:scale-95 focus-visible:outline-2 focus-visible:outline-[#0071e3] ${
              isDarkMode ? 'bg-[#2997ff]' : 'bg-[#0066cc]'
            }`}
          >
            <HiOutlineChevronLeft aria-hidden="true" className="mr-1 h-5 w-5" /> {t("Kembali ke Catatan")}
          </button>
        </div>
      </main>
    )
  }

  return (
    <div
      style={{
        backgroundColor: getSurfaceColor(accentColor, isDarkMode),
        color: isDarkMode ? '#f5f5f7' : '#1d1d1f',
      }}
      className={`flex min-h-screen flex-col font-sans transition-colors duration-200 selection:bg-[#0066cc] selection:text-white ${
        isDarkMode ? 'theme-dark' : ''
      }`}
    >
      {/* 1. Global Nav (Pure Black - Desktop Only, completely hidden on mobile per request) */}
      <header className="hidden md:flex sticky top-0 z-50 h-[44px] items-center justify-between border-b border-black/10 bg-[#000000] px-6 md:px-12 text-[12px] tracking-[-0.12px] text-white">
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={handleBackToDashboard}
            aria-label={t("Kembali ke beranda")}
            className="flex items-center gap-1.5 text-white hover:text-white/80 active:scale-95 transition-transform"
          >
            <FaApple aria-hidden="true" className="text-base" />
            <span className="font-semibold tracking-normal">{t("Notes")}</span>
          </button>
        </div>

        <div className="flex items-center gap-3">
          <span className="text-[12px] text-[#cccccc]">
            {isPremium ? <><HiStar aria-hidden="true" className="mr-1 inline-block align-middle" />{t("Premium")}</> : t('Free Plan')}
          </span>
        </div>
      </header>

      {/* 2. Top Nav Bar (Clean, single-tier navigation on mobile & desktop) */}
      <nav
        className={`sticky top-0 md:top-[44px] z-40 flex h-[50px] items-center justify-between border-b px-3 sm:px-6 md:px-12 backdrop-blur-md transition-colors ${
          isDarkMode
            ? 'border-[#3a3a3e]/80 bg-[#1d1d1f]/85'
            : 'border-[#e0e0e0]/80 bg-[#f5f5f7]/85'
        }`}
      >
        {/* Left: Apple Back Button */}
        <button
          type="button"
          onClick={handleBackToDashboard}
          disabled={isSubmitting}
          className={`group flex min-h-[44px] items-center gap-1 text-[17px] font-normal tracking-[-0.374px] transition-transform active:scale-95 focus-visible:outline-2 focus-visible:outline-[#0071e3] ${
            isSubmitting ? 'opacity-60 pointer-events-none' : ''
          } ${
            isDarkMode ? 'text-[#2997ff]' : 'text-[#0066cc]'
          }`}
        >
          <HiOutlineChevronLeft aria-hidden="true" className="h-5 w-5 transition-transform group-hover:-translate-x-0.5" />
          <span className="hidden sm:inline">{t("Catatan Saya")}</span>
          <span className="sm:hidden">{t("Catatan")}</span>
        </button>

        {/* Center: Save Status indicator badge */}
        <div
          className={`flex items-center gap-1.5 px-3 py-1 rounded-full text-[12px] tracking-[-0.12px] transition-all ${
            isDarkMode ? 'text-[#b3b3b8] bg-white/[0.05]' : 'text-[#7a7a7a] bg-black/[0.04]'
          }`}
        >
          {saveStatus === 'saving' && (
            <span className={`flex items-center gap-1.5 ${isDarkMode ? 'text-[#2997ff]' : 'text-[#0066cc]'}`}>
              <ImSpinner2 aria-hidden="true" className="h-3.5 w-3.5 animate-spin" />
              <span>{t("Menyimpan...")}</span>
            </span>
          )}
          {saveStatus === 'saved' && (
            <span className="flex items-center gap-1.5">
              <span className="h-1.5 w-1.5 rounded-full bg-[#34c759]" />
              <span>{t("Tersimpan")}</span>
            </span>
          )}
          {saveStatus === 'error' && (
            <span className="flex items-center gap-1 text-[#ff453a]">
              <HiOutlineExclamation aria-hidden="true" className="h-3.5 w-3.5" />
              <span>{t("Gagal simpan")}</span>
            </span>
          )}
          {saveStatus === 'idle' && (
            <span>{updatedAt ? t('Diedit {date}', { date: formatDate(updatedAt) }) : t('Catatan Baru')}</span>
          )}
        </div>

        {/* Right: Actions Container */}
        <div className="flex items-center gap-2">
          {/* Desktop Tools Container (Visible on md+ screen widths) */}
          <div className="hidden md:flex items-center gap-2">
            {/* Pin Button */}
            {isOwner && !isNew && (
              <button
                type="button"
                onClick={handleTogglePin}
                aria-label={isPinned ? t('Lepas Pin') : t('Pin Catatan')}
                title={isPinned ? t('Lepas Pin') : t('Pin Catatan')}
                className={`flex h-[38px] items-center gap-1.5 rounded-full px-3 text-[14px] transition-transform active:scale-95 focus-visible:outline-2 focus-visible:outline-[#0071e3] ${
                  isPinned
                    ? isDarkMode
                      ? 'bg-[#2997ff] text-white border-transparent'
                      : 'bg-[#0066cc] text-white border-transparent'
                    : isDarkMode
                    ? 'border border-[#3a3a3e] bg-[#252527] text-[#f5f5f7]'
                    : 'border border-[#e0e0e0] bg-white text-[#1d1d1f]'
                }`}
              >
                {isPinned ? <BsPinFill aria-hidden="true" /> : <BsPin aria-hidden="true" />}
                <span className="text-[12px] font-normal">{isPinned ? t('Dipin') : t('Sematkan')}</span>
              </button>
            )}

            {/* Palette button */}
            <div className="relative">
              <button
                type="button"
                aria-label={t("Pilih warna catatan")}
                title={t("Warna Catatan")}
                onClick={() => {
                  setShowColorPicker(!showColorPicker)
                  setShowFolderPicker(false)
                  setShowShareModal(false)
                }}
                className={`flex h-[38px] w-[38px] items-center justify-center rounded-full border text-[14px] transition-transform active:scale-95 focus-visible:outline-2 focus-visible:outline-[#0071e3] ${
                  isDarkMode ? 'border-[#3a3a3e] bg-[#252527]' : 'border-[#e0e0e0] bg-white'
                }`}
              >
                <span
                  className="h-4 w-4 rounded-full border border-black/15 shadow-sm"
                  style={{ backgroundColor: accentColor }}
                />
              </button>

              {colorPickerPresence.isPresent && (
                <div
                  data-motion-kind="popover"
                  data-motion-state={colorPickerPresence.isExiting ? 'closing' : 'open'}
                  inert={colorPickerPresence.isExiting}
                  className={`motion-popover absolute right-0 top-[46px] z-50 flex gap-2 rounded-[18px] border p-2.5 shadow-xl backdrop-blur-md ${
                    isDarkMode ? 'border-[#3a3a3e] bg-[#252527]/95' : 'border-[#e0e0e0] bg-white/95'
                  }`}
                >
                  {PALETTE_SWATCHES.map((c) => (
                    <button
                      key={c.hex}
                      type="button"
                      aria-label={t('Warna {color}', { color: t(c.label) })}
                      onClick={() => {
                        setAccentColor(c.hex)
                        setShowColorPicker(false)
                        saveNote({ accentColor: c.hex })
                      }}
                      className={`h-7 w-7 rounded-full border-2 transition-transform active:scale-95 ${
                        accentColor.toLowerCase() === c.hex.toLowerCase()
                          ? isDarkMode
                            ? 'border-[#2997ff] scale-110'
                            : 'border-[#0066cc] scale-110'
                          : 'border-transparent'
                      }`}
                      style={{ backgroundColor: c.hex }}
                    />
                  ))}
                </div>
              )}
            </div>

            {/* Share Button (if not new) */}
            {!isNew && (isPremium || !isOwner) && (
              <button
                type="button"
                aria-label={t("Kolaborator")}
                title={t("Kolaborator")}
                onClick={() => {
                  const nextState = !showShareModal
                  setShowShareModal(nextState)
                  if (nextState && noteId) {
                    fetchCollaborators(noteId)
                  }
                  setShowColorPicker(false)
                  setShowFolderPicker(false)
                }}
                className={`flex h-[38px] items-center gap-1.5 rounded-full border px-3 text-[14px] transition-transform active:scale-95 focus-visible:outline-2 focus-visible:outline-[#0071e3] ${
                  isDarkMode
                    ? 'border-[#3a3a3e] bg-[#252527] text-[#f5f5f7]'
                    : 'border-[#e0e0e0] bg-white text-[#1d1d1f]'
                }`}
              >
                <HiOutlineUsers aria-hidden="true" />
                {collaboratorList.length > 0 && <span className="text-[12px] font-semibold">{collaboratorList.length}</span>}
              </button>
            )}

            {/* Move to Trash / Delete */}
            {!isNew && isOwner && (
              <button
                type="button"
                aria-label={isTrashed ? t('Hapus permanen') : t('Buang catatan')}
                title={isTrashed ? t('Hapus permanen') : t('Buang catatan')}
                onClick={isTrashed ? handleDeletePermanently : handleToggleTrash}
                className={`flex h-[38px] w-[38px] items-center justify-center rounded-full border text-[14px] transition-transform active:scale-95 focus-visible:outline-2 focus-visible:outline-[#0071e3] ${
                  isDarkMode
                    ? 'border-[#3a3a3e] bg-[#252527] text-[#b3b3b8] hover:text-[#ff453a]'
                    : 'border-[#e0e0e0] bg-white text-[#7a7a7a] hover:text-[#ff3b30]'
                }`}
              >
                <HiOutlineTrash aria-hidden="true" className="h-4 w-4" />
              </button>
            )}
          </div>

          {/* Primary Action Button (Selesai) */}
          <button
            type="button"
            onClick={() => handleBackToDashboard()}
            disabled={isSubmitting}
            className={`flex min-h-[36px] items-center gap-1.5 rounded-full px-4 text-[14px] font-normal text-white transition-all active:scale-95 focus-visible:outline-2 focus-visible:outline-[#0071e3] ${
              isSubmitting ? 'opacity-70 cursor-not-allowed' : ''
            } ${
              isDarkMode ? 'bg-[#0066cc] hover:bg-[#0071e3]' : 'bg-[#0066cc] hover:bg-[#0055b3]'
            }`}
          >
            {isSubmitting && (
              <ImSpinner2 aria-hidden="true" className="h-3.5 w-3.5 animate-spin text-white" />
            )}
            <span>{isSubmitting ? t('Menyimpan...') : t('Selesai')}</span>
          </button>
        </div>
      </nav>

      {/* 3. Main Note Content Canvas (extra bottom padding pb-36 so floating dock never obscures text) */}
      <main data-motion-content className="mx-auto flex w-full max-w-[980px] flex-1 flex-col px-4 py-6 pb-36 sm:px-8 sm:py-10 sm:pb-36">
        {/* Note Metadata Strip */}
        <div
          className={`mb-4 flex flex-wrap items-center justify-between gap-2 pb-3 text-[12px] tracking-[-0.12px] ${
            isDarkMode
              ? 'border-b border-white/10 text-[#b3b3b8]'
              : 'border-b border-black/5 text-[#7a7a7a]'
          }`}
        >
          <div className="flex flex-wrap items-center gap-2">
            <span>{createdAt ? formatDate(createdAt) : t('Baru saja')}</span>

            {/* Folder selection badge */}
            {isPremium && (
              <div className="relative inline-block">
                <button
                  type="button"
                  onClick={() => setShowFolderPicker(!showFolderPicker)}
                  className={`inline-flex items-center gap-1 rounded-full border px-2.5 py-0.5 text-[12px] transition-transform active:scale-95 ${
                    isDarkMode
                      ? 'border-[#3a3a3e] bg-[#252527]/80 text-[#f5f5f7]'
                      : 'border-[#e0e0e0] bg-white/70 text-[#1d1d1f]'
                  }`}
                >
                  <HiOutlineFolder aria-hidden="true" />
                  <span>{folders.find((f) => String(f.id) === folderId)?.name || t('Tanpa Folder')}</span>
                  <span className={`text-[10px] ${isDarkMode ? 'text-[#b3b3b8]' : 'text-[#7a7a7a]'}`}><HiOutlineChevronDown aria-hidden="true" /></span>
                </button>

                {folderPickerPresence.isPresent && (
                  <div
                    data-motion-kind="popover"
                    data-motion-state={folderPickerPresence.isExiting ? 'closing' : 'open'}
                    inert={folderPickerPresence.isExiting}
                    className={`motion-popover absolute left-0 top-[30px] z-50 min-w-40 rounded-[14px] border p-1.5 shadow-none ${
                      isDarkMode ? 'border-[#3a3a3e] bg-[#252527]' : 'border-[#e0e0e0] bg-white'
                    }`}
                  >
                    <button
                      type="button"
                      onClick={() => {
                        setFolderId('')
                        setShowFolderPicker(false)
                        saveNote({ folderId: '' })
                      }}
                      className={`block w-full rounded-[8px] px-3 py-1.5 text-left text-[12px] transition-colors ${
                        folderId === ''
                          ? isDarkMode
                            ? 'bg-[#303033] font-semibold text-[#2997ff]'
                            : 'bg-[#f5f5f7] font-semibold text-[#0066cc]'
                          : isDarkMode
                          ? 'text-[#f5f5f7] hover:bg-[#303033]'
                          : 'text-[#1d1d1f] hover:bg-[#fafafc]'
                      }`}
                    >
                      {t("Tanpa Folder")}
                    </button>
                    {folders.map((folder) => (
                      <button
                        key={folder.id}
                        type="button"
                        onClick={() => {
                          const val = String(folder.id)
                          setFolderId(val)
                          setShowFolderPicker(false)
                          saveNote({ folderId: val })
                        }}
                        className={`block w-full truncate rounded-[8px] px-3 py-1.5 text-left text-[12px] transition-colors ${
                          folderId === String(folder.id)
                            ? isDarkMode
                              ? 'bg-[#303033] font-semibold text-[#2997ff]'
                              : 'bg-[#f5f5f7] font-semibold text-[#0066cc]'
                            : isDarkMode
                            ? 'text-[#f5f5f7] hover:bg-[#303033]'
                            : 'text-[#1d1d1f] hover:bg-[#fafafc]'
                        }`}
                      >
                        {folder.name}
                      </button>
                    ))}
                  </div>
                )}
              </div>
            )}
          </div>

          <div className="flex items-center gap-3">
            <span>{t('{count} kata', { count: content.trim() ? content.trim().split(/\s+/).length : 0 })}</span>
            <span>{t('{count} karakter', { count: content.length })}</span>
          </div>
        </div>

        {/* Note Title Input */}
        <input
          id="note-title-input"
          type="text"
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          placeholder={t("Judul Catatan")}
          className={`w-full bg-transparent text-[28px] font-semibold tracking-[-0.374px] leading-[1.14] outline-none sm:text-[34px] sm:tracking-[-0.374px] ${
            isDarkMode
              ? 'text-[#f5f5f7] placeholder-[#b3b3b8]/40'
              : 'text-[#1d1d1f] placeholder-[#7a7a7a]/40'
          }`}
        />

        {/* Note Body Textarea */}
        <textarea
          id="note-content-input"
          ref={contentTextareaRef}
          value={content}
          onChange={(e) => setContent(e.target.value)}
          placeholder={t("Tulis catatanmu di sini...")}
          className={`mt-4 w-full flex-1 resize-none bg-transparent pb-36 md:pb-12 text-[17px] font-normal leading-[1.47] tracking-[-0.374px] outline-none ${
            isDarkMode
              ? 'text-[#f5f5f7] placeholder-[#b3b3b8]/40'
              : 'text-[#1d1d1f] placeholder-[#7a7a7a]/40'
          }`}
        />
      </main>


      {/* 5. Floating Apple Liquid Glass Dock (Mobile View - ala dock liquid glass apple) */}
      <div
        role="toolbar"
        aria-label={t("Peralatan Catatan")}
        style={{
          bottom: 'max(2.25rem, calc(1.5rem + env(safe-area-inset-bottom, 0px)))',
        }}
        className={`motion-dock fixed left-1/2 -translate-x-1/2 z-40 md:hidden ${
          sharePresence.isPresent && !colorPickerPresence.isExiting ? 'hidden' : 'flex'
        } items-center gap-1 sm:gap-2 px-3 py-1.5 rounded-full backdrop-blur-2xl saturate-[190%] shadow-[0_8px_32px_rgba(0,0,0,0.15)] dark:shadow-[0_8px_32px_rgba(0,0,0,0.5)] transition-all pointer-events-auto ${
          isDarkMode
            ? 'bg-[#252527]/80 border border-white/10 ring-1 ring-white/[0.06]'
            : 'bg-white/85 border border-white/70 ring-1 ring-black/[0.04]'
        }`}
      >
        {/* Pin Button */}
        {isOwner && !isNew && (
          <button
            type="button"
            onClick={handleTogglePin}
            aria-label={isPinned ? t('Lepas Pin') : t('Pin Catatan')}
            title={isPinned ? t('Lepas Pin') : t('Pin Catatan')}
            className={`flex h-[36px] items-center gap-1 rounded-full px-3 text-[13px] transition-transform active:scale-95 ${
              isPinned
                ? isDarkMode
                  ? 'bg-[#2997ff] text-white shadow-sm'
                  : 'bg-[#0066cc] text-white shadow-sm'
                : isDarkMode
                ? 'text-[#f5f5f7] hover:bg-white/10'
                : 'text-[#1d1d1f] hover:bg-black/5'
            }`}
          >
            {isPinned ? <BsPinFill aria-hidden="true" /> : <BsPin aria-hidden="true" />}
            <span className="font-normal">{isPinned ? t('Dipin') : t('Sematkan')}</span>
          </button>
        )}

        {/* Palette Button with Popover Opening Upward Above Dock */}
        <div className="relative">
          <button
            type="button"
            aria-label={t("Pilih warna catatan")}
            title={t("Warna Catatan")}
            onClick={() => {
              setShowColorPicker(!showColorPicker)
              setShowFolderPicker(false)
              setShowShareModal(false)
            }}
            className={`flex h-[36px] w-[36px] items-center justify-center rounded-full transition-transform active:scale-95 ${
              isDarkMode ? 'hover:bg-white/10' : 'hover:bg-black/5'
            }`}
          >
            <span
              className="h-4 w-4 rounded-full border border-black/15 shadow-sm"
              style={{ backgroundColor: accentColor }}
            />
          </button>

          {colorPickerPresence.isPresent && (
            <div
              data-motion-kind="popover"
              data-motion-state={colorPickerPresence.isExiting ? 'closing' : 'open'}
              inert={colorPickerPresence.isExiting}
              className={`motion-popover absolute bottom-[calc(100%+12px)] left-1/2 -translate-x-1/2 z-50 flex gap-2 rounded-full border p-2 shadow-2xl backdrop-blur-2xl transition-all ${
                isDarkMode
                  ? 'border-white/15 bg-[#252527]/95 shadow-[0_12px_36px_rgba(0,0,0,0.6)]'
                  : 'border-white/80 bg-white/95 shadow-[0_12px_36px_rgba(0,0,0,0.2)]'
              }`}
            >
              {PALETTE_SWATCHES.map((c) => (
                <button
                  key={c.hex}
                  type="button"
                  aria-label={t('Warna {color}', { color: t(c.label) })}
                  onClick={() => {
                    setAccentColor(c.hex)
                    setShowColorPicker(false)
                    saveNote({ accentColor: c.hex })
                  }}
                  className={`h-6 w-6 rounded-full border-2 transition-transform active:scale-95 ${
                    accentColor.toLowerCase() === c.hex.toLowerCase()
                      ? isDarkMode
                        ? 'border-[#2997ff] scale-110'
                        : 'border-[#0066cc] scale-110'
                      : 'border-transparent'
                  }`}
                  style={{ backgroundColor: c.hex }}
                />
              ))}
            </div>
          )}
        </div>

        {/* Share Button (if not new) */}
        {!isNew && (isPremium || !isOwner) && (
          <button
            type="button"
            aria-label={t("Kolaborator")}
            title={t("Kolaborator")}
            onClick={() => {
              const nextState = !showShareModal
              setShowShareModal(nextState)
              if (nextState && noteId) {
                fetchCollaborators(noteId)
              }
              setShowColorPicker(false)
              setShowFolderPicker(false)
            }}
            className={`flex h-[36px] items-center gap-1.5 rounded-full px-2.5 text-[13px] transition-transform active:scale-95 ${
              isDarkMode ? 'text-[#f5f5f7] hover:bg-white/10' : 'text-[#1d1d1f] hover:bg-black/5'
            }`}
          >
            <HiOutlineUsers aria-hidden="true" />
            {collaboratorList.length > 0 && (
              <span
                className={`flex h-4 min-w-4 items-center justify-center rounded-full px-1 text-[10px] font-semibold text-white ${
                  isDarkMode ? 'bg-[#2997ff]' : 'bg-[#0066cc]'
                }`}
              >
                {collaboratorList.length}
              </span>
            )}
          </button>
        )}

        {/* Delete / Trash Button */}
        {!isNew && isOwner && (
          <button
            type="button"
            aria-label={isTrashed ? t('Hapus permanen') : t('Buang catatan')}
            title={isTrashed ? t('Hapus permanen') : t('Buang catatan')}
            onClick={isTrashed ? handleDeletePermanently : handleToggleTrash}
            className={`flex h-[36px] w-[36px] items-center justify-center rounded-full transition-transform active:scale-95 ${
              isDarkMode
                ? 'text-[#b3b3b8] hover:text-[#ff453a] hover:bg-white/10'
                : 'text-[#7a7a7a] hover:text-[#ff3b30] hover:bg-black/5'
            }`}
          >
            <HiOutlineTrash aria-hidden="true" className="h-4 w-4" />
          </button>
        )}
      </div>

      {/* 6. Apple-Styled Collaboration Modal (Bottom Sheet on Mobile, Dialog on Desktop) */}
      {sharePresence.isPresent && (
        <div
          data-motion-kind="sheet"
          data-motion-state={sharePresence.isExiting ? 'closing' : 'open'}
          inert={sharePresence.isExiting}
          className="animate-modal-backdrop fixed inset-0 z-50 flex items-end sm:items-center justify-center p-0 sm:p-4"
        >
          {/* Backdrop Blur Overlay */}
          <div
            className="fixed inset-0 bg-black/40 backdrop-blur-sm transition-opacity"
            onClick={() => setShowShareModal(false)}
            aria-hidden="true"
          />

          {/* Modal / Bottom Sheet Card */}
          <div
            role="dialog"
            aria-modal="true"
            aria-labelledby="collab-modal-title"
            data-motion-kind="sheet"
            className={`animate-modal-enter relative z-10 flex max-h-[88vh] w-full flex-col overflow-hidden rounded-t-[28px] border sm:rounded-[20px] sm:max-w-[480px] backdrop-blur-xl transition-all duration-200 ${
              isDarkMode
                ? 'border-[#3a3a3e] bg-[#252527]/95 text-[#f5f5f7] shadow-[0_20px_60px_rgba(0,0,0,0.6)]'
                : 'border-[#e0e0e0] bg-white/95 text-[#1d1d1f] shadow-[0_20px_60px_rgba(0,0,0,0.15)]'
            }`}
          >
            {/* Mobile Drag Indicator Handle */}
            <div className="pt-3 pb-1 sm:hidden flex justify-center">
              <div className="h-1 w-9 rounded-full bg-[#d2d2d7] dark:bg-[#48484a]" />
            </div>

            {/* Modal Header */}
            <div
              className={`flex items-center justify-between px-6 pt-2 pb-3.5 border-b ${
                isDarkMode ? 'border-[#3a3a3e]' : 'border-[#f0f0f0]'
              }`}
            >
              <div>
                <h3
                  id="collab-modal-title"
                  className="text-[19px] font-semibold tracking-[-0.28px]"
                >
                  {t("Kolaborasi Catatan")}
                </h3>
                <p className="mt-0.5 text-[13px] text-[#7a7a7a] dark:text-[#b3b3b8] tracking-[-0.12px]">
                  {collaboratorList.length > 0
                    ? t('{count} orang memiliki akses ke catatan ini', { count: collaboratorList.length + (ownerPerson ? 1 : 0) })
                    : t('Kelola akses dan kolaborator catatan')}
                </p>
              </div>
              <button
                type="button"
                onClick={() => setShowShareModal(false)}
                className={`min-h-[44px] min-w-[44px] flex items-center justify-end text-[17px] font-normal tracking-[-0.374px] active:scale-95 transition-transform ${
                  isDarkMode ? 'text-[#2997ff]' : 'text-[#0066cc]'
                }`}
              >
                {t("Tutup")}
              </button>
            </div>

            {/* Scrollable Modal Body */}
            <div className="flex-1 overflow-y-auto px-6 py-5 space-y-6">
              {/* Section 1: Orang yang Memiliki Akses */}
              <div>
                <div className="flex items-center justify-between mb-2.5 px-0.5">
                  <span className="text-[12px] font-semibold uppercase tracking-wider text-[#7a7a7a] dark:text-[#b3b3b8]">
                    {t("Orang dengan Akses")}
                  </span>
                  <span className="text-[12px] text-[#7a7a7a] dark:text-[#b3b3b8]">
                    {t('{count} Anggota', { count: collaboratorList.length + (ownerPerson ? 1 : 0) })}
                  </span>
                </div>

                {/* Participant List Card */}
                <div
                  className={`rounded-[16px] border divide-y overflow-hidden ${
                    isDarkMode
                      ? 'border-[#3a3a3e] bg-[#1d1d1f] divide-[#3a3a3e]/70'
                      : 'border-[#e0e0e0] bg-[#f5f5f7] divide-[#e0e0e0]/70'
                  }`}
                >
                  {/* Pemilik (Owner) */}
                  {ownerPerson && (
                    <div className="flex items-center justify-between p-3.5 transition-colors">
                      <div className="flex items-center gap-3 min-w-0">
                        <div className="relative shrink-0">
                          {ownerPerson.avatar_url ? (
                            <Image
                              src={ownerPerson.avatar_url}
                              alt={ownerPerson.full_name || t(ownerPerson.user_id === user?.id ? 'Saya' : 'Pemilik Catatan')}
                              width={40}
                              height={40}
                              className="h-10 w-10 rounded-full object-cover border border-black/5 dark:border-white/10"
                              unoptimized
                            />
                          ) : (
                            <div className="flex h-10 w-10 items-center justify-center rounded-full bg-[#0066cc] text-[15px] font-semibold text-white shadow-sm">
                              {(ownerPerson.full_name || t(ownerPerson.user_id === user?.id ? 'Saya' : 'Pemilik Catatan')).slice(0, 1).toUpperCase()}
                            </div>
                          )}
                          <span className="absolute -bottom-0.5 -right-0.5 flex h-4 w-4 items-center justify-center rounded-full bg-[#34c759] text-[9px] text-white ring-2 ring-white dark:ring-[#1d1d1f]">
                            <HiOutlineCheck aria-hidden="true" />
                          </span>
                        </div>
                        <div className="min-w-0 flex-1">
                          <p className="truncate text-[15px] font-semibold tracking-[-0.2px]">
                            {ownerPerson.full_name || t(ownerPerson.user_id === user?.id ? 'Saya' : 'Pemilik Catatan')}
                            {ownerPerson.user_id === user?.id && (
                              <span className="ml-1.5 text-[13px] font-normal text-[#7a7a7a] dark:text-[#b3b3b8]">
                                {t("(Anda)")}
                              </span>
                            )}
                          </p>
                          <p className="text-[12px] text-[#7a7a7a] dark:text-[#b3b3b8] tracking-[-0.12px]">
                            {t("Pemilik Catatan")}
                          </p>
                        </div>
                      </div>
                      <span
                        className={`shrink-0 rounded-full px-2.5 py-0.5 text-[11px] font-semibold tracking-[-0.1px] ${
                          isDarkMode
                            ? 'bg-white/10 text-[#f5f5f7]'
                            : 'bg-black/5 text-[#1d1d1f]'
                        }`}
                      >
                        {t("Pemilik")}
                      </span>
                    </div>
                  )}

                  {/* Collaborator Rows */}
                  {collaboratorList.length > 0 &&
                    collaboratorList.map((m) => (
                      <div
                        key={m.user_id}
                        className="flex items-center justify-between p-3.5 transition-colors"
                      >
                        <div className="flex items-center gap-3 min-w-0">
                          <div className="shrink-0">
                            {m.avatar_url ? (
                              <Image
                                src={m.avatar_url}
                                alt={m.full_name || t('Kolaborator')}
                                width={40}
                                height={40}
                                className="h-10 w-10 rounded-full object-cover border border-black/5 dark:border-white/10"
                                unoptimized
                              />
                            ) : (
                              <div
                                className={`flex h-10 w-10 items-center justify-center rounded-full text-[15px] font-semibold border ${
                                  isDarkMode
                                    ? 'bg-[#162838] text-[#2997ff] border-[#23435c]'
                                    : 'bg-[#e8f2ff] text-[#0066cc] border-[#bae6fd]'
                                }`}
                              >
                                {(m.full_name || t('Kolaborator')).slice(0, 1).toUpperCase()}
                              </div>
                            )}
                          </div>
                          <div className="min-w-0 flex-1">
                            <p className="truncate text-[15px] font-semibold tracking-[-0.2px]">
                              {m.full_name || t('Kolaborator')}
                              {m.user_id === user?.id && (
                                <span className="ml-1.5 text-[13px] font-normal text-[#7a7a7a] dark:text-[#b3b3b8]">
                                  {t("(Anda)")}
                                </span>
                              )}
                            </p>
                            <p className="text-[12px] text-[#7a7a7a] dark:text-[#b3b3b8] tracking-[-0.12px]">
                              {t("Dapat mengedit")}
                            </p>
                          </div>
                        </div>

                        {isOwner && (
                          <button
                            type="button"
                            onClick={() => handleRemoveCollaborator(m.user_id)}
                            className="shrink-0 text-[13px] text-[#ff453a] hover:underline active:scale-95 px-2 py-1"
                          >
                            {t("Hapus")}
                          </button>
                        )}
                      </div>
                    ))}
                </div>

                {/* Empty Collaborator Note */}
                {collaboratorList.length === 0 && (
                  <div
                    className={`mt-3 rounded-[16px] border border-dashed p-4 text-center ${
                      isDarkMode
                        ? 'border-[#3a3a3e] bg-[#1d1d1f]/60'
                        : 'border-[#e0e0e0] bg-[#f5f5f7]/60'
                    }`}
                  >
                    <HiOutlineUsers aria-hidden="true" className="inline-block text-2xl" />
                    <p className="mt-1.5 text-[14px] font-semibold tracking-[-0.2px]">
                      {t("Belum ada kolaborator yang diundang")}
                    </p>
                    <p className="mt-0.5 text-[12px] text-[#7a7a7a] dark:text-[#b3b3b8]">
                      {t("Undang rekan lewat email di bawah untuk mulai mengedit bersama secara real-time.")}
                    </p>
                  </div>
                )}
              </div>

              {/* Section 2: Form Undang Kolaborator */}
              {isOwner && (
                <div>
                  <label
                    htmlFor="invite-collab-input"
                    className="block text-[12px] font-semibold uppercase tracking-wider text-[#7a7a7a] dark:text-[#b3b3b8] mb-2 px-0.5"
                  >
                    {t("Undang Kolaborator Baru")}
                  </label>

                  {isPremium ? (
                    <form onSubmit={handleInviteCollaborator} className="space-y-3">
                      <div className="relative flex items-center">
                        <span className="absolute left-4 text-[#7a7a7a] dark:text-[#b3b3b8] text-[15px] pointer-events-none">
                          <HiOutlineMail aria-hidden="true" />
                        </span>
                        <input
                          id="invite-collab-input"
                          type="email"
                          required
                          value={inviteEmail}
                          onChange={(e) => setInviteEmail(e.target.value)}
                          onInvalid={(e) => e.currentTarget.setCustomValidity(t(e.currentTarget.validity.valueMissing ? 'Email wajib diisi.' : 'Masukkan alamat email yang valid.'))}
                          onInput={(e) => e.currentTarget.setCustomValidity('')}
                          placeholder={t("Masukkan email rekan (nama@email.com)")}
                          className={`h-11 w-full rounded-full border pl-11 pr-4 text-[15px] outline-none transition-colors focus-visible:outline-2 focus-visible:outline-[#0071e3] ${
                            isDarkMode
                              ? 'border-[#3a3a3e] bg-[#1d1d1f] text-[#f5f5f7] placeholder-[#b3b3b8]/50'
                              : 'border-[#e0e0e0] bg-white text-[#1d1d1f] placeholder-[#7a7a7a]/50'
                          }`}
                        />
                      </div>

                      <button
                        type="submit"
                        disabled={inviteLoading || !inviteEmail.trim()}
                        className={`w-full min-h-11 rounded-full text-[15px] font-normal text-white transition-transform active:scale-95 disabled:opacity-40 flex items-center justify-center gap-2 ${
                          isDarkMode ? 'bg-[#2997ff]' : 'bg-[#0066cc]'
                        }`}
                      >
                        {inviteLoading ? (
                          <>
                            <ImSpinner2 aria-hidden="true" className="h-4 w-4 animate-spin" />
                            <span>{t("Mengirim Undangan...")}</span>
                          </>
                        ) : (
                          <span>{t("Kirim Undangan Kolaborasi")}</span>
                        )}
                      </button>
                    </form>
                  ) : (
                    <div
                      className={`rounded-[16px] border p-4 text-center ${
                        isDarkMode
                          ? 'border-[#4d3f1a] bg-[#2d2616]'
                          : 'border-[#fde68a] bg-[#fff8e6]'
                      }`}
                    >
                      <HiStar aria-hidden="true" className="inline-block text-xl" />
                      <p className="mt-1 text-[14px] font-semibold">
                        {t("Fitur Kolaborasi Premium")}
                      </p>
                      <p className="mt-0.5 text-[13px] text-[#7a7a7a] dark:text-[#b3b3b8]">
                        {t("Tingkatkan akun ke Premium untuk mengundang kolaborator tanpa batas.")}
                      </p>
                      <button
                        type="button"
                        onClick={() => router.push('/')}
                        className={`mt-3 inline-flex min-h-[36px] items-center justify-center rounded-full px-4 text-[13px] font-normal text-white active:scale-95 transition-transform ${
                          isDarkMode ? 'bg-[#2997ff]' : 'bg-[#0066cc]'
                        }`}
                      >
                        {t("Lihat Paket Premium")}
                      </button>
                    </div>
                  )}

                  {inviteMsg && (
                    <p
                      className={`mt-2.5 text-center text-[13px] font-normal ${
                        inviteMsg.isError ? 'text-[#ff453a]' : 'text-[#34c759]'
                      }`}
                    >
                      {inviteMsg.raw ? inviteMsg.source : t(inviteMsg.source, inviteMsg.values)}
                    </p>
                  )}
                </div>
              )}
            </div>

            {/* Bottom Safe Area Padding */}
            <div className="h-6 sm:h-3" />
          </div>
        </div>
      )}
    </div>
  )
}

export default function NoteDetailPage({ isNewOverride }: { isNewOverride?: boolean } = {}) {
  const { t } = useLanguage()
  return (
    <PageTransition>
      <Suspense
        fallback={
          <AppleNoteLoader
            title={isNewOverride ? t('Membuat Catatan...') : t('Membuka Catatan...')}
            subtitle={t("Menyiapkan ruang tenang untuk idemu")}
          />
        }
      >
        <NoteDetailContent isNewOverride={isNewOverride} />
      </Suspense>
    </PageTransition>
  )
}

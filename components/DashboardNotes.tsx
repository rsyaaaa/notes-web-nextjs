'use client'

import { useEffect, useRef, useState } from 'react'
import { useRouter } from 'next/navigation'
import type { User } from '@supabase/supabase-js'
import Image from 'next/image'
import { FaApple } from 'react-icons/fa'
import { HiOutlineChevronDown, HiOutlineFolder, HiOutlineSearch, HiPlus, HiStar } from 'react-icons/hi'
import { supabase } from '@/lib/supabaseClient'
import { getNewNoteFolderId, getNewNoteHref } from '@/lib/new-note-folder'
import type { Note, NoteDraft, NoteFolder, NotePerson, UserProfile } from '@/lib/types'
import { useLanguage } from '@/components/LanguageProvider'
import { useAnimatedPresence } from '@/lib/useAnimatedPresence'

interface DashboardNotesProps {
  user: User
  initialProfile?: UserProfile | null
  onLogout: () => Promise<void>
}

interface MemberQueryResult {
  note_id: number
  user_id: string
  profiles?: {
    full_name?: string | null
    avatar_url?: string | null
  } | null
}

const ACCENT_COLORS = [
  { label: 'Putih', hex: '#ffffff', surface: '#ffffff', border: '#e0e0e0' },
  { label: 'Perkamen', hex: '#f5f5f7', surface: '#f5f5f7', border: '#e0e0e0' },
  { label: 'Kuning', hex: '#fef3c7', surface: '#fefce8', border: '#fde68a' },
  { label: 'Mint', hex: '#dcfce7', surface: '#f0fdf4', border: '#bbf7d0' },
  { label: 'Biru Langit', hex: '#e0f2fe', surface: '#f0f9ff', border: '#bae6fd' },
  { label: 'Merah Muda', hex: '#ffe4e6', surface: '#fff1f2', border: '#fecdd3' },
]

export default function DashboardNotes({ user, initialProfile, onLogout }: DashboardNotesProps) {
  const { locale, t } = useLanguage()
  const router = useRouter()

  // State Data
  const [profile, setProfile] = useState<UserProfile | null>(initialProfile ?? null)
  const [notes, setNotes] = useState<Note[]>([])
  const [folders, setFolders] = useState<NoteFolder[]>([])
  const [notePeopleById, setNotePeopleById] = useState<Record<number, NotePerson[]>>({})
  const [activeTab, setActiveTab] = useState<'notes' | 'trash'>('notes')
  const [folderFilter, setFolderFilter] = useState('all')
  const [searchQuery, setSearchQuery] = useState('')
  const [isDarkMode, setIsDarkMode] = useState(false)
  const [isProfileMenuOpen, setIsProfileMenuOpen] = useState(false)
  const profileMenuPresence = useAnimatedPresence(isProfileMenuOpen)

  // Folder creation
  const [isCreatingFolder, setIsCreatingFolder] = useState(false)
  const [folderName, setFolderName] = useState('')

  // Desktop Editor Modal
  const [isFormOpen, setIsFormOpen] = useState(false)
  const formPresence = useAnimatedPresence(isFormOpen)
  const [editingNoteId, setEditingNoteId] = useState<number | null>(null)
  const [title, setTitle] = useState('')
  const [content, setContent] = useState('')
  const [accentColor, setAccentColor] = useState('#ffffff')
  const [selectedFolderId, setSelectedFolderId] = useState('')
  const [isSaving, setIsSaving] = useState(false)
  const lastSavedDraft = useRef<NoteDraft>({ title: '', content: '', accentColor: '#ffffff', folderId: '' })

  const isPremium = profile?.plan === 'premium'

  useEffect(() => {
    if (!formPresence.isPresent) return
    const previousOverflow = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    return () => {
      document.body.style.overflow = previousOverflow
    }
  }, [formPresence.isPresent])

  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        setIsFormOpen(false)
        setIsProfileMenuOpen(false)
      }
    }
    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [])

  // Initial load & Realtime subscription
  useEffect(() => {
    let isMounted = true

    const loadData = async () => {
      const [profileRes, foldersRes, membershipsRes] = await Promise.all([
        supabase.from('profiles').select('*').eq('id', user.id).maybeSingle(),
        supabase.from('note_folders').select('id, name').eq('user_id', user.id).order('name'),
        supabase.from('note_members').select('note_id').eq('user_id', user.id),
      ])

      if (!isMounted) return

      if (profileRes.data) {
        setProfile(profileRes.data as UserProfile)
      }
      if (foldersRes.data) {
        setFolders(foldersRes.data as NoteFolder[])
      }

      const sharedIds = (membershipsRes.data ?? []).map((m: { note_id: number }) => m.note_id)
      const visibilityFilter = sharedIds.length > 0
        ? `user_id.eq.${user.id},id.in.(${sharedIds.join(',')})`
        : `user_id.eq.${user.id}`

      const { data: noteList } = await supabase
        .from('notes')
        .select('*')
        .or(visibilityFilter)
        .order('is_pinned', { ascending: false })
        .order('updated_at', { ascending: false })

      if (!isMounted) return

      if (noteList) {
        setNotes(noteList as Note[])

        const noteIds = noteList.map((n) => n.id)
        if (noteIds.length > 0) {
          const { data: memberData } = await supabase
            .from('note_members')
            .select('note_id, user_id, profiles:user_id(full_name, avatar_url)')
            .in('note_id', noteIds)

          if (isMounted && memberData) {
            const raw = memberData as unknown as MemberQueryResult[]
            const map: Record<number, NotePerson[]> = {}
            for (const m of raw) {
              if (!map[m.note_id]) map[m.note_id] = []
              map[m.note_id].push({
                user_id: m.user_id,
                full_name: m.profiles?.full_name || '',
                avatar_url: m.profiles?.avatar_url || null,
              })
            }
            setNotePeopleById(map)
          }
        }
      }
    }

    loadData()

    const channel = supabase
      .channel('dashboard-notes')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'notes' }, () => {
        loadData()
      })
      .subscribe()

    return () => {
      isMounted = false
      supabase.removeChannel(channel)
    }
  }, [user.id])

  // Theme support
  useEffect(() => {
    const stored = window.localStorage.getItem('notes-theme')
    const shouldUseDark = stored === 'dark'
    document.documentElement.dataset.theme = shouldUseDark ? 'dark' : 'light'
    const frame = window.requestAnimationFrame(() => setIsDarkMode(shouldUseDark))
    return () => window.cancelAnimationFrame(frame)
  }, [])

  const toggleDarkMode = () => {
    const next = !isDarkMode
    setIsDarkMode(next)
    window.localStorage.setItem('notes-theme', next ? 'dark' : 'light')
    document.documentElement.dataset.theme = next ? 'dark' : 'light'
  }

  // Refetch notes helper
  const reloadNotes = async () => {
    const { data: memberships } = await supabase
      .from('note_members')
      .select('note_id')
      .eq('user_id', user.id)

    const sharedIds = (memberships ?? []).map((m: { note_id: number }) => m.note_id)
    const visibilityFilter = sharedIds.length > 0
      ? `user_id.eq.${user.id},id.in.(${sharedIds.join(',')})`
      : `user_id.eq.${user.id}`

    const { data: noteList } = await supabase
      .from('notes')
      .select('*')
      .or(visibilityFilter)
      .order('is_pinned', { ascending: false })
      .order('updated_at', { ascending: false })

    if (noteList) {
      setNotes(noteList as Note[])
    }
  }

  // Handle Note Card Click (Mobile -> New Page, Desktop -> Inline Editor Modal)
  const handleNoteClick = (note: Note) => {
    if (typeof window !== 'undefined' && window.innerWidth < 768) {
      router.push(`/notes/${note.id}`)
    } else {
      setEditingNoteId(note.id)
      setTitle(note.title || '')
      setContent(note.content || '')
      setAccentColor(note.accent_color || '#ffffff')
      setSelectedFolderId(note.folder_id ? String(note.folder_id) : '')
      lastSavedDraft.current = {
        title: note.title || '',
        content: note.content || '',
        accentColor: note.accent_color || '#ffffff',
        folderId: note.folder_id ? String(note.folder_id) : '',
      }
      setIsFormOpen(true)
    }
  }

  // Handle New Note Click (Mobile -> /notes/new, Desktop -> Open Form)
  const handleNewNoteClick = () => {
    if (typeof window !== 'undefined' && window.innerWidth < 768) {
      router.push(getNewNoteHref(folderFilter, folders))
    } else {
      setEditingNoteId(null)
      setTitle('')
      setContent('')
      setAccentColor('#ffffff')
      const initialFolderId = getNewNoteFolderId(folderFilter, folders)
      setSelectedFolderId(initialFolderId)
      lastSavedDraft.current = { title: '', content: '', accentColor: '#ffffff', folderId: initialFolderId }
      setIsFormOpen(true)
    }
  }

  // Save Note in Desktop Modal
  const handleSaveModal = async (e?: React.FormEvent) => {
    if (e) e.preventDefault()
    if (!title.trim() && !content.trim()) {
      setIsFormOpen(false)
      return
    }

    setIsSaving(true)
    const payload = {
      title: title.trim(),
      content,
      accent_color: accentColor,
      folder_id: selectedFolderId ? Number(selectedFolderId) : null,
      updated_at: new Date().toISOString(),
    }

    if (editingNoteId) {
      const { error } = await supabase.from('notes').update(payload).eq('id', editingNoteId)
      setIsSaving(false)
      if (!error) {
        await reloadNotes()
        setIsFormOpen(false)
      }
    } else {
      const { error } = await supabase.from('notes').insert({
        ...payload,
        user_id: user.id,
        is_pinned: false,
        is_trashed: false,
      })
      setIsSaving(false)
      if (!error) {
        await reloadNotes()
        setIsFormOpen(false)
      }
    }
  }

  // Pin / Unpin
  const togglePin = async (note: Note, event?: React.MouseEvent) => {
    if (event) event.stopPropagation()
    const nextPinned = !note.is_pinned
    await supabase.from('notes').update({ is_pinned: nextPinned }).eq('id', note.id)
    await reloadNotes()
  }

  // Move to trash / Restore
  const handleTrashToggle = async (note: Note, moveToTrash: boolean) => {
    await supabase.from('notes').update({ is_trashed: moveToTrash }).eq('id', note.id)
    await reloadNotes()
  }

  // Permanent Delete
  const handlePermanentDelete = async (noteId: number) => {
    await supabase.from('notes').delete().eq('id', noteId)
    await reloadNotes()
  }

  // Empty Trash
  const handleEmptyTrash = async () => {
    await supabase.from('notes').delete().eq('user_id', user.id).eq('is_trashed', true)
    await reloadNotes()
  }

  // Create Folder
  const handleCreateFolder = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!folderName.trim()) return
    const { error } = await supabase.from('note_folders').insert({
      user_id: user.id,
      name: folderName.trim(),
    })
    if (!error) {
      setFolderName('')
      setIsCreatingFolder(false)
      const { data } = await supabase.from('note_folders').select('id, name').eq('user_id', user.id).order('name')
      if (data) setFolders(data as NoteFolder[])
    }
  }

  // Filter notes
  const activeNotes = notes
    .filter((n) => !n.is_trashed)
    .filter((n) => {
      if (folderFilter === 'all') return true
      if (folderFilter === 'none') return !n.folder_id
      return String(n.folder_id) === folderFilter
    })
    .filter((n) => {
      if (!searchQuery.trim()) return true
      const q = searchQuery.toLowerCase()
      return (n.title || '').toLowerCase().includes(q) || (n.content || '').toLowerCase().includes(q)
    })

  const trashedNotes = notes
    .filter((n) => n.is_trashed)
    .filter((n) => {
      if (!searchQuery.trim()) return true
      const q = searchQuery.toLowerCase()
      return (n.title || '').toLowerCase().includes(q) || (n.content || '').toLowerCase().includes(q)
    })

  const formatDate = (dateStr?: string) => {
    if (!dateStr) return t('Baru saja')
    try {
      const d = new Date(dateStr)
      return d.toLocaleDateString(locale, {
        day: 'numeric',
        month: 'short',
        year: 'numeric',
      })
    } catch {
      return dateStr
    }
  }

  return (
    <div className={`flex min-h-screen flex-col font-sans bg-[#f5f5f7] text-[#1d1d1f] selection:bg-[#0066cc] selection:text-white ${isDarkMode ? 'dark bg-[#1d1d1f] text-white' : ''}`}>
      {/* 1. Global Nav (44px pure black #000000) */}
      <header className="sticky top-0 z-50 flex h-[44px] items-center justify-between border-b border-black/10 bg-[#000000] px-4 text-[12px] tracking-[-0.12px] text-white sm:px-6 md:px-12">
        <div className="flex items-center gap-2">
          <FaApple aria-hidden="true" className="text-base" />
          <span className="font-semibold tracking-normal">{t("Notes")}</span>
          <span className="ml-1 rounded-full bg-white/10 px-2.5 py-0.5 text-[10px] text-white/90">
            {isPremium ? <><HiStar aria-hidden="true" className="inline align-middle" /> {t("Premium")}</> : t('Free Plan')}
          </span>
        </div>

        {/* Profile / Account button */}
        <div className="relative">
          <button
            type="button"
            aria-label={t("Menu akun")}
            aria-expanded={isProfileMenuOpen}
            onClick={() => setIsProfileMenuOpen(!isProfileMenuOpen)}
            className="flex min-h-[32px] items-center gap-2 rounded-full px-2 text-white hover:bg-white/10 transition-transform active:scale-95 focus-visible:outline-2 focus-visible:outline-[#0071e3]"
          >
            {profile?.avatar_url ? (
              <Image src={profile.avatar_url} alt="" width={24} height={24} className="h-6 w-6 rounded-full object-cover" unoptimized />
            ) : (
              <span className="flex h-6 w-6 items-center justify-center rounded-full bg-white/20 text-[11px] font-semibold">
                {(profile?.full_name || user.email || 'U').slice(0, 1).toUpperCase()}
              </span>
            )}
            <span className="hidden max-w-[140px] truncate text-[12px] sm:inline">{profile?.full_name || user.email}</span>
            <HiOutlineChevronDown aria-hidden="true" className="text-[10px] text-white/60" />
          </button>

          {profileMenuPresence.isPresent && (
            <div
              data-motion-kind="popover"
              data-motion-state={profileMenuPresence.isExiting ? 'closing' : 'open'}
              inert={profileMenuPresence.isExiting}
              className="motion-popover absolute right-0 top-[40px] z-50 w-56 rounded-[14px] border border-[#e0e0e0] bg-white p-2 text-[#1d1d1f] shadow-none"
            >
              <div className="border-b border-[#f0f0f0] px-3 py-2">
                <p className="truncate text-[14px] font-semibold">{profile?.full_name || t('Pengguna')}</p>
                <p className="truncate text-[12px] text-[#7a7a7a]">{user.email}</p>
              </div>
              <div className="flex items-center justify-between border-b border-[#f0f0f0] px-3 py-2 text-[14px]">
                <span>{t("Tampilan gelap")}</span>
                <button
                  type="button"
                  onClick={toggleDarkMode}
                  aria-label={t('Tampilan gelap')}
                  aria-pressed={isDarkMode}
                  className={`h-5 w-9 rounded-full transition-colors relative ${isDarkMode ? 'bg-[#0066cc]' : 'bg-[#d2d2d7]'}`}
                >
                  <span className={`absolute top-0.5 left-0.5 h-4 w-4 rounded-full bg-white transition-transform ${isDarkMode ? 'translate-x-4' : ''}`} />
                </button>
              </div>
              <button
                type="button"
                onClick={onLogout}
                className="mt-1 w-full rounded-[8px] px-3 py-2 text-left text-[14px] text-[#0066cc] hover:bg-[#f5f5f7] active:scale-95 transition-transform"
              >
                {t("Keluar")}
              </button>
            </div>
          )}
        </div>
      </header>

      {/* 2. Sub-Nav Frosted Glass (52px #f5f5f7/80 backdrop-blur-md) */}
      <nav className="sticky top-[44px] z-40 flex min-h-[52px] flex-wrap items-center justify-between border-b border-[#e0e0e0] bg-[#f5f5f7]/80 px-4 py-2 backdrop-blur-md sm:px-6 md:px-12">
        <div className="flex items-center gap-3 sm:gap-6">
          <h1 className="text-[18px] sm:text-[21px] font-semibold tracking-[0.231px] text-[#1d1d1f]">
            {activeTab === 'notes' ? t('Catatan Saya') : t('Sampah')}
          </h1>
          <div className="flex items-center rounded-full bg-black/5 p-0.5 text-[12px]">
            <button
              type="button"
              onClick={() => setActiveTab('notes')}
              className={`min-h-[32px] rounded-full px-3 transition-transform active:scale-95 ${
                activeTab === 'notes' ? 'bg-white font-semibold text-[#1d1d1f]' : 'text-[#7a7a7a]'
              }`}
            >
              {t('Catatan ({count})', { count: activeNotes.length })}
            </button>
            <button
              type="button"
              onClick={() => setActiveTab('trash')}
              className={`min-h-[32px] rounded-full px-3 transition-transform active:scale-95 ${
                activeTab === 'trash' ? 'bg-white font-semibold text-[#1d1d1f]' : 'text-[#7a7a7a]'
              }`}
            >
              {t('Sampah ({count})', { count: trashedNotes.length })}
            </button>
          </div>
        </div>

        {/* Primary CTA (Action Blue Pill) */}
        {activeTab === 'notes' ? (
          <button
            type="button"
            onClick={handleNewNoteClick}
            className="flex min-h-[38px] items-center rounded-full bg-[#0066cc] px-4 text-[14px] font-normal text-white transition-transform active:scale-95 focus-visible:outline-2 focus-visible:outline-[#0071e3]"
          >
            <HiPlus aria-hidden="true" className="mr-1 shrink-0" /> {t("Catatan Baru")}
          </button>
        ) : (
          trashedNotes.length > 0 && (
            <button
              type="button"
              onClick={handleEmptyTrash}
              className="flex min-h-[38px] items-center rounded-full border border-[#e0e0e0] bg-white px-4 text-[14px] font-normal text-[#ff3b30] transition-transform active:scale-95"
            >
              {t("Kosongkan Sampah")}
            </button>
          )
        )}
      </nav>

      {/* 3. Main Dashboard Content Area */}
      <main data-motion-content className="mx-auto w-full max-w-[1440px] flex-1 px-4 py-6 sm:px-6 sm:py-8 md:px-12">
        {/* Search & Folder Controls Bar */}
        <div className="mb-6 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          {/* Apple Search Input Pill */}
          <div className="relative w-full sm:max-w-xs">
            <span className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 text-[14px] text-[#7a7a7a]">
              <HiOutlineSearch aria-hidden="true" />
            </span>
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder={t("Cari catatan...")}
              className="h-[44px] w-full rounded-full border border-black/10 bg-white pl-9 pr-4 text-[17px] font-normal tracking-[-0.374px] text-[#1d1d1f] placeholder-[#7a7a7a]/60 outline-none focus-visible:outline-2 focus-visible:outline-[#0071e3]"
            />
          </div>

          {/* Folder Filter Pill Dropdown & + Folder button */}
          {activeTab === 'notes' && isPremium && (
            <div className="flex flex-wrap items-center gap-2">
              <select
                aria-label={t("Filter berdasarkan folder")}
                value={folderFilter}
                onChange={(e) => setFolderFilter(e.target.value)}
                className="h-[44px] rounded-full border border-black/10 bg-white px-4 text-[14px] text-[#1d1d1f] outline-none focus-visible:outline-2 focus-visible:outline-[#0071e3]"
              >
                <option value="all">{t("Semua Folder")}</option>
                <option value="none">{t("Tanpa Folder")}</option>
                {folders.map((f) => (
                  <option key={f.id} value={String(f.id)}>
                    {f.name}
                  </option>
                ))}
              </select>

              {isCreatingFolder ? (
                <form onSubmit={handleCreateFolder} className="flex items-center gap-1.5">
                  <input
                    type="text"
                    required
                    autoFocus
                    value={folderName}
                    onChange={(e) => setFolderName(e.target.value)}
                    onInvalid={(e) => e.currentTarget.setCustomValidity(t('Nama folder wajib diisi.'))}
                    onInput={(e) => e.currentTarget.setCustomValidity('')}
                    placeholder={t("Nama folder")}
                    className="h-[44px] w-36 rounded-full border border-[#e0e0e0] bg-white px-3 text-[14px] text-[#1d1d1f] outline-none focus-visible:outline-2 focus-visible:outline-[#0071e3]"
                  />
                  <button type="submit" className="min-h-[44px] rounded-full bg-[#0066cc] px-3 text-[14px] text-white active:scale-95">
                    {t("Buat")}
                  </button>
                  <button type="button" onClick={() => setIsCreatingFolder(false)} className="text-[14px] text-[#0066cc] px-2 active:scale-95">
                    {t("Batal")}
                  </button>
                </form>
              ) : (
                <button
                  type="button"
                  onClick={() => setIsCreatingFolder(true)}
                  className="flex min-h-[44px] items-center rounded-full border border-[#0066cc] px-4 text-[14px] font-normal text-[#0066cc] transition-transform active:scale-95 focus-visible:outline-2 focus-visible:outline-[#0071e3]"
                >
                  <HiPlus aria-hidden="true" className="mr-1 shrink-0" /> {t("Folder")}
                </button>
              )}
            </div>
          )}
        </div>

        {/* Notes Grid (Apple Utility Cards: rounded-lg 18px, 1px hairline border, no drop shadow) */}
        {activeTab === 'notes' ? (
          activeNotes.length === 0 ? (
            <div className="py-24 text-center">
              <p className="text-[21px] font-semibold tracking-[-0.28px] text-[#1d1d1f]">{t("Belum ada catatan")}</p>
              <p className="mt-2 text-[17px] leading-[1.47] tracking-[-0.374px] text-[#7a7a7a]">
                {t('Klik "{action}" di atas untuk mulai menulis ide dan rencanamu.', { action: t('Catatan Baru') })}
              </p>
              <button
                type="button"
                onClick={handleNewNoteClick}
                className="mt-6 inline-flex min-h-11 items-center rounded-full bg-[#0066cc] px-6 text-[17px] font-normal text-white transition-transform active:scale-95 focus-visible:outline-2 focus-visible:outline-[#0071e3]"
              >
                <HiPlus aria-hidden="true" className="mr-1 shrink-0" /> {t("Catatan Baru")}
              </button>
            </div>
          ) : (
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 sm:gap-5 lg:grid-cols-3 lg:gap-6">
              {activeNotes.map((note) => {
                const accent = ACCENT_COLORS.find((c) => c.hex.toLowerCase() === (note.accent_color || '#ffffff').toLowerCase()) || ACCENT_COLORS[0]
                const folder = folders.find((f) => f.id === note.folder_id)

                return (
                  <article
                    key={note.id}
                    data-note-card
                    role="button"
                    tabIndex={0}
                    onClick={() => handleNoteClick(note)}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter' || e.key === ' ') {
                        e.preventDefault()
                        handleNoteClick(note)
                      }
                    }}
                    style={{ backgroundColor: accent.surface }}
                    className="group relative flex min-w-0 cursor-pointer flex-col justify-between rounded-[18px] border border-[#e0e0e0] p-6 transition-all hover:border-[#0066cc]/40 focus-visible:outline-2 focus-visible:outline-[#0071e3]"
                  >
                    <div>
                      {/* Card Header: Title & Pin Indicator */}
                      <div className="flex items-start justify-between gap-2">
                        <h3 className="min-w-0 flex-1 truncate text-[17px] font-semibold tracking-[-0.374px] text-[#1d1d1f]">
                          {note.title || t('Tanpa Judul')}
                        </h3>
                        {note.user_id === user.id && (
                          <button
                            type="button"
                            aria-label={note.is_pinned ? t('Lepas pin catatan') : t('Pin catatan')}
                            onClick={(e) => togglePin(note, e)}
                            className={`min-h-[28px] rounded-full px-2.5 py-0.5 text-[11px] font-semibold transition-transform active:scale-95 ${
                              note.is_pinned ? 'bg-[#0066cc] text-white' : 'bg-black/5 text-[#7a7a7a] hover:bg-black/10'
                            }`}
                          >
                            {note.is_pinned ? t('Dipin') : t('Sematkan')}
                          </button>
                        )}
                      </div>

                      {/* Card Snippet (17px body, 1.47 line height) */}
                      <p className="mt-3 line-clamp-4 text-[17px] font-normal leading-[1.47] tracking-[-0.374px] text-[#1d1d1f]/85 whitespace-pre-wrap">
                        {note.content || t('Gak ada isi teks...')}
                      </p>
                    </div>

                    {/* Card Footer: Metadata & Actions */}
                    <div className="mt-6 flex flex-col gap-2 border-t border-black/5 pt-3 text-[12px] tracking-[-0.12px] text-[#7a7a7a]">
                      <div className="flex items-center justify-between">
                        <span>{formatDate(note.updated_at || note.created_at)}</span>
                        {folder && (
                          <span className="rounded-full bg-black/5 px-2 py-0.5 text-[11px] text-[#1d1d1f]">
                            <HiOutlineFolder aria-hidden="true" className="inline align-middle" /> {folder.name}
                          </span>
                        )}
                      </div>

                      {/* Bottom Quick Row */}
                      <div className="flex items-center justify-between pt-1">
                        {/* Collaborator chips */}
                        <div className="flex items-center -space-x-1">
                          {(notePeopleById[note.id] ?? []).slice(0, 3).map((p) => (
                            <span
                              key={p.user_id}
                              title={p.full_name || t('Kolaborator')}
                              className="flex h-6 w-6 items-center justify-center rounded-full border-2 border-white bg-[#f5f5f7] text-[10px] text-[#1d1d1f]"
                            >
                              {p.avatar_url ? (
                                <Image src={p.avatar_url} alt="" width={24} height={24} className="h-full w-full rounded-full object-cover" unoptimized />
                              ) : (
                                (p.full_name || t('Kolaborator')).slice(0, 1).toUpperCase()
                              )}
                            </span>
                          ))}
                        </div>

                        {/* Trash button */}
                        {note.user_id === user.id && (
                          <button
                            type="button"
                            aria-label={t("Pindahkan ke sampah")}
                            onClick={(e) => {
                              e.stopPropagation()
                              handleTrashToggle(note, true)
                            }}
                            className="text-[12px] text-[#0066cc] hover:underline active:scale-95"
                          >
                            {t("Buang")}
                          </button>
                        )}
                      </div>
                    </div>
                  </article>
                )
              })}
            </div>
          )
        ) : (
          /* Trashed Notes Grid */
          trashedNotes.length === 0 ? (
            <div className="py-24 text-center">
              <p className="text-[21px] font-semibold tracking-[-0.28px] text-[#1d1d1f]">{t("Sampah kosong")}</p>
              <p className="mt-2 text-[17px] leading-[1.47] tracking-[-0.374px] text-[#7a7a7a]">
                {t("Catatan yang kamu buang akan muncul di sini.")}
              </p>
            </div>
          ) : (
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 sm:gap-5 lg:grid-cols-3 lg:gap-6">
              {trashedNotes.map((note) => (
                <article
                  key={note.id}
                  data-note-card
                  className="flex min-w-0 flex-col justify-between rounded-[18px] border border-[#e0e0e0] bg-white p-6"
                >
                  <div>
                    <h3 className="truncate text-[17px] font-semibold tracking-[-0.374px] text-[#1d1d1f]">
                      {note.title || t('Tanpa Judul')}
                    </h3>
                    <p className="mt-2 line-clamp-3 text-[17px] font-normal leading-[1.47] tracking-[-0.374px] text-[#7a7a7a]">
                      {note.content || t('Tidak ada isi')}
                    </p>
                  </div>
                  <div className="mt-6 flex items-center justify-between border-t border-[#f0f0f0] pt-3 text-[14px]">
                    <button
                      type="button"
                      onClick={() => handleTrashToggle(note, false)}
                      className="text-[#0066cc] hover:underline active:scale-95"
                    >
                      {t("Pulihkan")}
                    </button>
                    <button
                      type="button"
                      onClick={() => handlePermanentDelete(note.id)}
                      className="text-[#ff3b30] hover:underline active:scale-95"
                    >
                      {t("Hapus Permanen")}
                    </button>
                  </div>
                </article>
              ))}
            </div>
          )
        )}
      </main>

      {/* 4. Desktop Note Editor Modal */}
      {formPresence.isPresent && (
        <div
          data-motion-state={formPresence.isExiting ? 'closing' : 'open'}
          inert={formPresence.isExiting}
          className="animate-modal-backdrop fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4 backdrop-blur-[2px]"
          onClick={(e) => {
            if (e.target === e.currentTarget) setIsFormOpen(false)
          }}
        >
          <div
            role="dialog"
            aria-modal="true"
            style={{ backgroundColor: accentColor }}
            className="animate-modal-enter w-full max-w-[680px] rounded-[18px] border border-[#e0e0e0] bg-white p-6 shadow-none"
          >
            <div className="flex items-center justify-between border-b border-black/5 pb-3">
              <span className="text-[14px] text-[#7a7a7a]">
                {editingNoteId ? t('Edit Catatan') : t('Catatan Baru')}
              </span>
              <button
                type="button"
                onClick={() => setIsFormOpen(false)}
                className="text-[14px] text-[#0066cc] active:scale-95"
              >
                {t("Tutup")}
              </button>
            </div>

            <form onSubmit={handleSaveModal} className="mt-4 space-y-4">
              <input
                type="text"
                autoFocus
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                placeholder={t("Judul Catatan")}
                className="w-full bg-transparent text-[24px] font-semibold tracking-[-0.374px] text-[#1d1d1f] placeholder-[#7a7a7a]/50 outline-none"
              />
              <textarea
                value={content}
                onChange={(e) => setContent(e.target.value)}
                placeholder={t("Tulis catatanmu di sini...")}
                rows={8}
                className="w-full resize-none bg-transparent text-[17px] font-normal leading-[1.47] tracking-[-0.374px] text-[#1d1d1f] placeholder-[#7a7a7a]/50 outline-none"
              />

              {/* Palette & Folders */}
              <div className="flex flex-wrap items-center justify-between gap-3 border-t border-black/5 pt-4">
                <div className="flex items-center gap-1.5">
                  {ACCENT_COLORS.map((c) => (
                    <button
                      key={c.hex}
                      type="button"
                      aria-label={t(c.label)}
                      onClick={() => setAccentColor(c.hex)}
                      className={`h-6 w-6 rounded-full border-2 transition-transform active:scale-95 ${
                        accentColor.toLowerCase() === c.hex.toLowerCase() ? 'border-[#0066cc] scale-110' : 'border-transparent'
                      }`}
                      style={{ backgroundColor: c.hex }}
                    />
                  ))}
                </div>

                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => setIsFormOpen(false)}
                    className="min-h-10 rounded-full px-4 text-[14px] text-[#0066cc] active:scale-95"
                  >
                    {t("Batal")}
                  </button>
                  <button
                    type="submit"
                    disabled={isSaving}
                    className="min-h-10 rounded-full bg-[#0066cc] px-5 text-[14px] font-normal text-white active:scale-95 focus-visible:outline-2 focus-visible:outline-[#0071e3] disabled:opacity-50"
                  >
                    {isSaving ? t('Menyimpan...') : t('Simpan')}
                  </button>
                </div>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  )
}

'use client'

import { useCallback, useEffect, useState } from 'react'
import type { User } from '@supabase/supabase-js'
import Image from 'next/image'
import { supabase } from '@/lib/supabaseClient'

// Interface Data Catatan sesuai Skema Supabase
interface Note {
  id: number
  user_id: string
  title: string
  content: string
  accent_color: string
  is_pinned: boolean
  is_trashed: boolean
  created_at: string
  updated_at: string
}

interface NoteDraft {
  title: string
  content: string
  accentColor: string
}

export default function Home() {
  const [user, setUser] = useState<User | null>(null)
  const [loading, setLoading] = useState(true)
  const [notes, setNotes] = useState<Note[]>([])
  const [activeTab, setActiveTab] = useState<'notes' | 'trash'>('notes')

  // State Form Catatan Baru / Edit
  const [title, setTitle] = useState('')
  const [content, setContent] = useState('')
  const [accentColor, setAccentColor] = useState('#ffffff')
  const [editingNoteId, setEditingNoteId] = useState<number | null>(null)
  const [isFormOpen, setIsFormOpen] = useState(false)
  const [isFormClosing, setIsFormClosing] = useState(false)
  const [lastSavedDraft, setLastSavedDraft] = useState<NoteDraft>({
    title: '',
    content: '',
    accentColor: '#ffffff',
  })
  const [saveStatus, setSaveStatus] = useState<'idle' | 'saving' | 'saved' | 'error'>('idle')
  const [pinAnimation, setPinAnimation] = useState<{ id: number; pinning: boolean } | null>(null)
  const [confirmation, setConfirmation] = useState<{ action: 'trash' | 'delete'; note: Note } | null>(null)

  const fetchNotes = async (userId: string) => {
    const { data, error } = await supabase
      .from('notes')
      .select('*')
      .eq('user_id', userId)
      .order('is_pinned', { ascending: false })
      .order('updated_at', { ascending: false })

    if (error) {
      console.error('Error fetching notes:', error.message)
    } else {
      setNotes(data || [])
    }
  }

  // Options Accent Color khas Apple Soft Pastel
  const colorOptions = [
    { label: 'White', value: '#ffffff' },
    { label: 'Parchment', value: '#f5f5f7' },
    { label: 'Soft Blue', value: '#e8f2ff' },
    { label: 'Soft Amber', value: '#fff8e6' },
    { label: 'Soft Mint', value: '#eafaf1' },
  ]

  // 1. Inisialisasi Auth & Auth Listener
  useEffect(() => {
    const initAuth = async () => {
      const { data: { session } } = await supabase.auth.getSession()
      setUser(session?.user ?? null)
      if (session?.user) {
        fetchNotes(session.user.id)
      }
      setLoading(false)
    }

    initAuth()

    const { data: authListener } = supabase.auth.onAuthStateChange((_event, session) => {
      const currentUser = session?.user ?? null
      setUser(currentUser)
      if (currentUser) {
        fetchNotes(currentUser.id)
      } else {
        setNotes([])
      }
      setLoading(false)
    })

    return () => {
      authListener.subscription.unsubscribe()
    }
  }, [])

  // Auth Functions
  const handleGoogleLogin = async () => {
    await supabase.auth.signInWithOAuth({
      provider: 'google',
      options: {
        redirectTo: `${window.location.origin}/`,
      },
    })
  }

  const handleLogout = async () => {
    await supabase.auth.signOut()
  }

  // 3. CRUD & Feature Handlers
  const handleSaveNote = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!user) return
    if (!title.trim() && !content.trim()) return

    const draft = { title, content, accentColor }
    let saveError = false
    if (editingNoteId) {
      const { error } = await supabase
        .from('notes')
        .update({
          title,
          content,
          accent_color: accentColor,
          updated_at: new Date().toISOString(),
        })
        .eq('id', editingNoteId)
        .eq('user_id', user.id)

      saveError = Boolean(error)
    } else {
      const { error } = await supabase.from('notes').insert({
        user_id: user.id,
        title,
        content,
        accent_color: accentColor,
      })
      saveError = Boolean(error)
    }

    if (saveError) {
      setSaveStatus('error')
      return
    }

    setLastSavedDraft(draft)
    setSaveStatus('saved')
    await fetchNotes(user.id)
    closeNoteForm()
    setEditingNoteId(null)
  }

  const handleEditClick = (note: Note) => {
    const draft = {
      title: note.title,
      content: note.content,
      accentColor: note.accent_color || '#ffffff',
    }
    setEditingNoteId(note.id)
    setTitle(draft.title)
    setContent(draft.content)
    setAccentColor(draft.accentColor)
    setLastSavedDraft(draft)
    setSaveStatus('idle')
    setIsFormOpen(true)
  }

  const openNewNote = () => {
    const emptyDraft = { title: '', content: '', accentColor: '#ffffff' }
    setEditingNoteId(null)
    setTitle(emptyDraft.title)
    setContent(emptyDraft.content)
    setAccentColor(emptyDraft.accentColor)
    setLastSavedDraft(emptyDraft)
    setSaveStatus('idle')
    setIsFormOpen(true)
  }

  const closeNoteForm = useCallback(() => {
    if (!isFormOpen || isFormClosing) return
    setIsFormClosing(true)
    window.setTimeout(() => {
      setIsFormOpen(false)
      setIsFormClosing(false)
    }, 180)
  }, [isFormClosing, isFormOpen])

  useEffect(() => {
    if (!isFormOpen || !user) return

    const draft = { title, content, accentColor }
    if (JSON.stringify(draft) === JSON.stringify(lastSavedDraft)) return

    const timeout = window.setTimeout(async () => {
      if (!draft.title.trim() && !draft.content.trim()) return
      setSaveStatus('saving')

      if (editingNoteId !== null) {
        const { error } = await supabase
          .from('notes')
          .update({
            title: draft.title,
            content: draft.content,
            accent_color: draft.accentColor,
            updated_at: new Date().toISOString(),
          })
          .eq('id', editingNoteId)
          .eq('user_id', user.id)

        if (error) {
          setSaveStatus('error')
          return
        }
      } else {
        const { data, error } = await supabase
          .from('notes')
          .insert({
            user_id: user.id,
            title: draft.title,
            content: draft.content,
            accent_color: draft.accentColor,
          })
          .select('id')
          .single()

        if (error || !data) {
          setSaveStatus('error')
          return
        }
        setEditingNoteId(data.id)
      }

      setLastSavedDraft(draft)
      setSaveStatus('saved')
      await fetchNotes(user.id)
    }, 5000)

    return () => window.clearTimeout(timeout)
  }, [accentColor, content, editingNoteId, isFormOpen, lastSavedDraft, title, user])

  useEffect(() => {
    if (!isFormOpen && !confirmation) return
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        closeNoteForm()
        setConfirmation(null)
      }
    }
    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [closeNoteForm, confirmation, isFormOpen, isFormClosing])

  const togglePin = async (note: Note) => {
    if (!user) return
    setPinAnimation({ id: note.id, pinning: !note.is_pinned })
    window.setTimeout(() => setPinAnimation(null), 500)
    const { error } = await supabase
      .from('notes')
      .update({ is_pinned: !note.is_pinned, updated_at: new Date().toISOString() })
      .eq('id', note.id)
      .eq('user_id', user.id)

    if (!error) fetchNotes(user.id)
  }

  const toggleTrash = async (note: Note) => {
    if (!user) return
    const { error } = await supabase
      .from('notes')
      .update({ is_trashed: !note.is_trashed, updated_at: new Date().toISOString() })
      .eq('id', note.id)
      .eq('user_id', user.id)

    if (!error) fetchNotes(user.id)
  }

  const deletePermanently = async (note: Note) => {
    if (!user) return
    const { error } = await supabase
      .from('notes')
      .delete()
      .eq('id', note.id)
      .eq('user_id', user.id)
    if (!error) fetchNotes(user.id)
  }

  const confirmDestructiveAction = async () => {
    if (!confirmation) return
    const { action, note } = confirmation
    setConfirmation(null)
    if (action === 'trash') await toggleTrash(note)
    else await deletePermanently(note)
  }

  const formatDate = (dateStr: string) => {
    const d = new Date(dateStr)
    return d.toLocaleDateString('id-ID', {
      day: 'numeric',
      month: 'short',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    })
  }

  // Filter Notes berdasarkan Tab
  const activeNotes = notes.filter((n) => !n.is_trashed)
  const trashedNotes = notes.filter((n) => n.is_trashed)

  if (loading) {
    return (
      <main className="min-h-screen bg-[#f5f5f7] flex items-center justify-center font-sans">
        <p className="text-[#1d1d1f] text-[17px] font-normal tracking-[-0.374px]">Memuat Notes...</p>
      </main>
    )
  }

  // --- 1. LANDING / LOGIN PAGE (Apple Style Tile) ---
  if (!user) {
    return (
      <main className="min-h-screen bg-[#ffffff] text-[#1d1d1f] flex flex-col font-sans">
        {/* Global Nav Bar (Pure Black) */}
        <header className="h-[44px] bg-[#000000] text-white flex items-center justify-between px-8 text-[12px] font-normal tracking-[-0.12px]">
          <span className="font-semibold text-sm"> Notes</span>
          <span>Web App</span>
        </header>

        {/* Hero Product Tile (Parchment Canvas) */}
        <div className="flex-1 bg-[#f5f5f7] flex flex-col items-center justify-center p-8 text-center">
          <h1 className="text-[40px] md:text-[56px] font-semibold text-[#1d1d1f] tracking-[-0.374px] leading-[1.07] mb-3">
            Catatanmu. Rapi & Elegan.
          </h1>
          <p className="text-[21px] md:text-[28px] text-[#7a7a7a] font-normal tracking-[0.196px] max-w-xl mb-8">
            Simpan ide, rencana, dan pemikiran penting dalam ruang kerja yang dirancang tanpa gangguan.
          </p>

          {/* Primary Blue Pill CTA */}
          <button
            onClick={handleGoogleLogin}
            className="flex items-center gap-3 bg-[#0066cc] text-white text-[17px] font-normal px-[22px] py-[11px] rounded-full hover:bg-[#0071e3] active:scale-95 transition-all duration-150"
          >
            <svg aria-hidden="true" viewBox="0 0 48 48" className="h-5 w-5 rounded-full bg-white p-[3px]">
              <path fill="#4285F4" d="M43.6 24.5c0-1.4-.1-2.8-.4-4.1H24v7.8h11a9.4 9.4 0 0 1-4.1 6.2v5h6.6c3.9-3.6 6.1-8.8 6.1-14.9Z" />
              <path fill="#34A853" d="M24 44c5.5 0 10.1-1.8 13.5-4.8l-6.6-5c-1.8 1.2-4.1 2-6.9 2-5.3 0-9.8-3.6-11.4-8.4H5.8v5.2A20 20 0 0 0 24 44Z" />
              <path fill="#FBBC05" d="M12.6 27.8a12 12 0 0 1 0-7.6V15H5.8a20 20 0 0 0 0 18l6.8-5.2Z" />
              <path fill="#EA4335" d="M24 11.8c3 0 5.7 1 7.8 3l5.8-5.8C34.1 5.7 29.5 4 24 4A20 20 0 0 0 5.8 15l6.8 5.2c1.6-4.8 6.1-8.4 11.4-8.4Z" />
            </svg>
            Masuk dengan Google
          </button>
        </div>
      </main>
    )
  }

  // --- 2. MAIN DASHBOARD PAGE (Apple Design System) ---
  return (
    <div className="min-h-screen bg-[#f5f5f7] text-[#1d1d1f] font-sans flex flex-col selection:bg-[#0066cc] selection:text-white animate-dashboard-enter">
      {/* Global Thin Nav Bar */}
      <header className="h-[44px] bg-[#000000] text-white flex items-center justify-between px-6 md:px-12 text-[12px] tracking-[-0.12px] sticky top-0 z-50">
        <div className="flex items-center gap-2">
          <span className="text-base"></span>
          <span className="font-semibold tracking-normal">Notes</span>
        </div>

        {/* Google Profile Header (Ujung Kanan) */}
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-2">
            {user.user_metadata?.avatar_url && (
              <Image
                src={user.user_metadata.avatar_url}
                alt="Profile"
                width={24}
                height={24}
                unoptimized
                className="h-6 w-6 rounded-full border border-white/20 object-cover"
              />
            )}
            <span className="hidden sm:inline text-white/90 font-medium">
              {user.user_metadata?.full_name || user.email}
            </span>
          </div>
          <button
            onClick={handleLogout}
            className="bg-[#1d1d1f] hover:bg-zinc-800 text-white text-[12px] px-3 py-1 rounded-[8px] active:scale-95 transition-all"
          >
            Keluar
          </button>
        </div>
      </header>

      {/* Sub-Nav Frosted Glass */}
      <nav className="h-[52px] bg-[#f5f5f7]/80 backdrop-blur-md border-b border-[#e0e0e0] sticky top-[44px] z-40 flex items-center justify-between px-6 md:px-12">
        <div className="flex items-center gap-6">
          <span className="text-[21px] font-semibold tracking-[0.231px] text-[#1d1d1f]">
            {activeTab === 'notes' ? 'Catatan Saya' : 'Sampah'}
          </span>
          <div className="flex gap-2">
            <button
              onClick={() => setActiveTab('notes')}
              className={`text-[14px] px-3 py-1 rounded-full transition-all ${
                activeTab === 'notes' ? 'bg-[#1d1d1f] text-white' : 'text-[#7a7a7a] hover:text-[#1d1d1f]'
              }`}
            >
              Utama ({activeNotes.length})
            </button>
            <button
              onClick={() => setActiveTab('trash')}
              className={`text-[14px] px-3 py-1 rounded-full transition-all ${
                activeTab === 'trash' ? 'bg-[#1d1d1f] text-white' : 'text-[#7a7a7a] hover:text-[#1d1d1f]'
              }`}
            >
              Sampah ({trashedNotes.length})
            </button>
          </div>
        </div>

        {activeTab === 'notes' && (
          <button
            onClick={() => {
              if (isFormOpen) closeNoteForm()
              else openNewNote()
            }}
            className="bg-[#0066cc] text-white text-[14px] font-normal px-4 py-2 rounded-full hover:bg-[#0071e3] active:scale-95 transition-all"
          >
            {isFormOpen ? 'Tutup Form' : '+ Catatan Baru'}
          </button>
        )}
      </nav>

      {/* Content Area */}
      <main className="flex-1 max-w-[1440px] w-full mx-auto px-6 md:px-12 py-8">
        {/* Note editor modal */}
        {isFormOpen && activeTab === 'notes' && (
          <div
            className={`fixed inset-0 z-[60] flex items-center justify-center bg-black/35 p-4 backdrop-blur-[3px] ${isFormClosing ? 'animate-modal-backdrop-exit' : 'animate-modal-backdrop'}`}
            onMouseDown={(event) => {
              if (event.target === event.currentTarget) closeNoteForm()
            }}
          >
            <form
              onSubmit={handleSaveNote}
              style={{ backgroundColor: accentColor }}
              role="dialog"
              aria-modal="true"
              aria-labelledby="note-editor-title"
              className={`w-full max-w-[680px] max-h-[min(82vh,760px)] overflow-y-auto p-6 sm:p-8 rounded-[18px] border border-[#e0e0e0] ${isFormClosing ? 'animate-modal-exit' : 'animate-modal-enter'}`}
            >
              <div className="mb-6 flex items-start justify-between gap-4">
                <div>
                  <h2 id="note-editor-title" className="text-[21px] leading-[1.2] font-semibold text-[#1d1d1f]">
                    {editingNoteId ? 'Edit Catatan' : 'Buat Catatan Baru'}
                  </h2>
                  <p aria-live="polite" className="mt-2 min-h-5 text-[12px] text-[#7a7a7a]">
                    {saveStatus === 'saving' && 'Menyimpan...'}
                    {saveStatus === 'saved' && '✓ Autosave complete'}
                    {saveStatus === 'error' && 'Gagal menyimpan. Periksa koneksi lalu coba lagi.'}
                  </p>
                </div>
                <button
                  type="button"
                  aria-label="Tutup editor"
                  onClick={closeNoteForm}
                  className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full text-[24px] text-[#7a7a7a] transition-colors hover:bg-black/5 active:scale-95"
                >
                  ×
                </button>
              </div>
              <input
                autoFocus
                type="text"
                placeholder="Judul Catatan..."
                value={title}
                onChange={(e) => {
                  setTitle(e.target.value)
                  setSaveStatus('idle')
                }}
                className="w-full border-b border-[#e0e0e0] bg-transparent pb-3 mb-5 text-[21px] font-semibold text-[#1d1d1f] focus:outline-none"
              />
              <textarea
                placeholder="Tulis isi catatan di sini..."
                value={content}
                onChange={(e) => {
                  setContent(e.target.value)
                  setSaveStatus('idle')
                }}
                rows={10}
                className="mb-6 min-h-[240px] w-full resize-y bg-transparent text-[17px] leading-[1.47] text-[#1d1d1f] focus:outline-none"
              />
              <div className="flex flex-wrap items-center justify-between gap-4 border-t border-[#f0f0f0] pt-5">
                <div className="flex flex-wrap items-center gap-3">
                  <span className="text-[12px] text-[#7a7a7a]">Aksen warna</span>
                  {colorOptions.map((color) => (
                    <button
                      key={color.value}
                      type="button"
                      aria-label={color.label}
                      aria-pressed={accentColor === color.value}
                      onClick={() => {
                        setAccentColor(color.value)
                        setSaveStatus('idle')
                      }}
                      style={{ backgroundColor: color.value }}
                      className={`h-7 w-7 rounded-full border border-black/10 transition-transform active:scale-95 ${
                        accentColor === color.value ? 'ring-2 ring-[#0066cc] ring-offset-2' : ''
                      }`}
                    />
                  ))}
                </div>
                <div className="ml-auto flex gap-2">
                  <button
                    type="button"
                    onClick={closeNoteForm}
                    className="min-h-11 rounded-full px-4 text-[14px] text-[#7a7a7a] transition-colors hover:bg-black/5 active:scale-95"
                  >
                    Tutup
                  </button>
                  <button
                    type="submit"
                    className="min-h-11 rounded-full bg-[#0066cc] px-[22px] text-[14px] text-white transition-all hover:bg-[#0071e3] active:scale-95"
                  >
                    Simpan
                  </button>
                </div>
              </div>
            </form>
          </div>
        )}

        {/* TAB 1: UTAMA (Active Notes) */}
        {activeTab === 'notes' && (
          <div key="notes-tab" className="animate-tab-enter">
            {activeNotes.length === 0 ? (
              <div className="text-center py-20 text-[#7a7a7a]">
                <p className="text-[21px] font-semibold mb-2">Belum ada catatan</p>
                <p className="text-[17px]">Klik &quot;+ Catatan Baru&quot; di atas untuk mulai menulis.</p>
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                {activeNotes.map((note) => (
                  <article
                    key={note.id}
                    style={{ backgroundColor: note.accent_color || '#ffffff' }}
                    role="button"
                    tabIndex={0}
                    aria-label={`Buka catatan ${note.title || 'Tanpa Judul'}`}
                    onClick={() => handleEditClick(note)}
                    onKeyDown={(event) => {
                      if (event.key === 'Enter' || event.key === ' ') {
                        event.preventDefault()
                        handleEditClick(note)
                      }
                    }}
                    className="relative group flex cursor-pointer flex-col justify-between rounded-[18px] border border-[#e0e0e0] p-6 transition-all duration-200 hover:border-[#0066cc]/40 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#0071e3]"
                  >
                    <div>
                      <div className="flex items-start justify-between mb-2 gap-2">
                        <h3 className="text-[17px] font-semibold text-[#1d1d1f] tracking-[-0.374px] line-clamp-1">
                          {note.title || 'Tanpa Judul'}
                        </h3>
                        {/* Pin Button */}
                        <button
                          aria-label={note.is_pinned ? 'Lepas pin catatan' : 'Pin catatan'}
                          onClick={(event) => {
                            event.stopPropagation()
                            togglePin(note)
                          }}
                          className={`min-h-11 px-3 py-1 rounded-full text-xs transition-all ${
                            note.is_pinned
                              ? 'bg-[#0066cc] text-white'
                              : 'bg-black/5 text-[#7a7a7a] sm:opacity-0 sm:group-hover:opacity-100'
                          } ${pinAnimation?.id === note.id ? (pinAnimation.pinning ? 'animate-pin-on' : 'animate-pin-off') : ''}`}
                        >
                          <span aria-hidden="true" className="mr-1 inline-block">{note.is_pinned ? '📌' : '⌖'}</span>
                          {note.is_pinned ? 'Pinned' : 'Pin'}
                        </button>
                      </div>

                      <p className="text-[17px] text-[#1d1d1f]/80 leading-[1.47] line-clamp-4 mb-6 whitespace-pre-wrap">
                        {note.content || 'Gak ada isi teks...'}
                      </p>
                    </div>

                    <div className="border-t border-black/5 pt-3 flex items-center justify-between text-[12px] text-[#7a7a7a]">
                      <div>
                        <div>Dibuat: {formatDate(note.created_at)}</div>
                        <div>Edit: {formatDate(note.updated_at)}</div>
                      </div>

                      <div className="flex items-center gap-2">
                        <button
                          onClick={(event) => {
                            event.stopPropagation()
                            handleEditClick(note)
                          }}
                          className="min-h-11 px-2 text-[#0066cc] hover:underline"
                        >
                          Edit
                        </button>
                        <button
                          onClick={(event) => {
                            event.stopPropagation()
                            setConfirmation({ action: 'trash', note })
                          }}
                          className="min-h-11 px-2 text-[#0066cc] hover:underline"
                        >
                          Buang
                        </button>
                      </div>
                    </div>
                  </article>
                ))}
              </div>
            )}
          </div>
        )}

        {/* TAB 2: SAMPAH (Trashed Notes) */}
        {activeTab === 'trash' && (
          <div key="trash-tab" className="animate-tab-enter">
            {trashedNotes.length === 0 ? (
              <div className="text-center py-20 text-[#7a7a7a]">
                <p className="text-[21px] font-semibold mb-2">Tong sampah kosong</p>
                <p className="text-[17px]">Tidak ada catatan yang dibuang.</p>
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                {trashedNotes.map((note) => (
                  <div
                    key={note.id}
                    className="bg-[#ffffff] p-6 rounded-[18px] border border-[#e0e0e0] flex flex-col justify-between opacity-80"
                  >
                    <div>
                      <h3 className="text-[17px] font-semibold text-[#1d1d1f] mb-2 line-clamp-1">
                        {note.title || 'Tanpa Judul'}
                      </h3>
                      <p className="text-[17px] text-[#7a7a7a] line-clamp-3 mb-4">
                        {note.content}
                      </p>
                    </div>

                    <div className="border-t border-[#f0f0f0] pt-3 flex items-center justify-between text-[12px]">
                      <span className="text-[#7a7a7a]">Dibuang</span>
                      <div className="flex gap-3">
                        <button
                          onClick={() => toggleTrash(note)}
                          className="text-[#0066cc] font-medium hover:underline"
                        >
                          Pulihkan
                        </button>
                        <button
                          onClick={() => setConfirmation({ action: 'delete', note })}
                          className="min-h-11 px-2 font-medium text-[#0066cc] hover:underline"
                        >
                          Hapus Permanen
                        </button>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {confirmation && (
          <div
            className="fixed inset-0 z-[70] flex items-center justify-center bg-black/35 p-4 backdrop-blur-[3px] animate-modal-backdrop"
            onMouseDown={(event) => {
              if (event.target === event.currentTarget) setConfirmation(null)
            }}
          >
            <section
              role="alertdialog"
              aria-modal="true"
              aria-labelledby="confirmation-title"
              aria-describedby="confirmation-description"
              className="w-full max-w-[420px] rounded-[18px] border border-[#e0e0e0] bg-white p-6 sm:p-7 animate-confirm-enter"
            >
              <div className="mb-5 flex h-11 w-11 items-center justify-center rounded-full bg-[#f5f5f7] text-[21px] font-semibold text-[#0066cc]" aria-hidden="true">
                {confirmation.action === 'trash' ? '↘' : '×'}
              </div>
              <h2 id="confirmation-title" className="text-[21px] font-semibold leading-[1.2] tracking-[-0.2px] text-[#1d1d1f]">
                {confirmation.action === 'trash' ? 'Pindahkan ke Tong Sampah?' : 'Hapus Catatan Permanen?'}
              </h2>
              <p id="confirmation-description" className="mt-3 text-[17px] leading-[1.47] text-[#1d1d1f]">
                {confirmation.action === 'trash'
                  ? `“${confirmation.note.title || 'Tanpa Judul'}” akan dipindahkan ke tong sampah. Kamu masih bisa memulihkannya nanti.`
                  : `“${confirmation.note.title || 'Tanpa Judul'}” akan dihapus selamanya dan tidak dapat dipulihkan.`}
              </p>
              <div className="mt-7 flex justify-end gap-3">
                <button
                  type="button"
                  autoFocus
                  onClick={() => setConfirmation(null)}
                  className="min-h-11 rounded-full px-[18px] text-[14px] text-[#0066cc] transition-colors hover:bg-[#f5f5f7] active:scale-95"
                >
                  Batal
                </button>
                <button
                  type="button"
                  onClick={confirmDestructiveAction}
                  className="min-h-11 rounded-full bg-[#0066cc] px-[20px] text-[14px] text-white transition-all hover:bg-[#0071e3] active:scale-95"
                >
                  {confirmation.action === 'trash' ? 'Pindahkan' : 'Hapus Permanen'}
                </button>
              </div>
            </section>
          </div>
        )}
      </main>
    </div>
  )
}
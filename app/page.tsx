'use client'

import { useEffect, useState } from 'react'
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

export default function Home() {
  const [user, setUser] = useState<any>(null)
  const [loading, setLoading] = useState(true)
  const [notes, setNotes] = useState<Note[]>([])
  const [activeTab, setActiveTab] = useState<'notes' | 'trash'>('notes')

  // State Form Catatan Baru / Edit
  const [title, setTitle] = useState('')
  const [content, setContent] = useState('')
  const [accentColor, setAccentColor] = useState('#ffffff')
  const [editingNoteId, setEditingNoteId] = useState<number | null>(null)
  const [isFormOpen, setIsFormOpen] = useState(false)

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

  // 2. Fetch Catatan milik User
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
    if (!title.trim() && !content.trim()) return

    if (editingNoteId) {
      // Update Existing Note
      const { error } = await supabase
        .from('notes')
        .update({
          title,
          content,
          accent_color: accentColor,
          updated_at: new Date().toISOString(),
        })
        .eq('id', editingNoteId)

      if (!error && user) fetchNotes(user.id)
    } else {
      // Create New Note
      const { error } = await supabase.from('notes').insert([
        {
          user_id: user.id,
          title,
          content,
          accent_color: accentColor,
        },
      ])

      if (!error && user) fetchNotes(user.id)
    }

    // Reset Form
    setTitle('')
    setContent('')
    setAccentColor('#ffffff')
    setEditingNoteId(null)
    setIsFormOpen(false)
  }

  const handleEditClick = (note: Note) => {
    setEditingNoteId(note.id)
    setTitle(note.title)
    setContent(note.content)
    setAccentColor(note.accent_color || '#ffffff')
    setIsFormOpen(true)
  }

  const togglePin = async (note: Note) => {
    const { error } = await supabase
      .from('notes')
      .update({ is_pinned: !note.is_pinned, updated_at: new Date().toISOString() })
      .eq('id', note.id)

    if (!error && user) fetchNotes(user.id)
  }

  const toggleTrash = async (note: Note) => {
    const { error } = await supabase
      .from('notes')
      .update({ is_trashed: !note.is_trashed, updated_at: new Date().toISOString() })
      .eq('id', note.id)

    if (!error && user) fetchNotes(user.id)
  }

  const deletePermanently = async (id: number) => {
    const { error } = await supabase.from('notes').delete().eq('id', id)
    if (!error && user) fetchNotes(user.id)
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
            className="bg-[#0066cc] text-white text-[17px] font-normal px-[22px] py-[11px] rounded-full hover:bg-[#0071e3] active:scale-95 transition-all duration-150 shadow-sm"
          >
            Masuk dengan Google
          </button>
        </div>
      </main>
    )
  }

  // --- 2. MAIN DASHBOARD PAGE (Apple Design System) ---
  return (
    <div className="min-h-screen bg-[#f5f5f7] text-[#1d1d1f] font-sans flex flex-col selection:bg-[#0066cc] selection:text-white">
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
              <img
                src={user.user_metadata.avatar_url}
                alt="Profile"
                className="w-6 h-6 rounded-full border border-white/20 object-cover"
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
              setEditingNoteId(null)
              setTitle('')
              setContent('')
              setAccentColor('#ffffff')
              setIsFormOpen(!isFormOpen)
            }}
            className="bg-[#0066cc] text-white text-[14px] font-normal px-4 py-1.5 rounded-full hover:bg-[#0071e3] active:scale-95 transition-all shadow-sm"
          >
            {isFormOpen ? 'Tutup Form' : '+ Catatan Baru'}
          </button>
        )}
      </nav>

      {/* Content Area */}
      <main className="flex-1 max-w-[1440px] w-full mx-auto px-6 md:px-12 py-8">
        {/* Form Modal / Inline Input (Apple Card) */}
        {isFormOpen && activeTab === 'notes' && (
          <form
            onSubmit={handleSaveNote}
            style={{ backgroundColor: accentColor }}
            className="mb-10 p-6 rounded-[18px] border border-[#e0e0e0] shadow-sm transition-all duration-200 max-w-2xl mx-auto"
          >
            <h2 className="text-[17px] font-semibold mb-4 text-[#1d1d1f]">
              {editingNoteId ? 'Edit Catatan' : 'Buat Catatan Baru'}
            </h2>
            <input
              type="text"
              placeholder="Judul Catatan..."
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              className="w-full text-[17px] font-semibold bg-transparent border-b border-[#e0e0e0] pb-2 mb-4 focus:outline-none text-[#1d1d1f]"
            />
            <textarea
              placeholder="Tulis isi catatan di sini..."
              value={content}
              onChange={(e) => setContent(e.target.value)}
              rows={4}
              className="w-full text-[17px] leading-[1.47] bg-transparent focus:outline-none text-[#1d1d1f] resize-none mb-4"
            />

            {/* Selection Accent Color */}
            <div className="flex items-center justify-between border-t border-[#f0f0f0] pt-4">
              <div className="flex items-center gap-2">
                <span className="text-[12px] text-[#7a7a7a]">Aksen Warna:</span>
                {colorOptions.map((c) => (
                  <button
                    key={c.value}
                    type="button"
                    onClick={() => setAccentColor(c.value)}
                    style={{ backgroundColor: c.value }}
                    className={`w-6 h-6 rounded-full border border-black/10 transition-all ${
                      accentColor === c.value ? 'ring-2 ring-[#0066cc] scale-110' : ''
                    }`}
                  />
                ))}
              </div>

              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={() => setIsFormOpen(false)}
                  className="px-4 py-1.5 rounded-full text-[14px] text-[#7a7a7a] hover:bg-black/5"
                >
                  Batal
                </button>
                <button
                  type="submit"
                  className="bg-[#0066cc] text-white px-5 py-1.5 rounded-full text-[14px] hover:bg-[#0071e3] active:scale-95 transition-all"
                >
                  Simpan
                </button>
              </div>
            </div>
          </form>
        )}

        {/* TAB 1: UTAMA (Active Notes) */}
        {activeTab === 'notes' && (
          <div>
            {activeNotes.length === 0 ? (
              <div className="text-center py-20 text-[#7a7a7a]">
                <p className="text-[21px] font-semibold mb-2">Belum ada catatan</p>
                <p className="text-[17px]">Klik "+ Catatan Baru" di atas untuk mulai menulis.</p>
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                {activeNotes.map((note) => (
                  <div
                    key={note.id}
                    style={{ backgroundColor: note.accent_color || '#ffffff' }}
                    className="relative group p-6 rounded-[18px] border border-[#e0e0e0] flex flex-col justify-between transition-all duration-200 hover:border-[#0066cc]/40"
                  >
                    <div>
                      <div className="flex items-start justify-between mb-2 gap-2">
                        <h3 className="text-[17px] font-semibold text-[#1d1d1f] tracking-[-0.374px] line-clamp-1">
                          {note.title || 'Tanpa Judul'}
                        </h3>
                        {/* Pin Button */}
                        <button
                          onClick={() => togglePin(note)}
                          className={`text-xs px-2 py-1 rounded-full transition-all ${
                            note.is_pinned
                              ? 'bg-[#0066cc] text-white'
                              : 'bg-black/5 text-[#7a7a7a] opacity-0 group-hover:opacity-100'
                          }`}
                        >
                          {note.is_pinned ? '📌 Pinned' : 'Pin'}
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
                          onClick={() => handleEditClick(note)}
                          className="text-[#0066cc] hover:underline"
                        >
                          Edit
                        </button>
                        <button
                          onClick={() => toggleTrash(note)}
                          className="text-red-500 hover:underline"
                        >
                          Buang
                        </button>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* TAB 2: SAMPAH (Trashed Notes) */}
        {activeTab === 'trash' && (
          <div>
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
                          onClick={() => deletePermanently(note.id)}
                          className="text-red-600 font-medium hover:underline"
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
      </main>
    </div>
  )
}
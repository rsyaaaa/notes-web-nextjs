'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
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
  folder_id: number | null
  is_pinned: boolean
  is_trashed: boolean
  created_at: string
  updated_at: string
}

interface NoteDraft {
  title: string
  content: string
  accentColor: string
  folderId: string
}

interface UserProfile {
  full_name: string
  avatar_url: string | null
  plan: 'free' | 'premium'
  premium_expires_at: string | null
}

interface NotePerson {
  user_id: string
  full_name: string
  avatar_url: string | null
}

export default function Home() {
  const [user, setUser] = useState<User | null>(null)
  const [loading, setLoading] = useState(true)
  const [notes, setNotes] = useState<Note[]>([])
  const [activeTab, setActiveTab] = useState<'notes' | 'trash'>('notes')
  const [profile, setProfile] = useState<UserProfile | null>(null)
  const [isPremiumOfferOpen, setIsPremiumOfferOpen] = useState(false)
  const [offerMessage, setOfferMessage] = useState('')
  const [isActivatingPremium, setIsActivatingPremium] = useState(false)
  const [premiumSuccessExpiry, setPremiumSuccessExpiry] = useState<string | null>(null)
  const [premiumDetailOpen, setPremiumDetailOpen] = useState(false)
  const [lastOfferUserId, setLastOfferUserId] = useState<string | null>(null)
  const [currentTime, setCurrentTime] = useState(0)
  const [folders, setFolders] = useState<{ id: number; name: string }[]>([])
  const [folderFilter, setFolderFilter] = useState('all')
  const [selectedFolderId, setSelectedFolderId] = useState('')
  const [folderName, setFolderName] = useState('')
  const [isCreatingFolder, setIsCreatingFolder] = useState(false)
  const [premiumMessage, setPremiumMessage] = useState('')
  const [authMode, setAuthMode] = useState<'login' | 'register'>('login')
  const [authName, setAuthName] = useState('')
  const [authEmail, setAuthEmail] = useState('')
  const [authPassword, setAuthPassword] = useState('')
  const [showAuthPassword, setShowAuthPassword] = useState(false)
  const [authMessage, setAuthMessage] = useState('')
  const [isAuthSubmitting, setIsAuthSubmitting] = useState(false)
  const [isProfileMenuOpen, setIsProfileMenuOpen] = useState(false)
  const [isDarkMode, setIsDarkMode] = useState(false)
  const [isSettingsOpen, setIsSettingsOpen] = useState(false)
  const [settingsName, setSettingsName] = useState('')
  const [settingsPassword, setSettingsPassword] = useState('')
  const [showSettingsPassword, setShowSettingsPassword] = useState(false)
  const [settingsMessage, setSettingsMessage] = useState('')
  const [isSettingsSaving, setIsSettingsSaving] = useState(false)
  const [noteMembers, setNoteMembers] = useState<NotePerson[]>([])
  const [onlineMembers, setOnlineMembers] = useState<NotePerson[]>([])
  const [inviteEmail, setInviteEmail] = useState('')
  const [sharingMessage, setSharingMessage] = useState('')
  const currentDraftRef = useRef<NoteDraft>({ title: '', content: '', accentColor: '#ffffff', folderId: '' })
  const savedDraftRef = useRef<NoteDraft>({ title: '', content: '', accentColor: '#ffffff', folderId: '' })
  const noteTitleInputRef = useRef<HTMLInputElement>(null)

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
    folderId: '',
  })
  const [saveStatus, setSaveStatus] = useState<'idle' | 'saving' | 'saved' | 'error'>('idle')
  const [pinAnimation, setPinAnimation] = useState<{ id: number; pinning: boolean } | null>(null)
  const [confirmation, setConfirmation] = useState<{ action: 'trash' | 'delete'; note: Note } | null>(null)

  useEffect(() => {
    const storedTheme = window.localStorage.getItem('notes-theme')
    const shouldUseDarkMode = storedTheme === 'dark'
    document.documentElement.dataset.theme = shouldUseDarkMode ? 'dark' : 'light'
    const frame = window.requestAnimationFrame(() => setIsDarkMode(shouldUseDarkMode))
    return () => window.cancelAnimationFrame(frame)
  }, [])

  const toggleDarkMode = () => {
    const nextMode = !isDarkMode
    setIsDarkMode(nextMode)
    window.localStorage.setItem('notes-theme', nextMode ? 'dark' : 'light')
    document.documentElement.dataset.theme = nextMode ? 'dark' : 'light'
  }

  const fetchNotes = async (userId: string) => {
    const { data: memberships, error: membershipError } = await supabase
      .from('note_members')
      .select('note_id')
      .eq('user_id', userId)

    if (membershipError) {
      console.error('Error fetching shared notes:', membershipError.message)
      return
    }

    const sharedIds = (memberships ?? []).map((membership) => membership.note_id)
    const visibilityFilter = sharedIds.length > 0
      ? `user_id.eq.${userId},id.in.(${sharedIds.join(',')})`
      : `user_id.eq.${userId}`
    const { data, error } = await supabase
      .from('notes')
      .select('*')
      .or(visibilityFilter)
      .order('is_pinned', { ascending: false })
      .order('updated_at', { ascending: false })

    if (error) {
      console.error('Error fetching notes:', error.message)
    } else {
      setNotes(data || [])
    }
  }

  const fetchProfile = useCallback(async (currentUser: User) => {
    const { data, error } = await supabase
      .from('profiles')
      .select('full_name, avatar_url, plan, premium_expires_at')
      .eq('id', currentUser.id)
      .maybeSingle()

    if (error) {
      console.error('Error fetching profile:', error.message)
      return
    }

    const nextProfile: UserProfile = data ?? {
      full_name: currentUser.user_metadata?.full_name ?? currentUser.user_metadata?.name ?? '',
      avatar_url: currentUser.user_metadata?.avatar_url ?? null,
      plan: 'free',
      premium_expires_at: null,
    }
    setProfile(nextProfile)
    setSettingsName(nextProfile.full_name)
    const hasActivePremium = nextProfile.plan === 'premium'
      && Boolean(nextProfile.premium_expires_at)
      && new Date(nextProfile.premium_expires_at as string).getTime() > Date.now()
    if (!hasActivePremium && lastOfferUserId !== currentUser.id) {
      setLastOfferUserId(currentUser.id)
      setIsPremiumOfferOpen(true)
    }
  }, [lastOfferUserId])

  const fetchFolders = async (userId: string) => {
    const { data, error } = await supabase
      .from('note_folders')
      .select('id, name')
      .eq('user_id', userId)
      .order('name')

    if (!error) setFolders(data ?? [])
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
        fetchProfile(session.user)
        fetchFolders(session.user.id)
      }
      setLoading(false)
    }

    initAuth()

    const { data: authListener } = supabase.auth.onAuthStateChange((_event, session) => {
      const currentUser = session?.user ?? null
      setUser(currentUser)
      if (currentUser) {
        fetchNotes(currentUser.id)
        fetchProfile(currentUser)
        fetchFolders(currentUser.id)
      } else {
        setNotes([])
        setProfile(null)
        setFolders([])
        setLastOfferUserId(null)
      }
      setLoading(false)
    })

    return () => {
      authListener.subscription.unsubscribe()
    }
  }, [fetchProfile])

  // Auth Functions
  const handleGoogleLogin = async () => {
    const { error } = await supabase.auth.signInWithOAuth({
      provider: 'google',
      options: {
        redirectTo: `${window.location.origin}/`,
      },
    })
    if (error) setAuthMessage(error.message)
  }

  const handleEmailAuth = async (event: React.FormEvent) => {
    event.preventDefault()
    setIsAuthSubmitting(true)
    setAuthMessage('')

    const result = authMode === 'register'
      ? await supabase.auth.signUp({
          email: authEmail,
          password: authPassword,
          options: { data: { full_name: authName.trim() } },
        })
      : await supabase.auth.signInWithPassword({ email: authEmail, password: authPassword })

    if (result.error) {
      setAuthMessage(result.error.message)
    } else if (authMode === 'register' && !result.data.session) {
      setAuthMessage('Akun berhasil dibuat. Periksa email untuk konfirmasi sebelum masuk.')
    }
    setIsAuthSubmitting(false)
  }

  const handleLogout = async () => {
    await supabase.auth.signOut()
  }

  const handleSaveSettings = async (event: React.FormEvent) => {
    event.preventDefault()
    if (!user) return
    setIsSettingsSaving(true)
    setSettingsMessage('')

    const { error: profileError } = await supabase
      .from('profiles')
      .update({ full_name: settingsName.trim() })
      .eq('id', user.id)
    if (profileError) {
      setSettingsMessage(profileError.message)
      setIsSettingsSaving(false)
      return
    }

    const providers = (user.app_metadata?.providers as string[] | undefined) ?? []
    if (settingsPassword && providers.includes('email')) {
      const { error: passwordError } = await supabase.auth.updateUser({ password: settingsPassword })
      if (passwordError) {
        setSettingsMessage(passwordError.message)
        setIsSettingsSaving(false)
        return
      }
      setSettingsPassword('')
    }

    await fetchProfile(user)
    setSettingsMessage('Pengaturan akun tersimpan.')
    setIsSettingsSaving(false)
  }

  const handleAvatarUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
    if (!user) return
    const file = event.target.files?.[0]
    if (!file) return
    if (!file.type.startsWith('image/') || file.size > 5 * 1024 * 1024) {
      setSettingsMessage('Pilih gambar dengan ukuran maksimal 5 MB.')
      return
    }

    setIsSettingsSaving(true)
    const extension = file.name.split('.').pop()?.toLowerCase() || 'png'
    const path = `${user.id}/avatar-${Date.now()}.${extension}`
    const { error: uploadError } = await supabase.storage.from('avatars').upload(path, file, { upsert: true })
    if (uploadError) {
      setSettingsMessage(uploadError.message)
      setIsSettingsSaving(false)
      return
    }

    const { data } = supabase.storage.from('avatars').getPublicUrl(path)
    const { error: profileError } = await supabase
      .from('profiles')
      .update({ avatar_url: data.publicUrl })
      .eq('id', user.id)
    if (profileError) setSettingsMessage(profileError.message)
    else {
      await fetchProfile(user)
      setSettingsMessage('Foto profil berhasil diperbarui.')
    }
    setIsSettingsSaving(false)
    event.target.value = ''
  }

  const createFolder = async (event: React.FormEvent) => {
    event.preventDefault()
    if (!user || !isPremium || !folderName.trim()) return
    const { error } = await supabase.from('note_folders').insert({ user_id: user.id, name: folderName.trim() })
    if (error) setPremiumMessage(error.message)
    else {
      setFolderName('')
      setIsCreatingFolder(false)
      await fetchFolders(user.id)
    }
  }

  const inviteCollaborator = async () => {
    if (!user || !editingNoteId || !isPremium) return
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(inviteEmail.trim())) {
      setSharingMessage('Masukkan alamat email yang valid.')
      return
    }
    setSharingMessage('Mengirim undangan...')
    const { data, error } = await supabase.rpc('invite_note_collaborator', {
      target_note_id: editingNoteId,
      collaborator_email: inviteEmail,
    })
    if (error) {
      setSharingMessage(error.message)
      return
    }
    setInviteEmail('')
    setSharingMessage('Kolaborator berhasil ditambahkan.')
    setNoteMembers((members) => {
      const invited = data?.[0]
      if (!invited || members.some((member) => member.user_id === invited.user_id)) return members
      return [...members, invited]
    })
  }

  // 3. CRUD & Feature Handlers
  const handleSaveNote = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!user) return
    if (!title.trim() && !content.trim()) return

    const draft = { title, content, accentColor, folderId: selectedFolderId }
    let saveError = false
    if (editingNoteId) {
      const { error } = await supabase
        .from('notes')
        .update({
          title,
          content,
          accent_color: accentColor,
          folder_id: selectedFolderId ? Number(selectedFolderId) : null,
          updated_at: new Date().toISOString(),
        })
        .eq('id', editingNoteId)

      saveError = Boolean(error)
    } else {
      const { error } = await supabase.from('notes').insert({
        user_id: user.id,
        title,
        content,
        accent_color: accentColor,
        folder_id: selectedFolderId ? Number(selectedFolderId) : null,
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
    setNoteMembers([])
    setOnlineMembers([])
    const draft = {
      title: note.title,
      content: note.content,
      accentColor: note.accent_color || '#ffffff',
      folderId: note.folder_id ? String(note.folder_id) : '',
    }
    setEditingNoteId(note.id)
    setTitle(draft.title)
    setContent(draft.content)
    setAccentColor(draft.accentColor)
    setSelectedFolderId(draft.folderId)
    setLastSavedDraft(draft)
    setSaveStatus('idle')
    setIsFormOpen(true)
  }

  const openNewNote = () => {
    setNoteMembers([])
    setOnlineMembers([])
    const emptyDraft = { title: '', content: '', accentColor: '#ffffff', folderId: '' }
    setEditingNoteId(null)
    setTitle(emptyDraft.title)
    setContent(emptyDraft.content)
    setAccentColor(emptyDraft.accentColor)
    setSelectedFolderId(emptyDraft.folderId)
    setLastSavedDraft(emptyDraft)
    setSaveStatus('idle')
    setIsFormOpen(true)
  }

  const closeNoteForm = useCallback(() => {
    if (!isFormOpen || isFormClosing) return
    setNoteMembers([])
    setOnlineMembers([])
    setIsFormClosing(true)
    window.setTimeout(() => {
      setIsFormOpen(false)
      setIsFormClosing(false)
    }, 180)
  }, [isFormClosing, isFormOpen])

  useEffect(() => {
    const timeout = window.setTimeout(() => setCurrentTime(Date.now()), 0)
    return () => window.clearTimeout(timeout)
  }, [])

  useEffect(() => {
    currentDraftRef.current = { title, content, accentColor, folderId: selectedFolderId }
    savedDraftRef.current = lastSavedDraft
  }, [accentColor, content, lastSavedDraft, selectedFolderId, title])

  useEffect(() => {
    if (!isFormOpen || !user) return

    const draft = { title, content, accentColor, folderId: selectedFolderId }
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
            folder_id: draft.folderId ? Number(draft.folderId) : null,
            updated_at: new Date().toISOString(),
          })
          .eq('id', editingNoteId)

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
            folder_id: draft.folderId ? Number(draft.folderId) : null,
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
  }, [accentColor, content, editingNoteId, isFormOpen, lastSavedDraft, selectedFolderId, title, user])

  useEffect(() => {
    if (isFormOpen && editingNoteId !== null) {
      noteTitleInputRef.current?.setSelectionRange(0, 0)
      noteTitleInputRef.current?.scrollTo({ left: 0 })
    }
  }, [editingNoteId, isFormOpen])

  useEffect(() => {
    if (!isFormOpen || editingNoteId === null || !user) {
      return
    }

    let isCurrent = true
    const loadMembers = async () => {
      const { data: memberRows } = await supabase
        .from('note_members')
        .select('user_id')
        .eq('note_id', editingNoteId)
      const memberIds = [...new Set([user.id, ...(memberRows ?? []).map((member) => member.user_id)])]
      const { data: people } = await supabase
        .from('profiles')
        .select('id, full_name, avatar_url')
        .in('id', memberIds)
      if (isCurrent) {
        setNoteMembers((people ?? []).map((person) => ({
          user_id: person.id,
          full_name: person.full_name,
          avatar_url: person.avatar_url,
        })))
      }
    }
    void loadMembers()

    const channel = supabase.channel(`notes:${editingNoteId}`, {
      config: { private: true, presence: { key: user.id } },
    })
    channel
      .on('presence', { event: 'sync' }, () => {
        const presence = channel.presenceState<NotePerson>()
        const people = Object.values(presence).flat().filter((person) => person.user_id !== user.id)
        if (isCurrent) setOnlineMembers(people)
      })
      .subscribe(async (status) => {
        if (status === 'SUBSCRIBED') {
          await channel.track({
            user_id: user.id,
            full_name: profile?.full_name || user.email || 'Pengguna',
            avatar_url: profile?.avatar_url ?? null,
          })
        }
      })

    return () => {
      isCurrent = false
      void supabase.removeChannel(channel)
    }
  }, [editingNoteId, isFormOpen, profile?.avatar_url, profile?.full_name, user])

  useEffect(() => {
    if (!isFormOpen || editingNoteId === null) return

    const channel = supabase
      .channel(`note-updates:${editingNoteId}`)
      .on('postgres_changes', {
        event: 'UPDATE',
        schema: 'public',
        table: 'notes',
        filter: `id=eq.${editingNoteId}`,
      }, (payload) => {
        const remoteNote = payload.new as Note
        const localDraft = currentDraftRef.current
        const savedDraft = savedDraftRef.current
        if (JSON.stringify(localDraft) !== JSON.stringify(savedDraft)) {
          setSharingMessage('Kolaborator menyimpan perubahan. Simpan draft ini untuk mempertahankan versimu.')
          return
        }

        const remoteDraft = {
          title: remoteNote.title ?? '',
          content: remoteNote.content ?? '',
          accentColor: remoteNote.accent_color || '#ffffff',
          folderId: remoteNote.folder_id ? String(remoteNote.folder_id) : '',
        }
        setTitle(remoteDraft.title)
        setContent(remoteDraft.content)
        setAccentColor(remoteDraft.accentColor)
        setSelectedFolderId(remoteDraft.folderId)
        setLastSavedDraft(remoteDraft)
        setSaveStatus('saved')
        setNotes((currentNotes) => currentNotes.map((note) => note.id === remoteNote.id ? remoteNote : note))
      })
      .subscribe()

    return () => {
      void supabase.removeChannel(channel)
    }
  }, [editingNoteId, isFormOpen])

  useEffect(() => {
    if (!isFormOpen && !confirmation && !isPremiumOfferOpen && !premiumDetailOpen && !isSettingsOpen) return
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        closeNoteForm()
        setConfirmation(null)
        setIsPremiumOfferOpen(false)
        setPremiumDetailOpen(false)
        setIsSettingsOpen(false)
      }
    }
    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [closeNoteForm, confirmation, isFormOpen, isFormClosing, isPremiumOfferOpen, premiumDetailOpen, isSettingsOpen])

  useEffect(() => {
    const expiresAt = profile?.premium_expires_at
    if (!expiresAt) return
    const delay = new Date(expiresAt).getTime() - Date.now()
    if (delay <= 0) {
      const timeout = window.setTimeout(() => setCurrentTime(Date.now()), 0)
      return () => window.clearTimeout(timeout)
    }
    const timeout = window.setTimeout(() => setCurrentTime(Date.now()), delay + 50)
    return () => window.clearTimeout(timeout)
  }, [profile?.premium_expires_at])

  const togglePin = async (note: Note) => {
    if (!user) return
    if (!note.is_pinned && note.user_id === user.id && !isPremium) {
      const currentPinnedCount = notes.filter((item) => item.user_id === user.id && item.is_pinned && !item.is_trashed).length
      if (currentPinnedCount >= 3) {
        setPremiumMessage('Paket Free memiliki batas 3 catatan pin. Premium membuka pin tanpa batas.')
        return
      }
    }
    setPinAnimation({ id: note.id, pinning: !note.is_pinned })
    window.setTimeout(() => setPinAnimation(null), 500)
    const { error } = await supabase
      .from('notes')
      .update({ is_pinned: !note.is_pinned, updated_at: new Date().toISOString() })
      .eq('id', note.id)

    if (!error) fetchNotes(user.id)
    else setPremiumMessage(error.message)
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
  const activeNotes = notes.filter((n) => !n.is_trashed && (folderFilter === 'all' || String(n.folder_id ?? '') === folderFilter))
  const trashedNotes = notes.filter((n) => n.is_trashed)
  const isPremium = profile?.plan === 'premium'
    && Boolean(profile.premium_expires_at)
    && new Date(profile.premium_expires_at as string).getTime() > currentTime

  const openPlanDetails = () => {
    if (isPremium) setPremiumDetailOpen(true)
    else setIsPremiumOfferOpen(true)
  }

  const activatePremiumPlan = async (durationMonths: 1 | 12) => {
    setIsActivatingPremium(true)
    setOfferMessage('')
    const { data, error } = await supabase.rpc('activate_premium_plan', {
      duration_months: durationMonths,
    })

    if (error || !data) {
      setOfferMessage(error?.message || 'Paket belum dapat diaktifkan. Coba lagi.')
      setIsActivatingPremium(false)
      return
    }

    const expiresAt = typeof data === 'string' ? data : String(data)
    setPremiumSuccessExpiry(expiresAt)
    setCurrentTime(Date.now())
    setOfferMessage('')
    setIsPremiumOfferOpen(false)
    setPremiumDetailOpen(false)
    if (user) await fetchProfile(user)
    setIsActivatingPremium(false)
  }

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
      <main className={`min-h-screen bg-[#f5f5f7] text-[#1d1d1f] font-sans ${isDarkMode ? 'theme-dark' : ''}`}>
        <header className="flex h-[44px] items-center justify-between gap-3 bg-black px-4 text-[12px] tracking-[-0.12px] text-white sm:px-6 md:px-12">
          <span className="font-semibold text-sm"> Notes</span>
          <span>Catatan pribadimu</span>
        </header>
        <div className="mx-auto flex min-h-[calc(100vh-44px)] w-full max-w-[1120px] items-center justify-center gap-16 px-4 py-8 sm:px-6 sm:py-12 lg:justify-between">
          <section className="hidden max-w-[470px] lg:block">
            <h1 className="text-[56px] font-semibold leading-[1.07] tracking-[-0.374px]">
              Ruang tenang untuk semua idemu.
            </h1>
            <p className="mt-5 text-[21px] leading-[1.47] text-[#7a7a7a]">
              Simpan catatan, rencana, dan pemikiran penting dalam satu tempat.
            </p>
          </section>

          <section className="w-full max-w-[420px] rounded-[18px] border border-[#e0e0e0] bg-white p-5 sm:p-8">
            <h1 className="text-[28px] font-semibold leading-[1.14] tracking-[-0.3px]">
              {authMode === 'login' ? 'Selamat datang kembali' : 'Buat akun Notes'}
            </h1>
            <p className="mt-2 text-[17px] leading-[1.47] text-[#7a7a7a]">
              {authMode === 'login' ? 'Masuk untuk membuka catatanmu.' : 'Daftar untuk mulai menyimpan catatan.'}
            </p>

            <div className="mt-6 grid grid-cols-2 rounded-full bg-[#f5f5f7] p-1 text-[14px]">
              <button
                type="button"
                onClick={() => { setAuthMode('login'); setAuthMessage('') }}
                className={`min-h-10 rounded-full transition-all active:scale-95 ${authMode === 'login' ? 'bg-white text-[#1d1d1f]' : 'text-[#7a7a7a]'}`}
              >Masuk</button>
              <button
                type="button"
                onClick={() => { setAuthMode('register'); setAuthMessage('') }}
                className={`min-h-10 rounded-full transition-all active:scale-95 ${authMode === 'register' ? 'bg-white text-[#1d1d1f]' : 'text-[#7a7a7a]'}`}
              >Daftar</button>
            </div>

            <form onSubmit={handleEmailAuth} className="mt-6 space-y-4">
              {authMode === 'register' && (
                <label className="block text-[14px] text-[#333333]">
                  Nama
                  <input
                    required
                    autoComplete="name"
                    value={authName}
                    onChange={(event) => setAuthName(event.target.value)}
                    className="mt-2 h-11 w-full rounded-[8px] border border-[#e0e0e0] bg-white px-3 text-[17px] text-[#1d1d1f] outline-none focus-visible:ring-2 focus-visible:ring-[#0071e3]"
                  />
                </label>
              )}
              <label className="block text-[14px] text-[#333333]">
                Email
                <input
                  required
                  type="email"
                  autoComplete="email"
                  value={authEmail}
                  onChange={(event) => setAuthEmail(event.target.value)}
                  className="mt-2 h-11 w-full rounded-[8px] border border-[#e0e0e0] bg-white px-3 text-[17px] text-[#1d1d1f] outline-none focus-visible:ring-2 focus-visible:ring-[#0071e3]"
                />
              </label>
              <label className="block text-[14px] text-[#333333]">
                Password
                <span className="mt-2 flex h-11 items-center rounded-[8px] border border-[#e0e0e0] bg-white focus-within:ring-2 focus-within:ring-[#0071e3]">
                  <input
                    required
                    minLength={8}
                    type={showAuthPassword ? 'text' : 'password'}
                    autoComplete={authMode === 'register' ? 'new-password' : 'current-password'}
                    value={authPassword}
                    onChange={(event) => setAuthPassword(event.target.value)}
                    className="h-full min-w-0 flex-1 bg-transparent px-3 text-[17px] text-[#1d1d1f] outline-none"
                  />
                  <button
                    type="button"
                    aria-label={showAuthPassword ? 'Sembunyikan password' : 'Tampilkan password'}
                    aria-pressed={showAuthPassword}
                    onClick={() => setShowAuthPassword((visible) => !visible)}
                    className="h-11 rounded-full px-3 text-[12px] text-[#0066cc] active:scale-95"
                  >{showAuthPassword ? 'Sembunyikan' : 'Tampilkan'}</button>
                </span>
              </label>
              {authMessage && <p role="status" className="text-[14px] leading-[1.4] text-[#1d1d1f]">{authMessage}</p>}
              <button
                type="submit"
                disabled={isAuthSubmitting}
                className="min-h-11 w-full rounded-full bg-[#0066cc] px-5 text-[17px] text-white transition-all hover:bg-[#0071e3] active:scale-[0.98] disabled:opacity-60"
              >{isAuthSubmitting ? 'Memproses...' : authMode === 'login' ? 'Masuk' : 'Buat Akun'}</button>
            </form>

            <div className="my-5 flex items-center gap-3 text-[12px] text-[#7a7a7a]">
              <span className="h-px flex-1 bg-[#e0e0e0]" /><span>atau</span><span className="h-px flex-1 bg-[#e0e0e0]" />
            </div>
            <button
              onClick={handleGoogleLogin}
              className="flex min-h-11 w-full items-center justify-center gap-3 rounded-full border border-[#e0e0e0] bg-white px-5 text-[14px] text-[#1d1d1f] transition-colors hover:bg-[#fafafc] active:scale-[0.98]"
            >
              <svg aria-hidden="true" viewBox="0 0 48 48" className="h-5 w-5">
                <path fill="#4285F4" d="M43.6 24.5c0-1.4-.1-2.8-.4-4.1H24v7.8h11a9.4 9.4 0 0 1-4.1 6.2v5h6.6c3.9-3.6 6.1-8.8 6.1-14.9Z" />
                <path fill="#34A853" d="M24 44c5.5 0 10.1-1.8 13.5-4.8l-6.6-5c-1.8 1.2-4.1 2-6.9 2-5.3 0-9.8-3.6-11.4-8.4H5.8v5.2A20 20 0 0 0 24 44Z" />
                <path fill="#FBBC05" d="M12.6 27.8a12 12 0 0 1 0-7.6V15H5.8a20 20 0 0 0 0 18l6.8-5.2Z" />
                <path fill="#EA4335" d="M24 11.8c3 0 5.7 1 7.8 3l5.8-5.8C34.1 5.7 29.5 4 24 4A20 20 0 0 0 5.8 15l6.8 5.2c1.6-4.8 6.1-8.4 11.4-8.4Z" />
              </svg>
              Masuk dengan Google
            </button>
          </section>
        </div>
      </main>
    )
  }

  // --- 2. MAIN DASHBOARD PAGE (Apple Design System) ---
  return (
    <div className={`min-h-screen bg-[#f5f5f7] text-[#1d1d1f] font-sans flex flex-col selection:bg-[#0066cc] selection:text-white animate-dashboard-enter ${isDarkMode ? 'theme-dark' : ''}`}>
      {/* Global Thin Nav Bar */}
      <header className="sticky top-0 z-50 flex h-[44px] items-center justify-between gap-2 bg-[#000000] px-3 text-[12px] tracking-[-0.12px] text-white sm:px-6 md:px-12">
        <div className="flex min-w-0 items-center gap-1.5 sm:gap-2">
          <span className="text-base"></span>
          <span className="font-semibold tracking-normal">Notes</span>
          <button
            type="button"
            onClick={openPlanDetails}
            className={`min-h-8 shrink-0 rounded-full px-2 text-[10px] tracking-normal transition-colors active:scale-95 ${isPremium ? 'bg-[#0066cc] text-white' : 'bg-white/10 text-white/80'}`}
          >
            {isPremium ? '★ Premium' : 'Free Plan'}
          </button>
        </div>

        {/* Google Profile Header (Ujung Kanan) */}
        <div className="relative">
          <button
            type="button"
            aria-expanded={isProfileMenuOpen}
            aria-haspopup="menu"
            onClick={() => setIsProfileMenuOpen((open) => !open)}
            className="flex min-h-11 shrink-0 items-center gap-1.5 rounded-full px-1.5 text-white transition-colors hover:bg-white/10 active:scale-[0.98] sm:gap-2 sm:px-2"
          >
            {(profile?.avatar_url || user.user_metadata?.avatar_url) ? (
              <Image
                src={profile?.avatar_url || user.user_metadata.avatar_url}
                alt=""
                width={28}
                height={28}
                unoptimized
                className="h-7 w-7 rounded-full object-cover"
              />
            ) : (
              <span className="flex h-7 w-7 items-center justify-center rounded-full bg-white/15 text-[12px]">
                {(profile?.full_name || user.email || 'U').slice(0, 1).toUpperCase()}
              </span>
            )}
            <span className="hidden max-w-[180px] truncate text-[12px] sm:inline">
              {profile?.full_name || user.email}
            </span>
            <span aria-hidden="true" className="text-[10px]">⌄</span>
          </button>
          {isProfileMenuOpen && (
            <div role="menu" className="absolute right-0 top-[calc(100%+8px)] z-[55] w-[min(14rem,calc(100vw-1.5rem))] rounded-[8px] border border-[#e0e0e0] bg-white p-2 text-[#1d1d1f]">
              <div className="border-b border-[#f0f0f0] px-3 py-2">
                <p className="truncate text-[14px] font-semibold">{profile?.full_name || 'Akun Notes'}</p>
                <p className="truncate text-[12px] text-[#7a7a7a]">{user.email}</p>
                <button onClick={openPlanDetails} className="mt-2 min-h-8 rounded-full bg-[#f5f5f7] px-3 text-[12px] text-[#1d1d1f] active:scale-95">
                  Paket aktif: {isPremium ? '★ Premium' : 'Free Plan'}
                </button>
              </div>
                <div className="flex min-h-12 items-center justify-between gap-3 border-b border-[#f0f0f0] px-3">
                  <span className="text-[14px]">Tampilan gelap</span>
                  <button
                    type="button"
                    role="switch"
                    aria-checked={isDarkMode}
                    aria-label="Aktifkan tampilan gelap"
                    onClick={toggleDarkMode}
                    className={`relative h-7 w-12 shrink-0 rounded-full transition-colors duration-200 active:scale-95 ${isDarkMode ? 'bg-[#0066cc]' : 'bg-[#d2d2d7]'}`}
                  >
                    <span className={`absolute left-1 top-1 h-5 w-5 rounded-full bg-white transition-transform duration-200 ${isDarkMode ? 'translate-x-5' : 'translate-x-0'}`} />
                  </button>
                </div>
              <button
                role="menuitem"
                onClick={() => {
                  setSettingsName(profile?.full_name || '')
                  setSettingsPassword('')
                  setSettingsMessage('')
                  setIsSettingsOpen(true)
                  setIsProfileMenuOpen(false)
                }}
                className="min-h-11 w-full rounded-[5px] px-3 text-left text-[14px] hover:bg-[#f5f5f7] active:scale-[0.99]"
              >Pengaturan</button>
              <button
                role="menuitem"
                onClick={handleLogout}
                className="min-h-11 w-full rounded-[5px] px-3 text-left text-[14px] text-[#0066cc] hover:bg-[#f5f5f7] active:scale-[0.99]"
              >Keluar</button>
            </div>
          )}
        </div>
      </header>

      {/* Sub-Nav Frosted Glass */}
      <nav className="sticky top-[44px] z-40 flex min-h-[52px] flex-wrap items-center justify-between gap-x-3 gap-y-2 border-b border-[#e0e0e0] bg-[#f5f5f7]/80 px-3 py-2 backdrop-blur-md sm:px-6 md:px-12">
        <div className="flex min-w-0 flex-wrap items-center gap-2 sm:gap-6">
          <span className="text-[18px] font-semibold tracking-[0.1px] text-[#1d1d1f] sm:text-[21px] sm:tracking-[0.231px]">
            {activeTab === 'notes' ? 'Catatan Saya' : 'Sampah'}
          </span>
          <div className="flex shrink-0 gap-1 sm:gap-2">
            <button
              onClick={() => setActiveTab('notes')}
              className={`min-h-10 rounded-full px-2 text-[12px] transition-all sm:px-3 sm:text-[14px] ${
                activeTab === 'notes' ? 'bg-[#1d1d1f] text-white' : 'text-[#7a7a7a] hover:text-[#1d1d1f]'
              }`}
            >
              Utama ({activeNotes.length})
            </button>
            <button
              onClick={() => setActiveTab('trash')}
              className={`min-h-10 rounded-full px-2 text-[12px] transition-all sm:px-3 sm:text-[14px] ${
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
            className="min-h-10 shrink-0 rounded-full bg-[#0066cc] px-3 text-[12px] font-normal text-white transition-all hover:bg-[#0071e3] active:scale-95 sm:px-4 sm:text-[14px]"
          >
            {isFormOpen ? 'Tutup Form' : '+ Catatan Baru'}
          </button>
        )}
      </nav>

      {/* Content Area */}
      <main className="mx-auto w-full max-w-[1440px] flex-1 px-4 py-6 sm:px-6 sm:py-8 md:px-12">
        {premiumMessage && (
          <div role="status" className="mb-5 flex items-center justify-between gap-4 rounded-[11px] border border-[#e0e0e0] bg-white px-4 py-3 text-[14px] text-[#1d1d1f]">
            <span>{premiumMessage}</span>
            <button aria-label="Tutup pesan" onClick={() => setPremiumMessage('')} className="min-h-11 rounded-full px-3 text-[#0066cc] active:scale-95">Tutup</button>
          </div>
        )}

        {activeTab === 'notes' && isPremium && (
          <div className="mb-6 flex flex-wrap items-center gap-3">
            <label className="sr-only" htmlFor="folder-filter">Filter folder</label>
            <select
              id="folder-filter"
              value={folderFilter}
              onChange={(event) => setFolderFilter(event.target.value)}
              className="h-11 min-w-40 rounded-full border border-[#e0e0e0] bg-white px-4 text-[14px] text-[#1d1d1f] outline-none focus-visible:ring-2 focus-visible:ring-[#0071e3]"
            >
              <option value="all">Semua catatan</option>
              <option value="">Tanpa folder</option>
              {folders.map((folder) => <option key={folder.id} value={String(folder.id)}>{folder.name}</option>)}
            </select>
            {isCreatingFolder ? (
              <form onSubmit={createFolder} className="flex flex-wrap items-center gap-2">
                <input
                  autoFocus
                  required
                  maxLength={80}
                  aria-label="Nama folder baru"
                  value={folderName}
                  onChange={(event) => setFolderName(event.target.value)}
                  placeholder="Nama folder"
                  className="h-11 w-48 rounded-full border border-[#e0e0e0] bg-white px-4 text-[14px] outline-none focus-visible:ring-2 focus-visible:ring-[#0071e3]"
                />
                <button className="min-h-11 rounded-full bg-[#0066cc] px-4 text-[14px] text-white active:scale-95">Buat</button>
                <button type="button" onClick={() => setIsCreatingFolder(false)} className="min-h-11 rounded-full px-3 text-[14px] text-[#0066cc] active:scale-95">Batal</button>
              </form>
            ) : (
              <button onClick={() => setIsCreatingFolder(true)} className="min-h-11 rounded-full border border-[#0066cc] px-4 text-[14px] text-[#0066cc] active:scale-95">+ Folder</button>
            )}
          </div>
        )}

        {/* Note editor modal */}
        {isFormOpen && activeTab === 'notes' && (
          <div
            className={`fixed inset-0 z-[60] flex items-center justify-center bg-black/35 p-2 backdrop-blur-[3px] sm:p-4 ${isFormClosing ? 'animate-modal-backdrop-exit' : 'animate-modal-backdrop'}`}
            onMouseDown={(event) => {
              if (event.target === event.currentTarget) closeNoteForm()
            }}
          >
            <form
              onSubmit={handleSaveNote}
              style={{ backgroundColor: accentColor }}
              data-note-editor
              role="dialog"
              aria-modal="true"
              aria-labelledby="note-editor-title"
              className={`max-h-[90dvh] w-full max-w-[680px] overscroll-contain overflow-y-auto rounded-[18px] border border-[#e0e0e0] p-4 sm:max-h-[min(82vh,760px)] sm:p-8 ${isFormClosing ? 'animate-modal-exit' : 'animate-modal-enter'}`}
            >
              <div className="mb-4 flex items-start justify-between gap-3 sm:mb-6 sm:gap-4">
                <div className="min-w-0 flex-1">
                  <input
                    ref={noteTitleInputRef}
                    id="note-editor-title"
                    aria-label="Judul catatan"
                    autoFocus={editingNoteId === null}
                    type="text"
                    placeholder={editingNoteId ? 'Tanpa Judul' : 'Buat Catatan Baru'}
                    value={title}
                    onChange={(event) => {
                      setTitle(event.target.value)
                      setSaveStatus('idle')
                    }}
                    className="w-full min-w-0 bg-transparent text-[21px] font-semibold leading-[1.2] text-[#1d1d1f] outline-none placeholder:text-[#7a7a7a] focus-visible:ring-2 focus-visible:ring-[#0071e3]"
                  />
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
              <textarea
                placeholder="Tulis isi catatan di sini..."
                value={content}
                onChange={(e) => {
                  setContent(e.target.value)
                  setSaveStatus('idle')
                }}
                rows={10}
                className="mb-5 min-h-[180px] w-full resize-y bg-transparent text-[17px] leading-[1.47] text-[#1d1d1f] focus:outline-none sm:mb-6 sm:min-h-[240px]"
              />
              {(isPremium || notes.find((item) => item.id === editingNoteId)?.user_id !== user.id) && editingNoteId !== null && (
                <section className="mb-6 border-t border-[#f0f0f0] pt-5" aria-label="Kolaborator catatan">
                  <div className="flex flex-wrap items-center justify-between gap-3">
                    <div>
                      <h3 className="text-[14px] font-semibold text-[#1d1d1f]">Akses bersama</h3>
                      <p className="mt-1 text-[12px] text-[#7a7a7a]">{onlineMembers.length ? `${onlineMembers.length} lainnya sedang membuka catatan` : 'Tidak ada kolaborator lain yang sedang aktif'}</p>
                    </div>
                    <div className="flex -space-x-2" aria-label="Pengguna yang mengakses catatan">
                      {[...noteMembers.filter((person) => person.user_id === user.id), ...onlineMembers]
                        .filter((person, index, people) => people.findIndex((item) => item.user_id === person.user_id) === index)
                        .map((person) => (
                          <span key={person.user_id} title={person.full_name || person.user_id} className="flex h-8 w-8 items-center justify-center overflow-hidden rounded-full border-2 border-white bg-[#f5f5f7] text-[11px] text-[#1d1d1f]">
                            {person.avatar_url ? <Image src={person.avatar_url} alt="" width={32} height={32} unoptimized className="h-full w-full object-cover" /> : (person.full_name || '?').slice(0, 1).toUpperCase()}
                          </span>
                        ))}
                    </div>
                  </div>
                  <div className="mt-3 flex flex-wrap gap-2">
                    {noteMembers.filter((person) => person.user_id !== user.id).map((person) => (
                      <span key={person.user_id} className="rounded-full bg-[#f5f5f7] px-3 py-1.5 text-[12px] text-[#333333]">{person.full_name || 'Kolaborator'}</span>
                    ))}
                  </div>
                  {notes.find((item) => item.id === editingNoteId)?.user_id === user.id && (
                    <div className="mt-4 flex flex-wrap gap-2">
                      <input
                        type="email"
                        required
                        aria-label="Email kolaborator"
                        placeholder="Email akun Notes"
                        value={inviteEmail}
                        onChange={(event) => setInviteEmail(event.target.value)}
                        className="h-11 min-w-0 flex-1 rounded-full border border-[#e0e0e0] bg-white px-4 text-[14px] outline-none focus-visible:ring-2 focus-visible:ring-[#0071e3]"
                      />
                      <button type="button" onClick={inviteCollaborator} className="min-h-11 rounded-full bg-[#0066cc] px-4 text-[14px] text-white active:scale-95">Undang</button>
                    </div>
                  )}
                  {sharingMessage && <p aria-live="polite" className="mt-2 text-[12px] text-[#7a7a7a]">{sharingMessage}</p>}
                </section>
              )}
              <div className="flex flex-wrap items-center justify-between gap-3 border-t border-[#f0f0f0] pt-4 sm:gap-4 sm:pt-5">
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
                {isPremium && (
                  <label className="flex items-center gap-2 text-[12px] text-[#7a7a7a]">
                    Folder
                    <select
                      value={selectedFolderId}
                      onChange={(event) => {
                        setSelectedFolderId(event.target.value)
                        setSaveStatus('idle')
                      }}
                      className="h-10 rounded-full border border-[#e0e0e0] bg-white px-3 text-[14px] text-[#1d1d1f] outline-none focus-visible:ring-2 focus-visible:ring-[#0071e3]"
                    >
                      <option value="">Tanpa folder</option>
                      {folders.map((folder) => <option key={folder.id} value={String(folder.id)}>{folder.name}</option>)}
                    </select>
                  </label>
                )}
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
              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 sm:gap-5 lg:grid-cols-3 lg:gap-6">
                {activeNotes.map((note) => (
                  <article
                    key={note.id}
                    style={{ backgroundColor: note.accent_color || '#ffffff' }}
                    data-note-card
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
                    className="relative group flex min-w-0 cursor-pointer flex-col justify-between rounded-[18px] border border-[#e0e0e0] p-5 transition-all duration-200 hover:border-[#0066cc]/40 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#0071e3] sm:p-6"
                  >
                    <div>
                      <div className="flex items-start justify-between mb-2 gap-2">
                        <h3 className="min-w-0 flex-1 truncate text-[17px] font-semibold text-[#1d1d1f] tracking-[-0.374px]">
                          {note.title || 'Tanpa Judul'}
                        </h3>
                        {/* Pin Button */}
                        {note.user_id === user.id && <button
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
                        </button>}
                      </div>

                      <p className="text-[17px] text-[#1d1d1f]/80 leading-[1.47] line-clamp-4 mb-6 whitespace-pre-wrap">
                        {note.content || 'Gak ada isi teks...'}
                      </p>
                    </div>

                    <div className="flex flex-col gap-2 border-t border-black/5 pt-3 text-[12px] text-[#7a7a7a] sm:flex-row sm:items-center sm:justify-between">
                      <div>
                        <div>Dibuat: {formatDate(note.created_at)}</div>
                        <div>Edit: {formatDate(note.updated_at)}</div>
                      </div>

                      <div className="flex flex-wrap items-center gap-1 self-end sm:self-auto sm:gap-2">
                        {note.user_id === user.id ? (
                          <button
                            onClick={(event) => {
                              event.stopPropagation()
                              setConfirmation({ action: 'trash', note })
                            }}
                            className="min-h-11 px-2 text-[#0066cc] hover:underline"
                          >
                            Buang
                          </button>
                        ) : (
                          <span className="px-2 text-[12px] text-[#7a7a7a]">Dibagikan</span>
                        )}
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
              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 sm:gap-5 lg:grid-cols-3 lg:gap-6">
                {trashedNotes.map((note) => (
                  <div
                    key={note.id}
                    data-note-card
                    className="flex min-w-0 flex-col justify-between rounded-[18px] border border-[#e0e0e0] bg-[#ffffff] p-5 opacity-80 sm:p-6"
                  >
                    <div>
                      <h3 className="text-[17px] font-semibold text-[#1d1d1f] mb-2 line-clamp-1">
                        {note.title || 'Tanpa Judul'}
                      </h3>
                      <p className="text-[17px] text-[#7a7a7a] line-clamp-3 mb-4">
                        {note.content}
                      </p>
                    </div>

                    <div className="flex flex-col gap-2 border-t border-[#f0f0f0] pt-3 text-[12px] sm:flex-row sm:items-center sm:justify-between">
                      <span className="text-[#7a7a7a]">Dibuang</span>
                      <div className="flex flex-wrap gap-x-2 gap-y-1 self-end sm:self-auto sm:gap-3">
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
            className="fixed inset-0 z-[70] flex items-center justify-center bg-black/35 p-2 backdrop-blur-[3px] animate-modal-backdrop sm:p-4"
            onMouseDown={(event) => {
              if (event.target === event.currentTarget) setConfirmation(null)
            }}
          >
            <section
              role="alertdialog"
              aria-modal="true"
              aria-labelledby="confirmation-title"
              aria-describedby="confirmation-description"
              className="max-h-[90dvh] w-full max-w-[420px] overflow-y-auto rounded-[18px] border border-[#e0e0e0] bg-white p-5 animate-confirm-enter sm:p-7"
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
              <div className="mt-6 flex flex-wrap justify-end gap-2 sm:mt-7 sm:gap-3">
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

        {isSettingsOpen && (
          <div
            className="fixed inset-0 z-[65] flex items-center justify-center bg-black/35 p-2 backdrop-blur-[3px] animate-modal-backdrop sm:p-4"
            onMouseDown={(event) => {
              if (event.target === event.currentTarget) setIsSettingsOpen(false)
            }}
          >
            <form
              onSubmit={handleSaveSettings}
              role="dialog"
              aria-modal="true"
              aria-labelledby="account-settings-title"
              className="max-h-[90dvh] w-full max-w-[520px] overflow-y-auto overscroll-contain rounded-[18px] border border-[#e0e0e0] bg-white p-5 animate-modal-enter sm:max-h-[min(82vh,720px)] sm:p-8"
            >
              <div className="mb-6 flex items-start justify-between gap-4">
                <div>
                  <h2 id="account-settings-title" className="text-[28px] font-semibold leading-[1.14] tracking-[-0.3px]">Pengaturan Akun</h2>
                  <p className="mt-2 text-[14px] text-[#7a7a7a]">Kelola informasi profil dan keamanan akun.</p>
                </div>
                <button type="button" aria-label="Tutup pengaturan" onClick={() => setIsSettingsOpen(false)} className="flex h-11 w-11 items-center justify-center rounded-full text-[24px] text-[#7a7a7a] hover:bg-[#f5f5f7] active:scale-95">×</button>
              </div>

              <div className="mb-6 flex items-center gap-4">
                {(profile?.avatar_url || user.user_metadata?.avatar_url) ? (
                  <Image src={profile?.avatar_url || user.user_metadata.avatar_url} alt="Foto profil" width={64} height={64} unoptimized className="h-16 w-16 rounded-full object-cover" />
                ) : (
                  <span className="flex h-16 w-16 items-center justify-center rounded-full bg-[#f5f5f7] text-[24px] text-[#1d1d1f]">{(profile?.full_name || user.email || 'U').slice(0, 1).toUpperCase()}</span>
                )}
                <label className="inline-flex min-h-11 cursor-pointer items-center rounded-full border border-[#0066cc] px-4 text-[14px] text-[#0066cc] active:scale-95">
                  Ubah Foto
                  <input type="file" accept="image/*" className="sr-only" onChange={handleAvatarUpload} />
                </label>
              </div>

              <label className="mb-5 block text-[14px] text-[#333333]">
                Nama pengguna
                <input
                  required
                  maxLength={80}
                  autoComplete="name"
                  value={settingsName}
                  onChange={(event) => setSettingsName(event.target.value)}
                  className="mt-2 h-11 w-full rounded-[8px] border border-[#e0e0e0] bg-white px-3 text-[17px] text-[#1d1d1f] outline-none focus-visible:ring-2 focus-visible:ring-[#0071e3]"
                />
              </label>

              <p className="mb-5 text-[14px] text-[#7a7a7a]">Email: {user.email}</p>
              {((user.app_metadata?.providers as string[] | undefined) ?? []).includes('email') ? (
                <label className="block text-[14px] text-[#333333]">
                  Password baru <span className="text-[#7a7a7a]">(opsional)</span>
                  <span className="mt-2 flex h-11 items-center rounded-[8px] border border-[#e0e0e0] bg-white focus-within:ring-2 focus-within:ring-[#0071e3]">
                    <input
                      type={showSettingsPassword ? 'text' : 'password'}
                      minLength={8}
                      autoComplete="new-password"
                      value={settingsPassword}
                      onChange={(event) => setSettingsPassword(event.target.value)}
                      className="h-full min-w-0 flex-1 bg-transparent px-3 text-[17px] text-[#1d1d1f] outline-none"
                    />
                    <button type="button" aria-label={showSettingsPassword ? 'Sembunyikan password' : 'Tampilkan password'} onClick={() => setShowSettingsPassword((visible) => !visible)} className="h-11 rounded-full px-3 text-[12px] text-[#0066cc] active:scale-95">{showSettingsPassword ? 'Sembunyikan' : 'Tampilkan'}</button>
                  </span>
                </label>
              ) : (
                <p className="rounded-[8px] bg-[#f5f5f7] p-3 text-[14px] leading-[1.47] text-[#7a7a7a]">Akun ini masuk dengan Google. Penggantian password dikelola melalui akun Google.</p>
              )}

              {settingsMessage && <p aria-live="polite" className="mt-4 text-[14px] text-[#1d1d1f]">{settingsMessage}</p>}
              <div className="mt-6 flex flex-wrap justify-end gap-2 sm:mt-7 sm:gap-3">
                <button type="button" onClick={() => setIsSettingsOpen(false)} className="min-h-11 rounded-full px-4 text-[14px] text-[#0066cc] hover:bg-[#f5f5f7] active:scale-95">Batal</button>
                <button type="submit" disabled={isSettingsSaving} className="min-h-11 rounded-full bg-[#0066cc] px-5 text-[14px] text-white transition-all hover:bg-[#0071e3] active:scale-95 disabled:opacity-60">{isSettingsSaving ? 'Menyimpan...' : 'Simpan'}</button>
              </div>
            </form>
          </div>
        )}

        {isPremiumOfferOpen && (
          <div
            className="fixed inset-0 z-[80] flex items-center justify-center bg-black/35 p-2 backdrop-blur-[3px] animate-modal-backdrop sm:p-4"
            onMouseDown={(event) => {
              if (event.target === event.currentTarget) {
                setIsPremiumOfferOpen(false)
                setOfferMessage('')
              }
            }}
          >
            <section role="dialog" aria-modal="true" aria-labelledby="premium-offer-title" className="max-h-[90dvh] w-full max-w-[560px] overflow-y-auto overscroll-contain rounded-[18px] border border-[#e0e0e0] bg-white p-5 animate-modal-enter sm:max-h-[min(86vh,760px)] sm:p-8">
              <div className="flex items-start justify-between gap-4">
                <div>
                  <p className="mb-2 text-[12px] font-semibold text-[#0066cc]">NOTES PREMIUM</p>
                  <h2 id="premium-offer-title" className="text-[28px] font-semibold leading-[1.14] tracking-[-0.3px]">Lebih banyak ruang untuk ide.</h2>
                  <p className="mt-2 text-[17px] leading-[1.47] text-[#7a7a7a]">Pilih paket untuk langsung mengaktifkan Premium. Pembayaran belum diproses di aplikasi ini.</p>
                </div>
                <button type="button" aria-label="Tutup penawaran Premium" onClick={() => { setIsPremiumOfferOpen(false); setOfferMessage('') }} className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full text-[24px] text-[#7a7a7a] hover:bg-[#f5f5f7] active:scale-95">×</button>
              </div>

              <ul className="mt-6 space-y-3 text-[17px] leading-[1.47] text-[#1d1d1f]">
                <li className="flex gap-3"><span className="text-[#0066cc]">✓</span><span>Folder untuk mengelompokkan catatan</span></li>
                <li className="flex gap-3"><span className="text-[#0066cc]">✓</span><span>Berbagi dan mengedit catatan bersama kolaborator</span></li>
                <li className="flex gap-3"><span className="text-[#0066cc]">✓</span><span>Pin catatan tanpa batas</span></li>
              </ul>

              <div className="mt-6 grid grid-cols-1 gap-3 min-[380px]:grid-cols-2 sm:mt-7">
                <button type="button" disabled={isActivatingPremium} onClick={() => activatePremiumPlan(1)} className="min-h-[84px] rounded-[11px] border border-[#e0e0e0] px-4 py-3 text-left transition-colors hover:bg-[#fafafc] active:scale-[0.98] disabled:opacity-60">
                  <span className="block text-[14px] text-[#7a7a7a]">1 bulan</span>
                  <span className="mt-1 block text-[21px] font-semibold tracking-[-0.2px] text-[#1d1d1f]">Rp10.000</span>
                </button>
                <button type="button" disabled={isActivatingPremium} onClick={() => activatePremiumPlan(12)} className="min-h-[84px] rounded-[11px] border border-[#e0e0e0] px-4 py-3 text-left transition-colors hover:bg-[#fafafc] active:scale-[0.98] disabled:opacity-60">
                  <span className="block text-[14px] text-[#7a7a7a]">1 tahun</span>
                  <span className="mt-1 block text-[21px] font-semibold tracking-[-0.2px] text-[#1d1d1f]">Rp90.000</span>
                </button>
              </div>

              {isActivatingPremium && <p role="status" className="mt-4 text-[14px] text-[#7a7a7a]">Mengaktifkan Premium...</p>}
              {offerMessage && <p role="status" aria-live="polite" className="mt-4 rounded-[8px] bg-[#f5f5f7] p-3 text-[14px] leading-[1.47] text-[#1d1d1f]">{offerMessage}</p>}
              <div className="mt-6 flex justify-end">
                <button type="button" onClick={() => { setIsPremiumOfferOpen(false); setOfferMessage('') }} className="min-h-11 rounded-full bg-[#0066cc] px-[22px] text-[14px] text-white transition-all hover:bg-[#0071e3] active:scale-95">Tutup</button>
              </div>
            </section>
          </div>
        )}

        {premiumDetailOpen && isPremium && (
          <div
            className="fixed inset-0 z-[80] flex items-center justify-center bg-black/35 p-2 backdrop-blur-[3px] animate-modal-backdrop sm:p-4"
            onMouseDown={(event) => {
              if (event.target === event.currentTarget) setPremiumDetailOpen(false)
            }}
          >
            <section role="dialog" aria-modal="true" aria-labelledby="premium-detail-title" className="max-h-[90dvh] w-full max-w-[480px] overflow-y-auto rounded-[18px] border border-[#e0e0e0] bg-white p-5 animate-modal-enter sm:p-8">
              <div className="flex items-start justify-between gap-4">
                <div>
                  <p className="mb-2 text-[12px] font-semibold text-[#0066cc]">★ PREMIUM AKTIF</p>
                  <h2 id="premium-detail-title" className="text-[28px] font-semibold leading-[1.14] tracking-[-0.3px]">Paket Premium</h2>
                </div>
                <button type="button" aria-label="Tutup detail paket" onClick={() => setPremiumDetailOpen(false)} className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full text-[24px] text-[#7a7a7a] hover:bg-[#f5f5f7] active:scale-95">×</button>
              </div>
              <p className="mt-4 text-[17px] leading-[1.47] text-[#1d1d1f]">
                {profile?.premium_expires_at
                  ? `Masa Premium berakhir pada ${new Date(profile.premium_expires_at).toLocaleDateString('id-ID', { day: 'numeric', month: 'long', year: 'numeric' })}.`
                  : 'Tanggal berakhir Premium belum tercatat.'}
              </p>
              <ul className="mt-5 space-y-2 text-[14px] leading-[1.47] text-[#7a7a7a]">
                <li>Folder catatan</li>
                <li>Catatan bersama dan kolaborator</li>
                <li>Pin catatan tanpa batas</li>
              </ul>
              <div className="mt-7 flex justify-end">
                <button type="button" onClick={() => setPremiumDetailOpen(false)} className="min-h-11 rounded-full bg-[#0066cc] px-[22px] text-[14px] text-white transition-all hover:bg-[#0071e3] active:scale-95">Tutup</button>
              </div>
            </section>
          </div>
        )}

        {premiumSuccessExpiry && (
          <div
            className="fixed inset-0 z-[90] flex items-center justify-center bg-black/35 p-2 backdrop-blur-[3px] animate-modal-backdrop sm:p-4"
            onMouseDown={(event) => {
              if (event.target === event.currentTarget) setPremiumSuccessExpiry(null)
            }}
          >
            <section role="dialog" aria-modal="true" aria-labelledby="premium-success-title" className="max-h-[90dvh] w-full max-w-[480px] overflow-y-auto rounded-[18px] border border-[#e0e0e0] bg-white p-5 animate-modal-enter sm:p-8">
              <div className="mb-5 flex h-11 w-11 items-center justify-center rounded-full bg-[#f5f5f7] text-[21px] text-[#0066cc]" aria-hidden="true">★</div>
              <p className="mb-2 text-[12px] font-semibold text-[#0066cc]">PREMIUM AKTIF</p>
              <h2 id="premium-success-title" className="text-[28px] font-semibold leading-[1.14] tracking-[-0.3px]">Akunmu sekarang Premium.</h2>
              <p className="mt-3 text-[17px] leading-[1.47] text-[#1d1d1f]">
                Premium aktif sampai {new Date(premiumSuccessExpiry).toLocaleDateString('id-ID', { day: 'numeric', month: 'long', year: 'numeric' })}. Tidak ada pembayaran yang diproses.
              </p>
              <ul className="mt-5 space-y-2 text-[14px] leading-[1.47] text-[#7a7a7a]">
                <li>Folder untuk mengelompokkan catatan</li>
                <li>Berbagi dan mengedit catatan bersama kolaborator</li>
                <li>Pin catatan tanpa batas</li>
              </ul>
              <div className="mt-7 flex justify-end">
                <button type="button" onClick={() => setPremiumSuccessExpiry(null)} className="min-h-11 rounded-full bg-[#0066cc] px-[22px] text-[14px] text-white transition-all hover:bg-[#0071e3] active:scale-95">Mulai gunakan Premium</button>
              </div>
            </section>
          </div>
        )}
      </main>
    </div>
  )
}
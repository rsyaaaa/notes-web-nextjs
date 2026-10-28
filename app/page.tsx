'use client'

import { useCallback, useEffect, useRef, useState, useSyncExternalStore } from 'react'
import { usePathname, useRouter } from 'next/navigation'
import { createPortal } from 'react-dom'
import type { User } from '@supabase/supabase-js'
import Image from 'next/image'
import { FaApple } from 'react-icons/fa'
import { FcGoogle } from 'react-icons/fc'
import { HiStar, HiOutlineChevronDown, HiOutlineDocumentText, HiOutlineTrash, HiOutlineCog, HiOutlineMoon, HiOutlineSun, HiOutlineCheck, HiOutlineX, HiOutlinePlus, HiOutlineLogout, HiOutlineMenuAlt2 } from 'react-icons/hi'
import { BsPin, BsPinFill } from 'react-icons/bs'
import { supabase, supabaseConfigReady } from '@/lib/supabaseClient'
import AppleNoteLoader from '@/components/AppleNoteLoader'
import NewNoteButton from '@/components/NewNoteButton'
import { getNewNoteFolderId, getNewNoteHref } from '@/lib/new-note-folder'
import { useLanguage } from '@/components/LanguageProvider'
import ApplicationSettings from '@/components/ApplicationSettings'
import PageTransition from '@/components/PageTransition'
import { getMotionDuration, useAnimatedPresence } from '@/lib/useAnimatedPresence'

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
  return (
    <PageTransition>
      <HomeContent />
    </PageTransition>
  )
}

function HomeContent() {
  const router = useRouter()
  const pathname = usePathname()
  const { locale, t } = useLanguage()
  const [user, setUser] = useState<User | null>(null)
  const [loading, setLoading] = useState(supabaseConfigReady)
  const [notes, setNotes] = useState<Note[]>([])
  const [notePeopleById, setNotePeopleById] = useState<Record<number, NotePerson[]>>({})
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
  const [isFolderMenuOpen, setIsFolderMenuOpen] = useState(false)
  const [folderMenuPosition, setFolderMenuPosition] = useState<{ top: number; left: number; width: number; maxHeight: number } | null>(null)
  const [folderName, setFolderName] = useState('')
  const [isCreatingFolder, setIsCreatingFolder] = useState(false)
  const [premiumMessage, setPremiumMessage] = useState('')
  const [authMode, setAuthMode] = useState<'login' | 'register'>('login')
  const [authName, setAuthName] = useState('')
  const [authEmail, setAuthEmail] = useState('')
  const [authPassword, setAuthPassword] = useState('')
  const [showAuthPassword, setShowAuthPassword] = useState(false)
  const [authMessage, setAuthMessage] = useState('')
  const [verificationEmail, setVerificationEmail] = useState('')
  const [isResendingVerification, setIsResendingVerification] = useState(false)
  const [isAuthSubmitting, setIsAuthSubmitting] = useState(false)
  const [isProfileMenuOpen, setIsProfileMenuOpen] = useState(false)
  const [isPageListOpen, setIsPageListOpen] = useState(false)
  const [isPageListClosing, setIsPageListClosing] = useState(false)
  const isMounted = useSyncExternalStore(() => () => {}, () => true, () => false)
  const [isDarkMode, setIsDarkMode] = useState(false)
  const [isSettingsOpen, setIsSettingsOpen] = useState(false)
  const [isApplicationSettingsOpen, setIsApplicationSettingsOpen] = useState(false)
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
  const folderPickerButtonRef = useRef<HTMLButtonElement>(null)
  const folderMenuRef = useRef<HTMLDivElement>(null)

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
  const [confirmation, setConfirmation] = useState<{
    action: 'trash' | 'delete' | 'deleteAll'
    note?: Note
    count?: number
  } | null>(null)
  const [openingNoteId, setOpeningNoteId] = useState<number | 'new' | null>(null)
  const isPremium = profile?.plan === 'premium'
    && Boolean(profile.premium_expires_at)
    && new Date(profile.premium_expires_at as string).getTime() > currentTime
  const accountSettingsPresence = useAnimatedPresence(isSettingsOpen)
  const applicationSettingsPresence = useAnimatedPresence(isApplicationSettingsOpen)
  const premiumOfferPresence = useAnimatedPresence(isPremiumOfferOpen)
  const premiumDetailPresence = useAnimatedPresence(premiumDetailOpen && isPremium)
  const premiumSuccessPresence = useAnimatedPresence(premiumSuccessExpiry)
  const confirmationPresence = useAnimatedPresence(confirmation)
  const profileMenuPresence = useAnimatedPresence(isProfileMenuOpen)
  const folderMenuPresence = useAnimatedPresence(isFolderMenuOpen)

  useEffect(() => {
    const storedTheme = window.localStorage.getItem('notes-theme')
    const shouldUseDarkMode = storedTheme === 'dark'
    document.documentElement.dataset.theme = shouldUseDarkMode ? 'dark' : 'light'
    const frame = window.requestAnimationFrame(() => setIsDarkMode(shouldUseDarkMode))
    return () => window.cancelAnimationFrame(frame)
  }, [])

  const handleOpenPageList = useCallback(() => {
    setIsPageListClosing(false)
    setIsPageListOpen(true)
  }, [])

  const handleClosePageList = useCallback((callback?: () => void) => {
    if (isPageListClosing) return
    setIsPageListClosing(true)
    setTimeout(() => {
      setIsPageListOpen(false)
      setIsPageListClosing(false)
      if (callback) callback()
    }, getMotionDuration(220))
  }, [isPageListClosing])

  useEffect(() => {
    if (isPageListOpen || accountSettingsPresence.isPresent || applicationSettingsPresence.isPresent || premiumDetailPresence.isPresent || premiumOfferPresence.isPresent || isFormOpen || confirmationPresence.isPresent || premiumSuccessPresence.isPresent) {
      const originalOverflow = document.body.style.overflow
      const originalTouchAction = document.body.style.touchAction
      document.body.style.overflow = 'hidden'
      document.body.style.touchAction = 'none'
      return () => {
        document.body.style.overflow = originalOverflow
        document.body.style.touchAction = originalTouchAction
      }
    }
  }, [isPageListOpen, accountSettingsPresence.isPresent, applicationSettingsPresence.isPresent, premiumDetailPresence.isPresent, premiumOfferPresence.isPresent, isFormOpen, confirmationPresence.isPresent, premiumSuccessPresence.isPresent])

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
      const visibleNotes = data || []
      setNotes(visibleNotes)

      if (visibleNotes.length === 0) {
        setNotePeopleById({})
        return
      }

      const { data: allMemberships, error: allMembershipsError } = await supabase
        .from('note_members')
        .select('note_id, user_id, invited_by')
        .in('note_id', visibleNotes.map((note) => note.id))

      if (allMembershipsError) {
        console.error('Error fetching note collaborators:', allMembershipsError.message)
        setNotePeopleById({})
        return
      }

      const memberRows = allMemberships ?? []
      const profileIds = [...new Set(visibleNotes.flatMap((note) => [
        note.user_id,
        ...memberRows
          .filter((member) => member.note_id === note.id)
          .flatMap((member) => [member.user_id, member.invited_by]),
      ]))]
      const { data: people, error: peopleError } = await supabase
        .from('profiles')
        .select('id, full_name, avatar_url')
        .in('id', profileIds)

      if (peopleError) {
        console.error('Error fetching note collaborator profiles:', peopleError.message)
        setNotePeopleById({})
        return
      }

      const peopleById = new Map((people ?? []).map((person) => [person.id, person]))
      const peopleByNote: Record<number, NotePerson[]> = {}
      for (const note of visibleNotes) {
        const noteMemberIds = [...new Set([
          note.user_id,
          ...memberRows
            .filter((member) => member.note_id === note.id)
            .flatMap((member) => [member.user_id, member.invited_by]),
        ])]
        peopleByNote[note.id] = noteMemberIds.flatMap((memberId) => {
          const person = peopleById.get(memberId)
          return person ? [{
            user_id: person.id,
            full_name: person.full_name,
            avatar_url: person.avatar_url,
          }] : []
        })
      }
      setNotePeopleById(peopleByNote)
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

  // Each accent keeps its saved light value and uses a coordinated surface in dark mode.
  const colorOptions = [
    { label: t('Putih'), value: '#ffffff', darkValue: '#272729' },
    { label: t('Perkamen'), value: '#f5f5f7', darkValue: '#303033' },
    { label: t('Biru Lembut'), value: '#e8f2ff', darkValue: '#26364a' },
    { label: t('Biru Langit'), value: '#eaf6ff', darkValue: '#263949' },
    { label: t('Kuning Amber Lembut'), value: '#fff8e6', darkValue: '#403721' },
    { label: t('Hijau Mint Lembut'), value: '#eafaf1', darkValue: '#263d32' },
    { label: t('Merah Mawar'), value: '#fff0f2', darkValue: '#432d34' },
    { label: t('Lavendel'), value: '#f2edff', darkValue: '#352f45' },
    { label: t('Persik'), value: '#fff0e6', darkValue: '#453329' },
    { label: t('Hijau Kebiruan'), value: '#e6f7f7', darkValue: '#263d40' },
    { label: t('Hijau Sage'), value: '#edf4e8', darkValue: '#323c29' },
    { label: t('Perak'), value: '#eceff1', darkValue: '#30363b' },
  ]

  const getAccentSurface = (value: string) =>
    isDarkMode
      ? colorOptions.find((option) => option.value.toLowerCase() === value.toLowerCase())?.darkValue ?? '#272729'
      : value

  const updateFolderMenuPosition = () => {
    const button = folderPickerButtonRef.current
    if (!button) return
    const bounds = button.getBoundingClientRect()
    const width = Math.min(Math.max(bounds.width, 220), window.innerWidth - 24)
    const left = Math.max(12, Math.min(bounds.left, window.innerWidth - width - 12))
    const availableAbove = bounds.top - 20
    const availableBelow = window.innerHeight - bounds.bottom - 20
    const opensAbove = availableAbove >= Math.min(208, availableBelow)
    const maxHeight = Math.max(96, Math.min(208, opensAbove ? availableAbove - 8 : availableBelow - 8))
    const top = opensAbove
      ? Math.max(12, bounds.top - maxHeight - 8)
      : Math.min(bounds.bottom + 8, window.innerHeight - maxHeight - 12)
    setFolderMenuPosition({ top, left, width, maxHeight })
  }

  const fetchProfileRef = useRef(fetchProfile)
  useEffect(() => {
    fetchProfileRef.current = fetchProfile
  }, [fetchProfile])

  // 1. Inisialisasi Auth & Auth Listener
  useEffect(() => {
    if (!supabaseConfigReady) return

    let isMounted = true

    const initAuth = async () => {
      try {
        const { data: { session } } = await supabase.auth.getSession()
        if (!isMounted) return
        setUser(session?.user ?? null)
        if (session?.user) {
          await Promise.allSettled([
            fetchNotes(session.user.id),
            fetchProfileRef.current(session.user),
            fetchFolders(session.user.id),
          ])
        }
      } catch (err) {
        console.error('Auth initialization error:', err)
      } finally {
        if (isMounted) {
          setLoading(false)
        }
      }
    }

    initAuth()

    const { data: authListener } = supabase.auth.onAuthStateChange((_event, session) => {
      if (!isMounted) return
      const currentUser = session?.user ?? null
      setUser(currentUser)
      if (currentUser) {
        fetchNotes(currentUser.id)
        fetchProfileRef.current(currentUser)
        fetchFolders(currentUser.id)
      } else {
        setNotes([])
        setNotePeopleById({})
        setProfile(null)
        setFolders([])
        setLastOfferUserId(null)
      }
      setLoading(false)
    })

    return () => {
      isMounted = false
      authListener.subscription.unsubscribe()
    }
  }, [])

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
    setVerificationEmail('')

    const result = authMode === 'register'
      ? await supabase.auth.signUp({
          email: authEmail,
          password: authPassword,
          options: { data: { full_name: authName.trim() } },
        })
      : await supabase.auth.signInWithPassword({ email: authEmail, password: authPassword })

    if (result.error) {
      const errorMessage = result.error.message
      setAuthMessage(errorMessage.toLowerCase().includes('email rate limit exceeded')
        ? t('Batas pengiriman email Supabase sedang tercapai. Permintaan daftar ini ditolak, jadi akun kemungkinan belum dibuat. Tunggu sampai batas pulih, lalu coba sekali lagi.')
        : errorMessage)
    } else if (authMode === 'register' && !result.data.session) {
      setVerificationEmail(authEmail.trim())
      setAuthMessage(t('Akun berhasil dibuat. Periksa email untuk konfirmasi sebelum masuk.'))
    }
    setIsAuthSubmitting(false)
  }

  const resendSignupVerification = async () => {
    const email = verificationEmail || authEmail.trim()
    if (!email) {
      setAuthMessage(t('Masukkan email yang digunakan saat mendaftar.'))
      return
    }

    setIsResendingVerification(true)
    setAuthMessage('')
    const { error } = await supabase.auth.resend({
      type: 'signup',
      email,
      options: { emailRedirectTo: `${window.location.origin}/` },
    })
    setAuthMessage(error
      ? t('Email verifikasi belum dapat dikirim: {error}', { error: error.message })
      : t('Permintaan kirim ulang untuk {email} berhasil. Periksa Inbox dan folder Spam.', { email }))
    setIsResendingVerification(false)
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
    setSettingsMessage(t('Pengaturan akun tersimpan.'))
    setIsSettingsSaving(false)
  }

  const handleAvatarUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
    if (!user) return
    const file = event.target.files?.[0]
    if (!file) return
    if (!file.type.startsWith('image/') || file.size > 5 * 1024 * 1024) {
      setSettingsMessage(t('Pilih gambar dengan ukuran maksimal 5 MB.'))
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
      setSettingsMessage(t('Foto profil berhasil diperbarui.'))
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
    const email = inviteEmail.trim()
    if (!email) return
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      setSharingMessage(t('Masukkan alamat email yang valid.'))
      return
    }
    setSharingMessage(t('Mengirim undangan...'))
    const { data, error } = await supabase.rpc('invite_note_collaborator', {
      target_note_id: editingNoteId,
      collaborator_email: email,
    })
    if (error) {
      setSharingMessage(error.message)
      return
    }
    setInviteEmail('')
    setSharingMessage(t('Kolaborator berhasil ditambahkan.'))
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
    const emptyDraft = { title: '', content: '', accentColor: '#ffffff', folderId: getNewNoteFolderId(folderFilter, folders) }
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
    }, getMotionDuration(180))
  }, [isFormClosing, isFormOpen])

  const handleNoteCardClick = (note: Note) => {
    if (typeof window !== 'undefined' && window.innerWidth < 768) {
      setOpeningNoteId(note.id)
      router.push(`/notes/${note.id}`)
      window.setTimeout(() => setOpeningNoteId(null), 600)
    } else {
      handleEditClick(note)
    }
  }

  const handleNewNoteClick = () => {
    if (typeof window !== 'undefined' && window.innerWidth < 768) {
      setOpeningNoteId('new')
      router.push(getNewNoteHref(folderFilter, folders))
      window.setTimeout(() => setOpeningNoteId(null), 600)
    } else {
      if (isFormOpen) closeNoteForm()
      else openNewNote()
    }
  }

  // Clear opening loader whenever route returns to '/'
  useEffect(() => {
    if (pathname === '/') {
      const frame = window.requestAnimationFrame(() => {
        setOpeningNoteId(null)
      })
      return () => window.cancelAnimationFrame(frame)
    }
  }, [pathname])

  // Clear opening loader on browser back/forward, tab reactivation, or page visibility
  useEffect(() => {
    const handleReset = () => setOpeningNoteId(null)
    window.addEventListener('popstate', handleReset)
    window.addEventListener('pageshow', handleReset)
    const handleVisibility = () => {
      if (document.visibilityState === 'visible') {
        handleReset()
      }
    }
    document.addEventListener('visibilitychange', handleVisibility)
    return () => {
      window.removeEventListener('popstate', handleReset)
      window.removeEventListener('pageshow', handleReset)
      document.removeEventListener('visibilitychange', handleVisibility)
    }
  }, [])

  // Auto-refresh notes & folders when user navigates back to dashboard '/'
  useEffect(() => {
    if (pathname === '/' && user) {
      const timer = window.setTimeout(() => {
        fetchNotes(user.id)
        fetchFolders(user.id)
      }, 0)
      return () => window.clearTimeout(timer)
    }
  }, [pathname, user])

  // Instant refresh when custom notes-refresh event is dispatched
  useEffect(() => {
    const handleCustomRefresh = () => {
      if (user) {
        fetchNotes(user.id)
        fetchFolders(user.id)
      }
    }
    window.addEventListener('notes-refresh', handleCustomRefresh)
    return () => window.removeEventListener('notes-refresh', handleCustomRefresh)
  }, [user])

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
    if (!isFolderMenuOpen) return
    updateFolderMenuPosition()
    const handleOutsideClick = (event: PointerEvent) => {
      const target = event.target as Node
      if (!folderMenuRef.current?.contains(target) && !folderPickerButtonRef.current?.contains(target)) {
        setIsFolderMenuOpen(false)
      }
    }
    const handlePositionChange = () => updateFolderMenuPosition()
    document.addEventListener('pointerdown', handleOutsideClick)
    window.addEventListener('resize', handlePositionChange)
    window.addEventListener('scroll', handlePositionChange, true)
    return () => {
      document.removeEventListener('pointerdown', handleOutsideClick)
      window.removeEventListener('resize', handlePositionChange)
      window.removeEventListener('scroll', handlePositionChange, true)
    }
  }, [isFolderMenuOpen])

  useEffect(() => {
    if (isFormOpen && editingNoteId !== null) {
      noteTitleInputRef.current?.setSelectionRange(0, 0)
      noteTitleInputRef.current?.scrollTo({ left: 0 })
    }
  }, [editingNoteId, isFormOpen, t])

  useEffect(() => {
    if (!isFormOpen || editingNoteId === null || !user) {
      return
    }

    let isCurrent = true
    const loadMembers = async () => {
      const { data: memberRows } = await supabase
        .from('note_members')
        .select('user_id, invited_by')
        .eq('note_id', editingNoteId)
      const memberIds = [...new Set([
        user.id,
        ...(memberRows ?? []).flatMap((member) => [member.user_id, member.invited_by]),
      ])]
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
          setSharingMessage(t('Kolaborator menyimpan perubahan. Simpan draft ini untuk mempertahankan versimu.'))
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
  }, [editingNoteId, isFormOpen, t])

  useEffect(() => {
    if (!isFormOpen && !confirmation && !isPremiumOfferOpen && !premiumDetailOpen && !isSettingsOpen && !isApplicationSettingsOpen) return
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        closeNoteForm()
        setIsFolderMenuOpen(false)
        setConfirmation(null)
        setIsPremiumOfferOpen(false)
        setPremiumDetailOpen(false)
        setIsSettingsOpen(false)
        setIsApplicationSettingsOpen(false)
      }
    }
    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [closeNoteForm, confirmation, isFormOpen, isFormClosing, isPremiumOfferOpen, premiumDetailOpen, isSettingsOpen, isApplicationSettingsOpen])

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
        setPremiumMessage(t('Paket Free memiliki batas 3 catatan pin. Premium membuka pin tanpa batas.'))
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
    if (!confirmation || confirmationPresence.isExiting) return
    const { action, note } = confirmation
    setConfirmation(null)
    if (action === 'deleteAll') {
      if (!user) return
      const { error } = await supabase
        .from('notes')
        .delete()
        .eq('user_id', user.id)
        .eq('is_trashed', true)
      if (error) setPremiumMessage(t('Gagal menghapus catatan: {error}', { error: error.message }))
      else await fetchNotes(user.id)
      return
    }
    if (!note) return
    if (action === 'trash') await toggleTrash(note)
    else await deletePermanently(note)
  }

  const formatDate = (dateStr: string) => {
    const d = new Date(dateStr)
    return d.toLocaleDateString(locale, {
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
  const ownedTrashedCount = trashedNotes.filter((note) => note.user_id === user?.id).length

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
      setOfferMessage(error?.message || t('Paket belum dapat diaktifkan. Coba lagi.'))
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

  if (loading || openingNoteId !== null) {
    return (
      <AppleNoteLoader
        isDark={isDarkMode}
        title={
          openingNoteId === 'new'
            ? t('Membuat Catatan...')
            : openingNoteId !== null
            ? t('Membuka Catatan...')
            : t('Memuat Notes...')
        }
        subtitle={
          openingNoteId !== null
            ? t('Menyiapkan ruang tenang untuk idemu')
            : t('Menyiapkan catatanmu')
        }
      />
    )
  }

  if (!supabaseConfigReady) {
    return (
      <main className="flex min-h-screen items-center justify-center bg-[#f5f5f7] px-5 py-10 font-sans text-[#1d1d1f]">
        <section className="w-full max-w-[520px] rounded-[18px] border border-[#e0e0e0] bg-white p-6 sm:p-8">
          <h1 className="text-[28px] font-semibold leading-[1.14] tracking-[-0.3px]">{t('Konfigurasi Supabase belum tersedia')}</h1>
          <p className="mt-3 text-[17px] leading-[1.47] text-[#7a7a7a]">
            {t('Tambahkan environment variables berikut pada Vercel untuk Production, Preview, dan Development, lalu redeploy.')}
          </p>
          <ul className="mt-5 space-y-2 text-[14px] text-[#1d1d1f]">
            <li><code className="rounded-[5px] bg-[#f5f5f7] px-2 py-1">NEXT_PUBLIC_SUPABASE_URL</code></li>
            <li><code className="rounded-[5px] bg-[#f5f5f7] px-2 py-1">NEXT_PUBLIC_SUPABASE_ANON_KEY</code></li>
          </ul>
        </section>
      </main>
    )
  }

  // --- 1. LANDING / LOGIN PAGE (Apple Style Tile) ---
  if (!user) {
    return (
      <main className={`min-h-screen bg-[#f5f5f7] text-[#1d1d1f] font-sans ${isDarkMode ? 'theme-dark' : ''}`}>
        <header className="flex h-[44px] items-center justify-between gap-3 bg-black px-4 text-[12px] tracking-[-0.12px] text-white sm:px-6 md:px-12">
          <span className="font-semibold text-sm"><FaApple aria-hidden="true" className="mr-1 inline-block align-middle" /> Notes</span>
          <span>{t('Catatan pribadimu')}</span>
        </header>
        <div data-auth-layout data-motion-content className="mx-auto flex min-h-[calc(100vh-44px)] w-full max-w-[1120px] items-center justify-center gap-16 px-4 py-8 sm:px-6 sm:py-12 lg:justify-between">
          <section className="hidden max-w-[470px] lg:block">
            <h1 className="text-[56px] font-semibold leading-[1.07] tracking-[-0.374px]">
              {t('Ruang tenang untuk semua idemu.')}
            </h1>
            <p className="mt-5 text-[21px] leading-[1.47] text-[#7a7a7a]">
              {t('Simpan catatan, rencana, dan pemikiran penting dalam satu tempat.')}
            </p>
          </section>

          <section data-auth-card className="w-full max-w-[420px] rounded-[18px] border border-[#e0e0e0] bg-white p-5 sm:p-8">
            <h1 className="text-[28px] font-semibold leading-[1.14] tracking-[-0.3px]">
              {authMode === 'login' ? t('Selamat datang kembali') : t('Buat akun Notes')}
            </h1>
            <p className="mt-2 text-[17px] leading-[1.47] text-[#7a7a7a]">
              {authMode === 'login' ? t('Masuk untuk membuka catatanmu.') : t('Daftar untuk mulai menyimpan catatan.')}
            </p>

            <div className="mt-6 grid grid-cols-2 rounded-full bg-[#f5f5f7] p-1 text-[14px]">
              <button
                type="button"
                onClick={() => { setAuthMode('login'); setAuthMessage('') }}
                className={`min-h-10 rounded-full transition-all active:scale-95 ${authMode === 'login' ? 'bg-white text-[#1d1d1f]' : 'text-[#7a7a7a]'}`}
              >{t('Masuk')}</button>
              <button
                type="button"
                onClick={() => { setAuthMode('register'); setAuthMessage('') }}
                className={`min-h-10 rounded-full transition-all active:scale-95 ${authMode === 'register' ? 'bg-white text-[#1d1d1f]' : 'text-[#7a7a7a]'}`}
              >{t('Daftar')}</button>
            </div>

            <form onSubmit={handleEmailAuth} className="mt-6 space-y-4">
              {authMode === 'register' && (
                <label className="block text-[14px] text-[#333333]">
                  {t('Nama')}
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
                {t('Email')}
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
                {t('Kata sandi')}
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
                    aria-label={showAuthPassword ? t('Sembunyikan password') : t('Tampilkan password')}
                    aria-pressed={showAuthPassword}
                    onClick={() => setShowAuthPassword((visible) => !visible)}
                    className="h-11 rounded-full px-3 text-[12px] text-[#0066cc] active:scale-95"
                  >{showAuthPassword ? t('Sembunyikan') : t('Tampilkan')}</button>
                </span>
              </label>
              {authMessage && <p role="status" className="text-[14px] leading-[1.4] text-[#1d1d1f]">{authMessage}</p>}
              {verificationEmail && authMode === 'register' && (
                <div className="space-y-2 rounded-[8px] bg-[#f5f5f7] p-3">
                  <button
                    type="button"
                    disabled={isResendingVerification}
                    onClick={resendSignupVerification}
                    className="min-h-11 rounded-full border border-[#0066cc] px-4 text-[14px] text-[#0066cc] transition-colors hover:bg-[#0066cc]/5 active:scale-95 disabled:opacity-60"
                  >
                    {isResendingVerification ? t('Mengirim...') : t('Kirim Ulang Email Verifikasi')}
                  </button>
                  <p className="text-[12px] leading-[1.45] text-[#7a7a7a]">
                    {t('Periksa Inbox dan folder Spam. Jika email tidak terkirim, proyek Supabase mungkin perlu SMTP khusus atau menunggu batas kirim pulih.')}
                  </p>
                </div>
              )}
              <button
                type="submit"
                disabled={isAuthSubmitting}
                className="min-h-11 w-full rounded-full bg-[#0066cc] px-5 text-[17px] text-white transition-all hover:bg-[#0071e3] active:scale-[0.98] disabled:opacity-60"
              >{isAuthSubmitting ? t('Memproses...') : authMode === 'login' ? t('Masuk') : t('Buat Akun')}</button>
            </form>

            <div className="my-5 flex items-center gap-3 text-[12px] text-[#7a7a7a]">
              <span className="h-px flex-1 bg-[#e0e0e0]" /><span>{t('atau')}</span><span className="h-px flex-1 bg-[#e0e0e0]" />
            </div>
            <button
              onClick={handleGoogleLogin}
              className="flex min-h-11 w-full items-center justify-center gap-3 rounded-full border border-[#e0e0e0] bg-white px-5 text-[14px] text-[#1d1d1f] transition-colors hover:bg-[#fafafc] active:scale-[0.98]"
            >
              <FcGoogle aria-hidden="true" className="h-5 w-5" />
              {t('Masuk dengan Google')}
            </button>
          </section>
        </div>
      </main>
    )
  }

  // --- 2. MAIN DASHBOARD PAGE (Apple Design System) ---
  return (
    <div className={`min-h-screen bg-[#f5f5f7] text-[#1d1d1f] font-sans flex flex-col selection:bg-[#0066cc] selection:text-white animate-dashboard-enter ${isDarkMode ? 'theme-dark' : ''}`}>
      {/* Global Thin Nav Bar (Apple Minimalist) */}
      <header data-dashboard-header className="sticky top-0 z-50 flex h-[44px] items-center justify-between bg-[#000000] px-4 text-[12px] tracking-[-0.12px] text-white sm:px-6 md:px-12">
        <div className="flex min-w-0 items-center">
          <span className="font-semibold text-[15px] sm:text-[14px] tracking-normal text-white">Notes</span>
        </div>

        {/* Profile Button (Ujung Kanan) */}
        <div className="relative">
          <button
            type="button"
            aria-label={t('Menu profil')}
            aria-expanded={isProfileMenuOpen}
            aria-haspopup="menu"
            onClick={() => setIsProfileMenuOpen((open) => !open)}
            className="flex min-h-[36px] items-center gap-1.5 rounded-full p-1 text-white transition-colors hover:bg-white/10 active:scale-95"
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
              <span className="flex h-7 w-7 items-center justify-center rounded-full bg-white/20 text-[12px] font-medium">
                {(profile?.full_name || user.email || 'U').slice(0, 1).toUpperCase()}
              </span>
            )}
            <span aria-hidden="true" className="text-[9px] opacity-70"><HiOutlineChevronDown aria-hidden="true" /></span>
          </button>

          {/* Profile Menu Popover: Hanya Nama, Email, dan Tombol Logout */}
          {profileMenuPresence.isPresent && (
            <>
              <div
                className="fixed inset-0 z-50 bg-transparent"
                inert={profileMenuPresence.isExiting}
                onClick={() => setIsProfileMenuOpen(false)}
                aria-hidden="true"
              />
              <div
                role="menu"
                data-motion-state={profileMenuPresence.isExiting ? 'closing' : 'open'}
                data-motion-kind="popover"
                inert={profileMenuPresence.isExiting}
                className={`motion-popover absolute right-0 top-[calc(100%+8px)] z-[55] w-64 rounded-[14px] border p-2 shadow-2xl backdrop-blur-2xl transition-all ${
                  isDarkMode
                    ? 'border-white/10 bg-[#252527]/95 text-[#f5f5f7] shadow-[0_12px_36px_rgba(0,0,0,0.6)]'
                    : 'border-black/5 bg-white/95 text-[#1d1d1f] shadow-[0_12px_36px_rgba(0,0,0,0.15)]'
                }`}
              >
                <div className="px-3 py-2.5">
                  <p className="truncate text-[15px] font-semibold tracking-[-0.2px]">
                    {profile?.full_name || user.user_metadata?.full_name || t('Akun Notes')}
                  </p>
                  <p className={`truncate text-[13px] tracking-[-0.12px] ${isDarkMode ? 'text-[#86868b]' : 'text-[#7a7a7a]'}`}>
                    {user.email}
                  </p>
                </div>
                <div className={`my-1 h-px ${isDarkMode ? 'bg-white/10' : 'bg-black/5'}`} />
                <button
                  type="button"
                  role="menuitem"
                  onClick={() => {
                    setIsProfileMenuOpen(false)
                    handleLogout()
                  }}
                  className={`flex w-full min-h-[40px] items-center gap-2 rounded-[10px] px-3 text-left text-[14px] font-normal transition-colors active:scale-95 ${
                    isDarkMode
                      ? 'text-[#ff453a] hover:bg-white/10'
                      : 'text-[#ff3b30] hover:bg-black/5'
                  }`}
                >
                  <HiOutlineLogout aria-hidden="true" className="h-4 w-4" />
                  <span>{t('Keluar')}</span>
                </button>
              </div>
            </>
          )}
        </div>
      </header>

      {/* Sub-Nav Frosted Glass */}
      <nav
        data-dashboard-nav
        className={`sticky top-[44px] z-40 flex min-h-[50px] items-center justify-between border-b px-3 sm:px-6 md:px-12 backdrop-blur-md transition-colors ${
          isDarkMode
            ? 'border-white/10 bg-[#1d1d1f]/80'
            : 'border-black/5 bg-[#f5f5f7]/80'
        }`}
      >
        <div className="flex items-center gap-2.5 sm:gap-3.5 min-w-0">
          {/* Tombol Page List di sebelah kiri */}
          <button
            type="button"
            aria-label={t('Buka Daftar Halaman & Menu')}
            title={t('Daftar Halaman & Menu')}
            onClick={handleOpenPageList}
            className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-full transition-all active:scale-95 ${
              isDarkMode
                ? 'text-[#f5f5f7] hover:bg-white/10 active:bg-white/15'
                : 'text-[#1d1d1f] hover:bg-black/5 active:bg-black/10'
            }`}
          >
            <HiOutlineMenuAlt2 aria-hidden="true" className="h-5 w-5" />
          </button>

          {/* Judul Halaman Aktif */}
          <div className="flex items-center gap-2 min-w-0">
            <span className="truncate text-[18px] font-semibold tracking-[-0.374px] sm:text-[21px] sm:tracking-[0.231px]">
              {activeTab === 'notes' ? t('Catatan Saya') : t('Sampah')}
            </span>

            {activeTab === 'trash' && (
              <span className={`shrink-0 rounded-full px-2 py-0.5 text-[11px] font-medium ${
                isDarkMode ? 'bg-[#ff453a]/20 text-[#ff453a]' : 'bg-[#ff3b30]/10 text-[#ff3b30]'
              }`}>
                {trashedNotes.length}
              </span>
            )}
          </div>
        </div>

        {activeTab === 'trash' && trashedNotes.length > 0 && (
          <button
            type="button"
            onClick={() => setConfirmation({ action: 'deleteAll', count: ownedTrashedCount })}
            className={`min-h-[36px] shrink-0 rounded-full px-3 text-[12px] sm:text-[13px] font-normal transition-all active:scale-95 ${
              isDarkMode
                ? 'text-[#ff453a] hover:bg-white/10'
                : 'text-[#ff3b30] hover:bg-black/5'
            }`}
          >
            {t('Kosongkan Sampah')}
          </button>
        )}
      </nav>

      {activeTab === 'notes' && !isFormOpen && (
        <NewNoteButton isDark={isDarkMode} onClick={handleNewNoteClick} />
      )}

      {/* Page List Drawer (Slide-over Sheet dari Kiri ala Apple) */}
      {isMounted && isPageListOpen && createPortal(
        <div className="fixed inset-0 z-[100] flex" inert={isPageListClosing}>
          {/* Backdrop Blur */}
          <div
            className={`fixed inset-0 bg-black/40 backdrop-blur-sm transition-opacity duration-200 ${
              isPageListClosing ? 'animate-modal-backdrop-exit' : 'animate-modal-backdrop'
            }`}
            onClick={() => handleClosePageList()}
            aria-hidden="true"
          />

          {/* Drawer Sheet */}
          <aside
            data-drawer
            aria-label={t('Daftar Halaman dan Pengaturan')}
            className={`relative z-10 flex h-full w-[280px] max-w-[82vw] flex-col justify-between border-r shadow-2xl backdrop-blur-2xl transition-all duration-300 overscroll-none ${
              isPageListClosing ? 'animate-drawer-slide-out' : 'animate-drawer-slide-in'
            } ${
              isDarkMode
                ? 'border-white/10 bg-[#1d1d1f]/95 text-[#f5f5f7] shadow-[8px_0_32px_rgba(0,0,0,0.6)]'
                : 'border-black/5 bg-[#f5f5f7]/95 text-[#1d1d1f] shadow-[8px_0_32px_rgba(0,0,0,0.15)]'
            }`}
          >
            {/* Header Drawer */}
            <div className="flex items-center justify-between px-4 py-2.5 border-b border-black/[0.04] dark:border-white/[0.06]">
              <span className="text-[15px] font-semibold tracking-[-0.374px]">Notes</span>
              <button
                type="button"
                aria-label={t('Tutup menu')}
                onClick={() => handleClosePageList()}
                className={`flex h-7 w-7 items-center justify-center rounded-full transition-all active:scale-95 ${
                  isDarkMode ? 'bg-white/10 text-[#f5f5f7] hover:bg-white/15' : 'bg-black/5 text-[#1d1d1f] hover:bg-black/10'
                }`}
              >
                <HiOutlineX aria-hidden="true" className="h-3.5 w-3.5" />
              </button>
            </div>

            {/* Konten Scrollable Drawer (Sleek & Ultra-Compact agar pas tanpa scroll di layar standar) */}
            <div className="flex-1 overflow-y-auto overscroll-contain px-3 py-2 space-y-2.5">
              {/* Section 1: Halaman (Catatan Utama & Sampah) */}
              <div>
                <p className="px-2 text-[10px] font-semibold uppercase tracking-wider text-[#7a7a7a] dark:text-[#86868b] mb-1">
                  {t('Halaman')}
                </p>
                <div className="space-y-1">
                  {/* Catatan Utama */}
                  <button
                    type="button"
                    onClick={() => {
                      setActiveTab('notes')
                      handleClosePageList()
                    }}
                    className={`flex w-full items-center justify-between rounded-[10px] px-3 py-1.5 text-left text-[14px] font-normal transition-all active:scale-[0.98] ${
                      activeTab === 'notes'
                        ? isDarkMode
                          ? 'bg-[#2997ff] text-white font-medium shadow-sm'
                          : 'bg-[#0066cc] text-white font-medium shadow-sm'
                        : isDarkMode
                        ? 'text-[#f5f5f7] hover:bg-white/10'
                        : 'text-[#1d1d1f] hover:bg-black/5'
                    }`}
                  >
                    <div className="flex items-center gap-2.5">
                      <HiOutlineDocumentText aria-hidden="true" className="text-base" />
                      <span>{t('Catatan Utama')}</span>
                    </div>
                    <span
                      className={`rounded-full px-2 py-0.5 text-[11px] font-semibold ${
                        activeTab === 'notes'
                          ? 'bg-white/20 text-white'
                          : isDarkMode
                          ? 'bg-white/10 text-[#86868b]'
                          : 'bg-black/5 text-[#7a7a7a]'
                      }`}
                    >
                      {activeNotes.length}
                    </span>
                  </button>

                  {/* Sampah */}
                  <button
                    type="button"
                    onClick={() => {
                      setActiveTab('trash')
                      handleClosePageList()
                    }}
                    className={`flex w-full items-center justify-between rounded-[10px] px-3 py-1.5 text-left text-[14px] font-normal transition-all active:scale-[0.98] ${
                      activeTab === 'trash'
                        ? isDarkMode
                          ? 'bg-[#2997ff] text-white font-medium shadow-sm'
                          : 'bg-[#0066cc] text-white font-medium shadow-sm'
                        : isDarkMode
                        ? 'text-[#f5f5f7] hover:bg-white/10'
                        : 'text-[#1d1d1f] hover:bg-black/5'
                    }`}
                  >
                    <div className="flex items-center gap-2.5">
                      <HiOutlineTrash aria-hidden="true" className="text-base" />
                      <span>{t('Sampah')}</span>
                    </div>
                    <span
                      className={`rounded-full px-2 py-0.5 text-[11px] font-semibold ${
                        activeTab === 'trash'
                          ? 'bg-white/20 text-white'
                          : isDarkMode
                          ? 'bg-white/10 text-[#86868b]'
                          : 'bg-black/5 text-[#7a7a7a]'
                      }`}
                    >
                      {trashedNotes.length}
                    </span>
                  </button>
                </div>
              </div>

              {/* Section 2: Pengaturan Akun */}
              <div>
                <p className="px-2 text-[10px] font-semibold uppercase tracking-wider text-[#7a7a7a] dark:text-[#86868b] mb-1">
                  {t('Akun & Preferensi')}
                </p>
                <div className="space-y-1">
                  <button
                    type="button"
                    onClick={() => {
                      handleClosePageList(() => {
                        setSettingsName(profile?.full_name || '')
                        setSettingsPassword('')
                        setSettingsMessage('')
                        setIsSettingsOpen(true)
                      })
                    }}
                    className={`flex w-full items-center gap-2.5 rounded-[10px] px-3 py-1.5 text-left text-[14px] transition-all active:scale-[0.98] ${
                      isDarkMode
                        ? 'text-[#f5f5f7] hover:bg-white/10'
                        : 'text-[#1d1d1f] hover:bg-black/5'
                    }`}
                  >
                    <HiOutlineCog aria-hidden="true" className="text-base" />
                    <span>{t('Pengaturan Akun')}</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => handleClosePageList(() => setIsApplicationSettingsOpen(true))}
                    className={`flex w-full items-center gap-2.5 rounded-[10px] px-3 py-1.5 text-left text-[14px] transition-all active:scale-[0.98] ${
                      isDarkMode
                        ? 'text-[#f5f5f7] hover:bg-white/10'
                        : 'text-[#1d1d1f] hover:bg-black/5'
                    }`}
                  >
                    <HiOutlineCog aria-hidden="true" className="text-base" />
                    <span>{t('Pengaturan Aplikasi')}</span>
                  </button>
                </div>
              </div>

              {/* Section 3: Paket Premium / Free yang sedang aktif */}
              <div>
                <p className="px-2 text-[10px] font-semibold uppercase tracking-wider text-[#7a7a7a] dark:text-[#86868b] mb-1">
                  {t('Paket Langganan')}
                </p>
                <div
                  className={`rounded-[12px] border p-2 transition-colors ${
                    isDarkMode
                      ? 'border-white/10 bg-[#252527]/70'
                      : 'border-black/5 bg-white/70'
                  }`}
                >
                  <div className="flex items-center justify-between">
                    <span className="text-[12px] font-semibold">
                      {isPremium ? <><HiStar aria-hidden="true" className="mr-1 inline-block align-middle" />{t('Paket Premium')}</> : t('Free Plan')}
                    </span>
                    <span
                      className={`rounded-full px-2 py-0.5 text-[10px] font-semibold ${
                        isPremium
                          ? isDarkMode
                            ? 'bg-[#2997ff]/20 text-[#2997ff]'
                            : 'bg-[#0066cc]/10 text-[#0066cc]'
                          : isDarkMode
                          ? 'bg-white/10 text-[#86868b]'
                          : 'bg-black/5 text-[#7a7a7a]'
                      }`}
                    >
                      {isPremium ? t('Aktif') : t('Standar')}
                    </span>
                  </div>
                  <p className="mt-0.5 text-[11px] text-[#7a7a7a] dark:text-[#86868b] leading-tight">
                    {isPremium
                      ? t('Folder tak terbatas & kolaborasi aktif.')
                      : t('Maksimal 1 folder.')}
                  </p>
                  <button
                    type="button"
                    onClick={() => {
                      handleClosePageList(() => {
                        openPlanDetails()
                      })
                    }}
                    className={`mt-1.5 flex w-full min-h-[28px] items-center justify-center rounded-full text-[11px] font-medium transition-all active:scale-95 ${
                      isPremium
                        ? isDarkMode
                          ? 'border border-white/15 bg-white/5 text-[#f5f5f7] hover:bg-white/10'
                          : 'border border-black/10 bg-black/5 text-[#1d1d1f] hover:bg-black/10'
                        : isDarkMode
                        ? 'bg-[#2997ff] text-white hover:bg-[#0071e3]'
                        : 'bg-[#0066cc] text-white hover:bg-[#0055b3]'
                    }`}
                  >
                    {isPremium ? t('Detail Langganan') : t('Tingkatkan ke Premium')}
                  </button>
                </div>
              </div>

              {/* Section 4: Pengaturan Tema Terang atau Gelap */}
              <div>
                <p className="px-2 text-[10px] font-semibold uppercase tracking-wider text-[#7a7a7a] dark:text-[#86868b] mb-1">
                  {t('Tampilan')}
                </p>
                <div
                  className={`flex items-center justify-between rounded-[12px] border px-3 py-1.5 transition-colors ${
                    isDarkMode
                      ? 'border-white/10 bg-[#252527]/70'
                      : 'border-black/5 bg-white/70'
                  }`}
                >
                  <div className="flex items-center gap-2">
                    <span className="text-base">{isDarkMode ? <HiOutlineMoon aria-hidden="true" /> : <HiOutlineSun aria-hidden="true" />}</span>
                    <span className="text-[12px] font-medium">
                      {isDarkMode ? t('Mode Gelap') : t('Mode Terang')}
                    </span>
                  </div>
                  <button
                    type="button"
                    role="switch"
                    aria-checked={isDarkMode}
                    aria-label={t('Alihkan tema terang atau gelap')}
                    onClick={toggleDarkMode}
                    className={`relative h-5 w-10 shrink-0 rounded-full transition-colors duration-200 active:scale-95 ${
                      isDarkMode ? 'bg-[#0066cc]' : 'bg-[#d2d2d7]'
                    }`}
                  >
                    <span
                      className={`absolute left-0.5 top-0.5 h-4 w-4 rounded-full bg-white transition-transform duration-200 shadow-sm ${
                        isDarkMode ? 'translate-x-5' : 'translate-x-0'
                      }`}
                    />
                  </button>
                </div>
              </div>
            </div>

            {/* Footer Profil Pengguna ala Apple di Bawah Page List */}
            <div className="p-3 border-t border-black/[0.06] dark:border-white/[0.08] bg-black/[0.02] dark:bg-white/[0.02]">
              <button
                type="button"
                onClick={() => {
                  handleClosePageList(() => {
                    setSettingsName(profile?.full_name || '')
                    setSettingsPassword('')
                    setSettingsMessage('')
                    setIsSettingsOpen(true)
                  })
                }}
                className={`flex w-full items-center gap-3 rounded-[12px] p-2 text-left transition-all active:scale-[0.98] ${
                  isDarkMode ? 'hover:bg-white/10' : 'hover:bg-black/5'
                }`}
              >
                {(profile?.avatar_url || user.user_metadata?.avatar_url) ? (
                  <Image
                    src={profile?.avatar_url || user.user_metadata.avatar_url}
                    alt=""
                    width={38}
                    height={38}
                    unoptimized
                    className="h-9.5 w-9.5 shrink-0 rounded-full object-cover border border-black/10 dark:border-white/15 shadow-sm"
                  />
                ) : (
                  <span className={`flex h-9.5 w-9.5 shrink-0 items-center justify-center rounded-full text-[14px] font-semibold shadow-sm ${
                    isDarkMode ? 'bg-[#2997ff] text-white' : 'bg-[#0066cc] text-white'
                  }`}>
                    {(profile?.full_name || user.email || 'U').slice(0, 1).toUpperCase()}
                  </span>
                )}
                <div className="min-w-0 flex-1">
                  <p className={`truncate text-[14px] font-semibold leading-snug tracking-[-0.2px] ${
                    isDarkMode ? 'text-[#f5f5f7]' : 'text-[#1d1d1f]'
                  }`}>
                    {profile?.full_name || user.user_metadata?.full_name || t('Akun Notes')}
                  </p>
                  <p className={`truncate text-[12px] leading-tight ${
                    isDarkMode ? 'text-[#86868b]' : 'text-[#7a7a7a]'
                  }`}>
                    {user.email}
                  </p>
                </div>
              </button>
            </div>
          </aside>
        </div>,
        document.body
      )}

      {/* Content Area */}
      <main data-dashboard-main data-motion-content className="mx-auto w-full max-w-[1440px] flex-1 px-4 py-6 pb-28 sm:px-6 sm:py-8 sm:pb-28 md:px-12">
        {premiumMessage && (
          <div role="status" className="mb-5 flex items-center justify-between gap-4 rounded-[11px] border border-[#e0e0e0] bg-white px-4 py-3 text-[14px] text-[#1d1d1f]">
            <span>{premiumMessage}</span>
            <button aria-label={t('Tutup pesan')} onClick={() => setPremiumMessage('')} className="min-h-11 rounded-full px-3 text-[#0066cc] active:scale-95">{t('Tutup')}</button>
          </div>
        )}

        {activeTab === 'notes' && isPremium && (
          <div className="mb-6 flex flex-wrap items-center gap-3">
            <label className="sr-only" htmlFor="folder-filter">{t('Filter folder')}</label>
            <select
              id="folder-filter"
              value={folderFilter}
              onChange={(event) => setFolderFilter(event.target.value)}
              className="h-11 min-w-40 rounded-full border border-[#e0e0e0] bg-white px-4 text-[14px] text-[#1d1d1f] outline-none focus-visible:ring-2 focus-visible:ring-[#0071e3]"
            >
              <option value="all">{t('Semua catatan')}</option>
              <option value="">{t('Tanpa folder')}</option>
              {folders.map((folder) => <option key={folder.id} value={String(folder.id)}>{folder.name}</option>)}
            </select>
            {isCreatingFolder ? (
              <form onSubmit={createFolder} className="flex flex-wrap items-center gap-2">
                <input
                  autoFocus
                  required
                  maxLength={80}
                  aria-label={t('Nama folder baru')}
                  value={folderName}
                  onChange={(event) => setFolderName(event.target.value)}
                  placeholder={t('Nama folder')}
                  className="h-11 w-48 rounded-full border border-[#e0e0e0] bg-white px-4 text-[14px] outline-none focus-visible:ring-2 focus-visible:ring-[#0071e3]"
                />
                <button className="min-h-11 rounded-full bg-[#0066cc] px-4 text-[14px] text-white active:scale-95">{t('Buat')}</button>
                <button type="button" onClick={() => setIsCreatingFolder(false)} className="min-h-11 rounded-full px-3 text-[14px] text-[#0066cc] active:scale-95">{t('Batal')}</button>
              </form>
            ) : (
              <button onClick={() => setIsCreatingFolder(true)} className="min-h-11 rounded-full border border-[#0066cc] px-4 text-[14px] text-[#0066cc] active:scale-95"><HiOutlinePlus aria-hidden="true" className="mr-1 inline-block align-middle" />{t('Folder')}</button>
            )}
          </div>
        )}

        {/* Note editor modal */}
        {isMounted && isFormOpen && activeTab === 'notes' && createPortal(
          <div
            inert={isFormClosing}
            className={`fixed inset-0 z-[120] flex items-center justify-center bg-black/40 p-2 backdrop-blur-sm sm:p-4 ${isFormClosing ? 'animate-modal-backdrop-exit' : 'animate-modal-backdrop'}`}
            onMouseDown={(event) => {
              if (event.target === event.currentTarget) closeNoteForm()
            }}
          >
            {/* Portals need their own theme scope outside the dashboard DOM tree. */}
            <div className={`contents ${isDarkMode ? 'theme-dark' : ''}`}>
              <form
                onSubmit={handleSaveNote}
                style={{ backgroundColor: getAccentSurface(accentColor) }}
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
                      aria-label={t('Judul catatan')}
                      autoFocus={editingNoteId === null}
                      type="text"
                      placeholder={editingNoteId ? t('Tanpa Judul') : t('Buat Catatan Baru')}
                      value={title}
                      onChange={(event) => {
                        setTitle(event.target.value)
                        setSaveStatus('idle')
                      }}
                      className="w-full min-w-0 bg-transparent text-[21px] font-semibold leading-[1.2] text-[#1d1d1f] outline-none placeholder:text-[#7a7a7a] focus-visible:ring-2 focus-visible:ring-[#0071e3]"
                    />
                    <p aria-live="polite" className="mt-2 min-h-5 text-[12px] text-[#7a7a7a]">
                      {saveStatus === 'saving' && t('Menyimpan...')}
                      {saveStatus === 'saved' && <><HiOutlineCheck aria-hidden="true" className="mr-1 inline-block align-middle" />{t('Autosave complete')}</>}
                      {saveStatus === 'error' && t('Gagal menyimpan. Periksa koneksi lalu coba lagi.')}
                    </p>
                  </div>
                  <button
                    type="button"
                    aria-label={t('Tutup editor')}
                    onClick={closeNoteForm}
                    className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full text-[24px] text-[#7a7a7a] transition-colors hover:bg-black/5 active:scale-95"
                  >
                    <HiOutlineX aria-hidden="true" />
                  </button>
                </div>
                <textarea
                  aria-label={t('Isi catatan')}
                  placeholder={t('Tulis isi catatan di sini...')}
                  value={content}
                  onChange={(e) => {
                    setContent(e.target.value)
                    setSaveStatus('idle')
                  }}
                  rows={10}
                  className="mb-5 min-h-[180px] w-full resize-y bg-transparent text-[17px] leading-[1.47] text-[#1d1d1f] focus:outline-none sm:mb-6 sm:min-h-[240px]"
                />
                {(isPremium || notes.find((item) => item.id === editingNoteId)?.user_id !== user.id) && editingNoteId !== null && (
                  <section className="mb-6 border-t border-[#f0f0f0] pt-5" aria-label={t('Kolaborator catatan')}>
                    <div className="flex flex-wrap items-center justify-between gap-3">
                      <div>
                        <h3 className="text-[14px] font-semibold text-[#1d1d1f]">
                          {notes.find((item) => item.id === editingNoteId)?.user_id === user.id
                            ? t('Akses bersama')
                            : t('Notes ini adalah shared dari pembuat kolaborasi')}
                        </h3>
                        <p className="mt-1 text-[12px] text-[#7a7a7a]">{onlineMembers.length ? t('{count} lainnya sedang membuka catatan', { count: onlineMembers.length }) : t('Tidak ada kolaborator lain yang sedang aktif')}</p>
                      </div>
                      <div className="flex -space-x-2" aria-label={t('Pengguna yang mengakses catatan')}>
                        {[...noteMembers, ...onlineMembers]
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
                        <span key={person.user_id} className="rounded-full bg-[#f5f5f7] px-3 py-1.5 text-[12px] text-[#333333]">{person.full_name || t('Kolaborator')}</span>
                      ))}
                    </div>
                    {notes.find((item) => item.id === editingNoteId)?.user_id === user.id && (
                      <div className="mt-4 flex flex-wrap gap-2">
                        <input
                          type="email"
                          aria-label={t('Email kolaborator')}
                          placeholder={t('Email akun Notes')}
                          value={inviteEmail}
                          onChange={(event) => setInviteEmail(event.target.value)}
                          className="h-11 min-w-0 flex-1 rounded-full border border-[#e0e0e0] bg-white px-4 text-[14px] outline-none focus-visible:ring-2 focus-visible:ring-[#0071e3]"
                        />
                        <button type="button" onClick={inviteCollaborator} className="min-h-11 rounded-full bg-[#0066cc] px-4 text-[14px] text-white active:scale-95">{t('Undang')}</button>
                      </div>
                    )}
                    {sharingMessage && <p aria-live="polite" className="mt-2 text-[12px] text-[#7a7a7a]">{sharingMessage}</p>}
                  </section>
                )}
                <div className="flex flex-wrap items-center justify-between gap-3 border-t border-[#f0f0f0] pt-4 sm:gap-4 sm:pt-5">
                  <div className="flex flex-wrap items-center gap-3">
                    <span className="text-[12px] text-[#7a7a7a]">{t('Aksen warna')}</span>
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
                        style={{ backgroundColor: getAccentSurface(color.value) }}
                        className={`h-7 w-7 rounded-full border border-black/10 transition-transform active:scale-95 ${
                          accentColor === color.value
                            ? `ring-2 ring-[#0066cc] ring-offset-2 ${isDarkMode ? 'ring-offset-[#252527]' : 'ring-offset-white'}`
                            : ''
                        }`}
                      />
                    ))}
                  </div>
                  {isPremium && (
                    <div className="flex items-center gap-2 text-[12px] text-[#7a7a7a]">
                      <span>{t('Folder')}</span>
                      <div className="relative">
                        <button
                          ref={folderPickerButtonRef}
                          type="button"
                          aria-haspopup="listbox"
                          aria-expanded={isFolderMenuOpen}
                          onClick={() => setIsFolderMenuOpen((open) => !open)}
                          onKeyDown={(event) => {
                            if (event.key === 'ArrowDown' || event.key === 'Enter' || event.key === ' ') {
                              event.preventDefault()
                              setIsFolderMenuOpen(true)
                            }
                          }}
                          className="flex h-11 max-w-[min(56vw,240px)] min-w-[130px] items-center justify-between gap-4 rounded-full border border-[#e0e0e0] bg-white px-4 text-left text-[14px] text-[#1d1d1f] transition-colors hover:bg-[#fafafc] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#0071e3]"
                        >
                          <span className="truncate">{folders.find((folder) => String(folder.id) === selectedFolderId)?.name ?? t('Tanpa folder')}</span>
                          <span aria-hidden="true" className={`text-[11px] transition-transform ${isFolderMenuOpen ? 'rotate-180' : ''}`}><HiOutlineChevronDown aria-hidden="true" /></span>
                        </button>
                      </div>
                    </div>
                  )}
                  <div className="ml-auto flex gap-2">
                    <button
                      type="button"
                      onClick={closeNoteForm}
                      className="min-h-11 rounded-full px-4 text-[14px] text-[#7a7a7a] transition-colors hover:bg-black/5 active:scale-95"
                    >
                      {t('Tutup')}
                    </button>
                    <button
                      type="submit"
                      className="min-h-11 rounded-full bg-[#0066cc] px-[22px] text-[14px] text-white transition-all hover:bg-[#0071e3] active:scale-95"
                    >
                      {t('Simpan')}
                    </button>
                  </div>
                </div>
              </form>
            </div>
          </div>,
          document.body
        )}

        {/* TAB 1: UTAMA (Active Notes) */}
        {activeTab === 'notes' && (
          <div key="notes-tab" className="animate-tab-enter">
            {activeNotes.length === 0 ? (
              <div className="text-center py-20 text-[#7a7a7a]">
                <p className="text-[21px] font-semibold mb-2">{t('Belum ada catatan')}</p>
                <p className="text-[17px]">{t('Klik "{button}" di kanan bawah untuk mulai menulis.', { button: t('New Notes') })}</p>
              </div>
            ) : (
              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 sm:gap-5 lg:grid-cols-3 lg:gap-6">
                {activeNotes.map((note, index) => (
                  <article
                    key={note.id}
                    style={{ backgroundColor: getAccentSurface(note.accent_color || '#ffffff'), animationDelay: `${Math.min(index, 7) * 30}ms` }}
                    data-note-card
                    role="button"
                    tabIndex={0}
                    aria-label={t('Buka catatan {name}', { name: note.title || t('Tanpa Judul') })}
                    onClick={() => handleNoteCardClick(note)}
                    onKeyDown={(event) => {
                      if (event.key === 'Enter' || event.key === ' ') {
                        event.preventDefault()
                        handleNoteCardClick(note)
                      }
                    }}
                    className="relative group flex min-w-0 cursor-pointer flex-col justify-between rounded-[18px] border border-[#e0e0e0] p-5 transition-all duration-200 hover:border-[#0066cc]/40 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#0071e3] sm:p-6"
                  >
                    <div>
                      <div className="flex items-start justify-between mb-2 gap-2">
                        <h3 className="min-w-0 flex-1 truncate text-[17px] font-semibold text-[#1d1d1f] tracking-[-0.374px]">
                          {note.title || t('Tanpa Judul')}
                        </h3>
                        {/* Pin Button */}
                        {note.user_id === user.id && <button
                          aria-label={note.is_pinned ? t('Lepas pin catatan') : t('Pin catatan')}
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
                          <span aria-hidden="true" className="mr-1 inline-block">{note.is_pinned ? <BsPinFill aria-hidden="true" /> : <BsPin aria-hidden="true" />}</span>
                          {note.is_pinned ? t('Disematkan') : t('Sematkan')}
                        </button>}
                      </div>

                      <p className="text-[17px] text-[#1d1d1f]/80 leading-[1.47] line-clamp-4 mb-6 whitespace-pre-wrap">
                        {note.content || t('Gak ada isi teks...')}
                      </p>
                    </div>

                    <div className="flex flex-col gap-2 border-t border-black/5 pt-3 text-[12px] text-[#7a7a7a] sm:flex-row sm:items-center sm:justify-between">
                      <div>
                        <div>{t('Dibuat: {date}', { date: formatDate(note.created_at) })}</div>
                        <div>{t('Edit: {date}', { date: formatDate(note.updated_at) })}</div>
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
                            {t('Buang')}
                          </button>
                        ) : (
                          <div className="flex min-h-11 items-center gap-2 px-2">
                            <span className="text-[12px] text-[#7a7a7a]">{t('Dibagikan')}</span>
                            <div
                              className="flex items-center pl-1"
                              aria-label={t('Dibagikan oleh {name}', { name: notePeopleById[note.id]?.map((person) => person.full_name || t('pengguna')).join(', ') || t('pemilik catatan') })}
                            >
                              {(notePeopleById[note.id] ?? []).slice(0, 4).map((person) => (
                                <span
                                  key={person.user_id}
                                  title={person.full_name || t('Pengguna note')}
                                  className="-ml-1 flex h-7 w-7 items-center justify-center overflow-hidden rounded-full border-2 border-white bg-[#f5f5f7] text-[10px] text-[#1d1d1f] first:ml-0"
                                >
                                  {person.avatar_url
                                    ? <Image src={person.avatar_url} alt={person.full_name || t('Foto profil')} width={28} height={28} unoptimized className="h-full w-full object-cover" />
                                    : (person.full_name || '?').slice(0, 1).toUpperCase()}
                                </span>
                              ))}
                              {(notePeopleById[note.id]?.length ?? 0) > 4 && (
                                <span className="-ml-1 flex h-7 min-w-7 items-center justify-center rounded-full border-2 border-white bg-[#f5f5f7] px-1 text-[9px] text-[#1d1d1f]">
                                  +{(notePeopleById[note.id]?.length ?? 0) - 4}
                                </span>
                              )}
                            </div>
                          </div>
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
            {ownedTrashedCount > 0 && (
              <div className="mb-5 flex flex-wrap items-center justify-between gap-3">
                <p className="text-[14px] text-[#7a7a7a]">{t('{count} catatan milikmu di tong sampah', { count: ownedTrashedCount })}</p>
                <button
                  type="button"
                  onClick={() => setConfirmation({ action: 'deleteAll', count: ownedTrashedCount })}
                  className="min-h-11 rounded-full border border-[#0066cc] px-4 text-[14px] text-[#0066cc] transition-colors hover:bg-[#0066cc]/5 active:scale-95"
                >
                  {t('Hapus Semua')}
                </button>
              </div>
            )}
            {trashedNotes.length === 0 ? (
              <div className="text-center py-20 text-[#7a7a7a]">
                <p className="text-[21px] font-semibold mb-2">{t('Tong sampah kosong')}</p>
                <p className="text-[17px]">{t('Tidak ada catatan yang dibuang.')}</p>
              </div>
            ) : (
              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 sm:gap-5 lg:grid-cols-3 lg:gap-6">
                {trashedNotes.map((note, index) => (
                  <div
                    key={note.id}
                    style={{ backgroundColor: getAccentSurface(note.accent_color || '#ffffff'), animationDelay: `${Math.min(index, 7) * 30}ms` }}
                    data-note-card
                    className="flex min-w-0 flex-col justify-between rounded-[18px] border border-[#e0e0e0] bg-[#ffffff] p-5 opacity-80 sm:p-6"
                  >
                    <div>
                      <h3 className="text-[17px] font-semibold text-[#1d1d1f] mb-2 line-clamp-1">
                        {note.title || t('Tanpa Judul')}
                      </h3>
                      <p className="text-[17px] text-[#7a7a7a] line-clamp-3 mb-4">
                        {note.content}
                      </p>
                    </div>

                    <div className="flex flex-col gap-2 border-t border-[#f0f0f0] pt-3 text-[12px] sm:flex-row sm:items-center sm:justify-between">
                      <span className="text-[#7a7a7a]">{t('Dibuang')}</span>
                      <div className="flex flex-wrap gap-x-2 gap-y-1 self-end sm:self-auto sm:gap-3">
                        <button
                          onClick={() => toggleTrash(note)}
                          className="text-[#0066cc] font-normal hover:underline active:scale-95"
                        >
                          {t('Pulihkan')}
                        </button>
                        <button
                          onClick={() => setConfirmation({ action: 'delete', note })}
                          className="min-h-11 px-2 font-normal text-[#0066cc] hover:underline active:scale-95"
                        >
                          {t('Hapus Permanen')}
                        </button>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {folderMenuPresence.isPresent && folderMenuPosition && typeof document !== 'undefined' && createPortal(
          <div
            role="listbox"
            aria-label={t('Pilih folder catatan')}
            data-folder-listbox
            data-motion-state={folderMenuPresence.isExiting ? 'closing' : 'open'}
            data-motion-kind="popover"
            inert={folderMenuPresence.isExiting}
            ref={folderMenuRef}
            style={{
              top: folderMenuPosition.top,
              left: folderMenuPosition.left,
              width: folderMenuPosition.width,
              maxHeight: folderMenuPosition.maxHeight,
            }}
            className="motion-popover fixed z-[100] max-h-52 overflow-y-auto rounded-[11px] border border-[#e0e0e0] bg-white p-1 text-[#1d1d1f]"
          >
            {[{ id: '', name: t('Tanpa folder') }, ...folders.map((folder) => ({ id: String(folder.id), name: folder.name }))].map((folder) => (
              <button
                key={folder.id || 'no-folder'}
                type="button"
                role="option"
                aria-selected={selectedFolderId === folder.id}
                onClick={() => {
                  setSelectedFolderId(folder.id)
                  setSaveStatus('idle')
                  setIsFolderMenuOpen(false)
                }}
                className={`min-h-10 w-full rounded-full px-3 text-left text-[14px] transition-colors hover:bg-[#f5f5f7] ${selectedFolderId === folder.id ? 'text-[#0066cc]' : ''}`}
              >
                {folder.name}
              </button>
            ))}
          </div>,
          document.body,
        )}

        {isMounted && confirmationPresence.isPresent && confirmationPresence.value && createPortal(
          <div
            data-motion-state={confirmationPresence.isExiting ? 'closing' : 'open'}
            inert={confirmationPresence.isExiting}
            className="fixed inset-0 z-[130] flex items-center justify-center bg-black/40 p-2 backdrop-blur-sm animate-modal-backdrop sm:p-4"
            onMouseDown={(event) => {
              if (event.target === event.currentTarget) setConfirmation(null)
            }}
          >
            <section
              role="alertdialog"
              aria-modal="true"
              aria-labelledby="confirmation-title"
              aria-describedby="confirmation-description"
              className={`max-h-[90dvh] w-full max-w-[420px] overflow-y-auto rounded-[18px] border p-5 animate-confirm-enter sm:p-7 shadow-2xl backdrop-blur-2xl ${
                isDarkMode
                  ? 'border-white/10 bg-[#252527]/95 text-[#f5f5f7]'
                  : 'border-[#e0e0e0] bg-white/95 text-[#1d1d1f]'
              }`}
            >
              <div className={`mb-5 flex h-11 w-11 items-center justify-center rounded-full text-[21px] font-semibold ${
                isDarkMode ? 'bg-white/10 text-[#2997ff]' : 'bg-[#f5f5f7] text-[#0066cc]'
              }`} aria-hidden="true">
                {confirmationPresence.value.action === 'trash' ? <HiOutlineTrash aria-hidden="true" /> : <HiOutlineX aria-hidden="true" />}
              </div>
              <h2 id="confirmation-title" className={`text-[21px] font-semibold leading-[1.2] tracking-[-0.2px] ${
                isDarkMode ? 'text-[#f5f5f7]' : 'text-[#1d1d1f]'
              }`}>
                {confirmationPresence.value.action === 'trash'
                  ? t('Pindahkan ke Tong Sampah?')
                  : confirmationPresence.value.action === 'deleteAll'
                    ? t('Hapus Semua Catatan Permanen?')
                    : t('Hapus Catatan Permanen?')}
              </h2>
              <p id="confirmation-description" className={`mt-3 text-[17px] leading-[1.47] ${
                isDarkMode ? 'text-[#86868b]' : 'text-[#1d1d1f]'
              }`}>
                {confirmationPresence.value.action === 'trash'
                  ? t('“{name}” akan dipindahkan ke tong sampah. Kamu masih bisa memulihkannya nanti.', { name: confirmationPresence.value.note?.title || t('Tanpa Judul') })
                  : confirmationPresence.value.action === 'deleteAll'
                    ? t('{count} catatan milikmu di tong sampah akan dihapus permanen dan tidak dapat dipulihkan.', { count: confirmationPresence.value.count ?? ownedTrashedCount })
                    : t('“{name}” akan dihapus selamanya dan tidak dapat dipulihkan.', { name: confirmationPresence.value.note?.title || t('Tanpa Judul') })}
              </p>
              <div className="mt-6 flex flex-wrap justify-end gap-2 sm:mt-7 sm:gap-3">
                <button
                  type="button"
                  autoFocus
                  onClick={() => setConfirmation(null)}
                  className={`min-h-11 rounded-full px-[18px] text-[14px] transition-colors active:scale-95 ${
                    isDarkMode ? 'text-[#2997ff] hover:bg-white/10' : 'text-[#0066cc] hover:bg-[#f5f5f7]'
                  }`}
                >
                  {t('Batal')}
                </button>
                <button
                  type="button"
                  onClick={confirmDestructiveAction}
                  disabled={confirmationPresence.isExiting || !confirmation}
                  className={`min-h-11 rounded-full px-[20px] text-[14px] text-white transition-all active:scale-95 ${
                    isDarkMode ? 'bg-[#2997ff] hover:bg-[#0071e3]' : 'bg-[#0066cc] hover:bg-[#0071e3]'
                  }`}
                >
                  {confirmationPresence.value.action === 'trash'
                    ? t('Pindahkan')
                    : confirmationPresence.value.action === 'deleteAll'
                      ? t('Hapus Semua')
                      : t('Hapus Permanen')}
                </button>
              </div>
            </section>
          </div>,
          document.body
        )}

        {isMounted && applicationSettingsPresence.isPresent && createPortal(
          <ApplicationSettings
            isDark={isDarkMode}
            isClosing={applicationSettingsPresence.isExiting}
            onClose={() => setIsApplicationSettingsOpen(false)}
          />,
          document.body
        )}

        {isMounted && accountSettingsPresence.isPresent && createPortal(
          <div
            data-motion-state={accountSettingsPresence.isExiting ? 'closing' : 'open'}
            inert={accountSettingsPresence.isExiting}
            className="fixed inset-0 z-[120] flex items-center justify-center bg-black/40 p-3 backdrop-blur-sm animate-modal-backdrop sm:p-4"
            onMouseDown={(event) => {
              if (event.target === event.currentTarget) setIsSettingsOpen(false)
            }}
          >
            <form
              onSubmit={handleSaveSettings}
              role="dialog"
              aria-modal="true"
              aria-labelledby="account-settings-title"
              className={`max-h-[90dvh] w-full max-w-[520px] overflow-y-auto overscroll-contain rounded-[18px] border p-5 animate-modal-enter sm:max-h-[min(82vh,720px)] sm:p-8 shadow-2xl backdrop-blur-2xl ${
                isDarkMode
                  ? 'border-white/10 bg-[#252527]/95 text-[#f5f5f7]'
                  : 'border-[#e0e0e0] bg-white/95 text-[#1d1d1f]'
              }`}
            >
              <div className="mb-6 flex items-start justify-between gap-4">
                <div>
                  <h2 id="account-settings-title" className={`text-[28px] font-semibold leading-[1.14] tracking-[-0.3px] ${isDarkMode ? 'text-[#f5f5f7]' : 'text-[#1d1d1f]'}`}>{t('Pengaturan Akun')}</h2>
                  <p className={`mt-2 text-[14px] ${isDarkMode ? 'text-[#86868b]' : 'text-[#7a7a7a]'}`}>{t('Kelola informasi profil dan keamanan akun.')}</p>
                </div>
                <button type="button" aria-label={t('Tutup pengaturan')} onClick={() => setIsSettingsOpen(false)} className={`flex h-11 w-11 items-center justify-center rounded-full text-[24px] active:scale-95 ${isDarkMode ? 'text-[#86868b] hover:bg-white/10' : 'text-[#7a7a7a] hover:bg-[#f5f5f7]'}`}><HiOutlineX aria-hidden="true" /></button>
              </div>

              <div className="mb-6 flex items-center gap-4">
                {(profile?.avatar_url || user.user_metadata?.avatar_url) ? (
                  <Image src={profile?.avatar_url || user.user_metadata.avatar_url} alt={t('Foto profil')} width={64} height={64} unoptimized className="h-16 w-16 rounded-full object-cover" />
                ) : (
                  <span className={`flex h-16 w-16 items-center justify-center rounded-full text-[24px] ${isDarkMode ? 'bg-white/10 text-[#f5f5f7]' : 'bg-[#f5f5f7] text-[#1d1d1f]'}`}>{(profile?.full_name || user.email || 'U').slice(0, 1).toUpperCase()}</span>
                )}
                <label className={`inline-flex min-h-11 cursor-pointer items-center rounded-full border px-4 text-[14px] active:scale-95 ${isDarkMode ? 'border-[#2997ff] text-[#2997ff]' : 'border-[#0066cc] text-[#0066cc]'}`}>
                  {t('Ubah Foto')}
                  <input type="file" accept="image/*" className="sr-only" onChange={handleAvatarUpload} />
                </label>
              </div>

              <label className={`mb-5 block text-[14px] ${isDarkMode ? 'text-[#f5f5f7]' : 'text-[#333333]'}`}>
                {t('Nama pengguna')}
                <input
                  required
                  maxLength={80}
                  autoComplete="name"
                  value={settingsName}
                  onChange={(event) => setSettingsName(event.target.value)}
                  className={`mt-2 h-11 w-full rounded-[8px] border px-3 text-[17px] outline-none focus-visible:ring-2 focus-visible:ring-[#0071e3] ${
                    isDarkMode
                      ? 'border-white/15 bg-white/5 text-[#f5f5f7]'
                      : 'border-[#e0e0e0] bg-white text-[#1d1d1f]'
                  }`}
                />
              </label>

              <p className={`mb-5 text-[14px] ${isDarkMode ? 'text-[#86868b]' : 'text-[#7a7a7a]'}`}>{t('Email: {email}', { email: user.email ?? '' })}</p>
              {((user.app_metadata?.providers as string[] | undefined) ?? []).includes('email') ? (
                <label className={`block text-[14px] ${isDarkMode ? 'text-[#f5f5f7]' : 'text-[#333333]'}`}>
                  {t('Kata sandi baru')} <span className={isDarkMode ? 'text-[#86868b]' : 'text-[#7a7a7a]' }>{t('(opsional)')}</span>
                  <span className={`mt-2 flex h-11 items-center rounded-[8px] border focus-within:ring-2 focus-within:ring-[#0071e3] ${
                    isDarkMode ? 'border-white/15 bg-white/5' : 'border-[#e0e0e0] bg-white'
                  }`}>
                    <input
                      type={showSettingsPassword ? 'text' : 'password'}
                      minLength={8}
                      autoComplete="new-password"
                      value={settingsPassword}
                      onChange={(event) => setSettingsPassword(event.target.value)}
                      className={`h-full min-w-0 flex-1 bg-transparent px-3 text-[17px] outline-none ${isDarkMode ? 'text-[#f5f5f7]' : 'text-[#1d1d1f]'}`}
                    />
                    <button type="button" aria-label={showSettingsPassword ? t('Sembunyikan password') : t('Tampilkan password')} onClick={() => setShowSettingsPassword((visible) => !visible)} className={`h-11 rounded-full px-3 text-[12px] active:scale-95 ${isDarkMode ? 'text-[#2997ff]' : 'text-[#0066cc]'}`}>{showSettingsPassword ? t('Sembunyikan') : t('Tampilkan')}</button>
                  </span>
                </label>
              ) : (
                <p className={`rounded-[8px] p-3 text-[14px] leading-[1.47] ${isDarkMode ? 'bg-white/5 text-[#86868b]' : 'bg-[#f5f5f7] text-[#7a7a7a]'}`}>{t('Akun ini masuk dengan Google. Penggantian password dikelola melalui akun Google.')}</p>
              )}

              {settingsMessage && <p aria-live="polite" className={`mt-4 text-[14px] ${isDarkMode ? 'text-[#f5f5f7]' : 'text-[#1d1d1f]'}`}>{settingsMessage}</p>}

              {/* Seksi Keluar dari Akun ala Apple */}
              <div className="mt-7 border-t border-black/[0.06] pt-5 dark:border-white/[0.08]">
                <div className="flex flex-col gap-3 min-[420px]:flex-row min-[420px]:items-center min-[420px]:justify-between">
                  <div>
                    <p className={`text-[15px] font-semibold tracking-[-0.2px] ${isDarkMode ? 'text-[#f5f5f7]' : 'text-[#1d1d1f]'}`}>
                      {t('Keluar dari Akun')}
                    </p>
                    <p className={`mt-0.5 text-[13px] ${isDarkMode ? 'text-[#86868b]' : 'text-[#7a7a7a]'}`}>
                      {t('Akhiri sesi aktif akun ini pada perangkatmu.')}
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={() => {
                      setIsSettingsOpen(false)
                      handleLogout()
                    }}
                    className={`inline-flex min-h-10 shrink-0 items-center justify-center gap-1.5 rounded-full px-4 text-[13px] font-medium transition-all active:scale-95 ${
                      isDarkMode
                        ? 'border border-[#ff453a]/30 bg-[#ff453a]/10 text-[#ff453a] hover:bg-[#ff453a]/20'
                        : 'border border-[#ff3b30]/30 bg-[#ff3b30]/5 text-[#ff3b30] hover:bg-[#ff3b30]/10'
                    }`}
                  >
                    <HiOutlineLogout aria-hidden="true" className="h-4 w-4" />
                    <span>{t('Keluar')}</span>
                  </button>
                </div>
              </div>

              <div className="mt-6 flex flex-wrap justify-end gap-2 sm:mt-7 sm:gap-3">
                <button type="button" onClick={() => setIsSettingsOpen(false)} className={`min-h-11 rounded-full px-4 text-[14px] active:scale-95 ${isDarkMode ? 'text-[#2997ff] hover:bg-white/10' : 'text-[#0066cc] hover:bg-[#f5f5f7]'}`}>{t('Batal')}</button>
                <button type="submit" disabled={isSettingsSaving} className={`min-h-11 rounded-full px-5 text-[14px] text-white transition-all active:scale-95 disabled:opacity-60 ${isDarkMode ? 'bg-[#2997ff] hover:bg-[#0071e3]' : 'bg-[#0066cc] hover:bg-[#0071e3]'}`}>{isSettingsSaving ? t('Menyimpan...') : t('Simpan')}</button>
              </div>
            </form>
          </div>,
          document.body
        )}

        {isMounted && premiumOfferPresence.isPresent && createPortal(
          <div
            data-motion-state={premiumOfferPresence.isExiting ? 'closing' : 'open'}
            inert={premiumOfferPresence.isExiting}
            className="fixed inset-0 z-[120] flex items-center justify-center bg-black/40 p-3 backdrop-blur-sm animate-modal-backdrop sm:p-4"
            onMouseDown={(event) => {
              if (event.target === event.currentTarget) {
                setIsPremiumOfferOpen(false)
                setOfferMessage('')
              }
            }}
          >
            <section role="dialog" aria-modal="true" aria-labelledby="premium-offer-title" className={`max-h-[90dvh] w-full max-w-[560px] overflow-y-auto overscroll-contain rounded-[18px] border p-5 animate-modal-enter sm:max-h-[min(86vh,760px)] sm:p-8 shadow-2xl backdrop-blur-2xl ${
              isDarkMode
                ? 'border-white/10 bg-[#252527]/95 text-[#f5f5f7]'
                : 'border-[#e0e0e0] bg-white/95 text-[#1d1d1f]'
            }`}>
              <div className="flex items-start justify-between gap-4">
                <div>
                  <p className={`mb-2 text-[12px] font-semibold ${isDarkMode ? 'text-[#2997ff]' : 'text-[#0066cc]'}`}>{t('NOTES PREMIUM')}</p>
                  <h2 id="premium-offer-title" className={`text-[28px] font-semibold leading-[1.14] tracking-[-0.3px] ${isDarkMode ? 'text-[#f5f5f7]' : 'text-[#1d1d1f]'}`}>{t('Lebih banyak ruang untuk ide.')}</h2>
                  <p className={`mt-2 text-[17px] leading-[1.47] ${isDarkMode ? 'text-[#86868b]' : 'text-[#7a7a7a]'}`}>{t('Pilih paket untuk langsung mengaktifkan Premium. Pembayaran belum diproses di aplikasi ini.')}</p>
                </div>
                <button type="button" aria-label={t('Tutup penawaran Premium')} onClick={() => { setIsPremiumOfferOpen(false); setOfferMessage('') }} className={`flex h-11 w-11 shrink-0 items-center justify-center rounded-full text-[24px] active:scale-95 ${isDarkMode ? 'text-[#86868b] hover:bg-white/10' : 'text-[#7a7a7a] hover:bg-[#f5f5f7]'}`}><HiOutlineX aria-hidden="true" /></button>
              </div>

              <ul className={`mt-6 space-y-3 text-[17px] leading-[1.47] ${isDarkMode ? 'text-[#f5f5f7]' : 'text-[#1d1d1f]'}`}>
                <li className="flex gap-3"><span className={isDarkMode ? 'text-[#2997ff]' : 'text-[#0066cc]'}><HiOutlineCheck aria-hidden="true" /></span><span>{t('Folder untuk mengelompokkan catatan')}</span></li>
                <li className="flex gap-3"><span className={isDarkMode ? 'text-[#2997ff]' : 'text-[#0066cc]'}><HiOutlineCheck aria-hidden="true" /></span><span>{t('Berbagi dan mengedit catatan bersama kolaborator')}</span></li>
                <li className="flex gap-3"><span className={isDarkMode ? 'text-[#2997ff]' : 'text-[#0066cc]'}><HiOutlineCheck aria-hidden="true" /></span><span>{t('Pin catatan tanpa batas')}</span></li>
              </ul>

              <div className="mt-6 grid grid-cols-1 gap-3 min-[380px]:grid-cols-2 sm:mt-7">
                <button type="button" disabled={isActivatingPremium} onClick={() => activatePremiumPlan(1)} className={`min-h-[84px] rounded-[11px] border px-4 py-3 text-left transition-colors active:scale-[0.98] disabled:opacity-60 ${
                  isDarkMode
                    ? 'border-white/15 bg-white/5 hover:bg-white/10'
                    : 'border-[#e0e0e0] bg-white hover:bg-[#fafafc]'
                }`}>
                  <span className={`block text-[14px] ${isDarkMode ? 'text-[#86868b]' : 'text-[#7a7a7a]'}`}>{t('1 bulan')}</span>
                  <span className={`mt-1 block text-[21px] font-semibold tracking-[-0.2px] ${isDarkMode ? 'text-[#f5f5f7]' : 'text-[#1d1d1f]'}`}>{(10000).toLocaleString(locale, { style: 'currency', currency: 'IDR', maximumFractionDigits: 0 })}</span>
                </button>
                <button type="button" disabled={isActivatingPremium} onClick={() => activatePremiumPlan(12)} className={`min-h-[84px] rounded-[11px] border px-4 py-3 text-left transition-colors active:scale-[0.98] disabled:opacity-60 ${
                  isDarkMode
                    ? 'border-white/15 bg-white/5 hover:bg-white/10'
                    : 'border-[#e0e0e0] bg-white hover:bg-[#fafafc]'
                }`}>
                  <span className={`block text-[14px] ${isDarkMode ? 'text-[#86868b]' : 'text-[#7a7a7a]'}`}>{t('1 tahun')}</span>
                  <span className={`mt-1 block text-[21px] font-semibold tracking-[-0.2px] ${isDarkMode ? 'text-[#f5f5f7]' : 'text-[#1d1d1f]'}`}>{(90000).toLocaleString(locale, { style: 'currency', currency: 'IDR', maximumFractionDigits: 0 })}</span>
                </button>
              </div>

              {isActivatingPremium && <p role="status" className={`mt-4 text-[14px] ${isDarkMode ? 'text-[#86868b]' : 'text-[#7a7a7a]'}`}>{t('Mengaktifkan Premium...')}</p>}
              {offerMessage && <p role="status" aria-live="polite" className={`mt-4 rounded-[8px] p-3 text-[14px] leading-[1.47] ${isDarkMode ? 'bg-white/5 text-[#f5f5f7]' : 'bg-[#f5f5f7] text-[#1d1d1f]'}`}>{offerMessage}</p>}
              <div className="mt-6 flex justify-end">
                <button type="button" onClick={() => { setIsPremiumOfferOpen(false); setOfferMessage('') }} className={`min-h-11 rounded-full px-[22px] text-[14px] text-white transition-all active:scale-95 ${isDarkMode ? 'bg-[#2997ff] hover:bg-[#0071e3]' : 'bg-[#0066cc] hover:bg-[#0071e3]'}`}>{t('Tutup')}</button>
              </div>
            </section>
          </div>,
          document.body
        )}

        {isMounted && premiumDetailPresence.isPresent && createPortal(
          <div
            data-motion-state={premiumDetailPresence.isExiting ? 'closing' : 'open'}
            inert={premiumDetailPresence.isExiting}
            className="fixed inset-0 z-[120] flex items-center justify-center bg-black/40 p-3 backdrop-blur-sm animate-modal-backdrop sm:p-4"
            onMouseDown={(event) => {
              if (event.target === event.currentTarget) setPremiumDetailOpen(false)
            }}
          >
            <section role="dialog" aria-modal="true" aria-labelledby="premium-detail-title" className={`max-h-[90dvh] w-full max-w-[480px] overflow-y-auto rounded-[18px] border p-5 animate-modal-enter sm:p-8 shadow-2xl backdrop-blur-2xl ${
              isDarkMode
                ? 'border-white/10 bg-[#252527]/95 text-[#f5f5f7]'
                : 'border-[#e0e0e0] bg-white/95 text-[#1d1d1f]'
            }`}>
              <div className="flex items-start justify-between gap-4">
                <div>
                  <p className={`mb-2 text-[12px] font-semibold ${isDarkMode ? 'text-[#2997ff]' : 'text-[#0066cc]'}`}><HiStar aria-hidden="true" className="mr-1 inline-block align-middle" />{t('PREMIUM AKTIF')}</p>
                  <h2 id="premium-detail-title" className={`text-[28px] font-semibold leading-[1.14] tracking-[-0.3px] ${isDarkMode ? 'text-[#f5f5f7]' : 'text-[#1d1d1f]'}`}>{t('Paket Premium')}</h2>
                </div>
                <button type="button" aria-label={t('Tutup detail paket')} onClick={() => setPremiumDetailOpen(false)} className={`flex h-11 w-11 shrink-0 items-center justify-center rounded-full text-[24px] active:scale-95 ${isDarkMode ? 'text-[#86868b] hover:bg-white/10' : 'text-[#7a7a7a] hover:bg-[#f5f5f7]'}`}><HiOutlineX aria-hidden="true" /></button>
              </div>
              <p className={`mt-4 text-[17px] leading-[1.47] ${isDarkMode ? 'text-[#f5f5f7]' : 'text-[#1d1d1f]'}`}>
                {profile?.premium_expires_at
                  ? t('Masa Premium berakhir pada {date}.', { date: new Date(profile.premium_expires_at).toLocaleDateString(locale, { day: 'numeric', month: 'long', year: 'numeric' }) })
                  : t('Tanggal berakhir Premium belum tercatat.')}
              </p>
              <ul className={`mt-5 space-y-2 text-[14px] leading-[1.47] ${isDarkMode ? 'text-[#86868b]' : 'text-[#7a7a7a]'}`}>
                <li>{t('Folder catatan')}</li>
                <li>{t('Catatan bersama dan kolaborator')}</li>
                <li>{t('Pin catatan tanpa batas')}</li>
              </ul>
              <div className="mt-7 flex justify-end">
                <button type="button" onClick={() => setPremiumDetailOpen(false)} className={`min-h-11 rounded-full px-[22px] text-[14px] text-white transition-all active:scale-95 ${isDarkMode ? 'bg-[#2997ff] hover:bg-[#0071e3]' : 'bg-[#0066cc] hover:bg-[#0071e3]'}`}>{t('Tutup')}</button>
              </div>
            </section>
          </div>,
          document.body
        )}

        {isMounted && premiumSuccessPresence.isPresent && premiumSuccessPresence.value && createPortal(
          <div
            data-motion-state={premiumSuccessPresence.isExiting ? 'closing' : 'open'}
            inert={premiumSuccessPresence.isExiting}
            className="fixed inset-0 z-[130] flex items-center justify-center bg-black/40 p-3 backdrop-blur-sm animate-modal-backdrop sm:p-4"
            onMouseDown={(event) => {
              if (event.target === event.currentTarget) setPremiumSuccessExpiry(null)
            }}
          >
            <section role="dialog" aria-modal="true" aria-labelledby="premium-success-title" className={`max-h-[90dvh] w-full max-w-[480px] overflow-y-auto rounded-[18px] border p-5 animate-modal-enter sm:p-8 shadow-2xl backdrop-blur-2xl ${
              isDarkMode
                ? 'border-white/10 bg-[#252527]/95 text-[#f5f5f7]'
                : 'border-[#e0e0e0] bg-white/95 text-[#1d1d1f]'
            }`}>
              <div className={`mb-5 flex h-11 w-11 items-center justify-center rounded-full text-[21px] ${isDarkMode ? 'bg-white/10 text-[#2997ff]' : 'bg-[#f5f5f7] text-[#0066cc]'}`} aria-hidden="true"><HiStar aria-hidden="true" /></div>
              <p className={`mb-2 text-[12px] font-semibold ${isDarkMode ? 'text-[#2997ff]' : 'text-[#0066cc]'}`}>{t('PREMIUM AKTIF')}</p>
              <h2 id="premium-success-title" className={`text-[28px] font-semibold leading-[1.14] tracking-[-0.3px] ${isDarkMode ? 'text-[#f5f5f7]' : 'text-[#1d1d1f]'}`}>{t('Akunmu sekarang Premium.')}</h2>
              <p className={`mt-3 text-[17px] leading-[1.47] ${isDarkMode ? 'text-[#f5f5f7]' : 'text-[#1d1d1f]'}`}>
                {t('Premium aktif sampai {date}. Tidak ada pembayaran yang diproses.', { date: new Date(premiumSuccessPresence.value).toLocaleDateString(locale, { day: 'numeric', month: 'long', year: 'numeric' }) })}
              </p>
              <ul className={`mt-5 space-y-2 text-[14px] leading-[1.47] ${isDarkMode ? 'text-[#86868b]' : 'text-[#7a7a7a]'}`}>
                <li>{t('Folder untuk mengelompokkan catatan')}</li>
                <li>{t('Berbagi dan mengedit catatan bersama kolaborator')}</li>
                <li>{t('Pin catatan tanpa batas')}</li>
              </ul>
              <div className="mt-7 flex justify-end">
                <button type="button" onClick={() => setPremiumSuccessExpiry(null)} className={`min-h-11 rounded-full px-[22px] text-[14px] text-white transition-all active:scale-95 ${isDarkMode ? 'bg-[#2997ff] hover:bg-[#0071e3]' : 'bg-[#0066cc] hover:bg-[#0071e3]'}`}>{t('Mulai gunakan Premium')}</button>
              </div>
            </section>
          </div>,
          document.body
        )}
      </main>
    </div>
  )
}
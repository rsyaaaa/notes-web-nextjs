'use client'

import React, { useState, useEffect, useMemo, useCallback } from 'react'
import {
  FcGoogle,
} from 'react-icons/fc'
import {
  HiStar,
  HiOutlineUserGroup,
  HiOutlineDocumentText,
  HiOutlineTrash,
  HiOutlineFolder,
  HiOutlineSearch,
  HiOutlineX,
  HiOutlineRefresh,
  HiOutlineMail,
  HiOutlineShare,
  HiOutlineClock,
  HiOutlineChevronDown,
} from 'react-icons/hi'
import { BsPinFill } from 'react-icons/bs'
import KitsuneMaskIcon from './KitsuneMaskIcon'

export interface RoleGodUser {
  id: string
  email: string
  full_name: string
  avatar_url: string | null
  provider: string
  created_at: string
  last_sign_in_at: string | null
  plan: 'premium' | 'free'
  premium_expires_at: string | null
  notes_count: number
  trash_count: number
  folders_count: number
}

export interface RoleGodCollaborator {
  user_id: string
  email: string
  full_name: string
  avatar_url: string | null
  role: string
  invited_by_name: string
  created_at: string
}

export interface RoleGodNote {
  id: number
  user_id: string
  owner_name: string
  owner_email: string
  owner_avatar: string | null
  title: string
  content: string
  accent_color: string
  folder_id: number | null
  folder_name: string | null
  is_pinned: boolean
  is_trashed: boolean
  created_at: string
  updated_at: string
  collaborators: RoleGodCollaborator[]
  collaborator_count: number
}

export interface RoleGodFolder {
  id: number
  user_id: string
  name: string
  owner_name: string
  owner_email: string
  owner_avatar: string | null
  created_at: string
  notes_count: number
  trash_count: number
}

export interface RoleGodStats {
  totalUsers: number
  totalPremiumUsers: number
  totalFreeUsers: number
  totalNotes: number
  totalTrashedNotes: number
  totalSharedNotes: number
  totalFolders: number
}

interface RoleGodDashboardProps {
  isDarkMode: boolean
  onExit: () => void
  passwordVerified: string
  authToken: string
}

type TabKey = 'users' | 'notes' | 'trash' | 'folders'

export default function RoleGodDashboard({
  isDarkMode,
  onExit,
  passwordVerified,
  authToken,
}: RoleGodDashboardProps) {
  const [activeTab, setActiveTab] = useState<TabKey>('users')
  const [searchQuery, setSearchQuery] = useState('')
  const [selectedUserFilter, setSelectedUserFilter] = useState<string>('all')
  const [loading, setLoading] = useState(true)
  const [errorMsg, setErrorMsg] = useState<string | null>(null)

  const [users, setUsers] = useState<RoleGodUser[]>([])
  const [notes, setNotes] = useState<RoleGodNote[]>([])
  const [folders, setFolders] = useState<RoleGodFolder[]>([])
  const [stats, setStats] = useState<RoleGodStats | null>(null)

  // Modal Note Preview
  const [previewNote, setPreviewNote] = useState<RoleGodNote | null>(null)

  // Track avatar loading errors for graceful fallback to initials
  const [avatarErrors, setAvatarErrors] = useState<Record<string, boolean>>({})

  // Modal Kelola Paket Pengguna (Rolegod Admin)
  const [managingPlanUser, setManagingPlanUser] = useState<RoleGodUser | null>(null)
  const [selectedPlanOption, setSelectedPlanOption] = useState<'free' | 'premium'>('premium')
  const [selectedDuration, setSelectedDuration] = useState<number>(1)
  const [isUpdatingPlan, setIsUpdatingPlan] = useState(false)
  const [planSuccessMsg, setPlanSuccessMsg] = useState<string | null>(null)
  const [planErrorMsg, setPlanErrorMsg] = useState<string | null>(null)

  // Fetch Rolegod Data (manual refresh)
  const handleRefresh = useCallback(async () => {
    setLoading(true)
    setErrorMsg(null)
    try {
      const res = await fetch('/api/rolegod', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${authToken}`,
        },
        body: JSON.stringify({ password: passwordVerified }),
      })

      const json = await res.json()
      if (!res.ok) {
        throw new Error(json.error || 'Gagal memuat data Rolegod.')
      }

      setUsers(json.data.users)
      setNotes(json.data.notes)
      setFolders(json.data.folders)
      setStats(json.data.stats)
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Terjadi kesalahan sistem'
      setErrorMsg(msg)
    } finally {
      setLoading(false)
    }
  }, [authToken, passwordVerified])

  // Update Plan Pengguna (Rolegod Admin Action)
  const handleUpdatePlan = async () => {
    if (!managingPlanUser) return
    setIsUpdatingPlan(true)
    setPlanErrorMsg(null)
    setPlanSuccessMsg(null)

    try {
      const res = await fetch('/api/rolegod', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${authToken}`,
        },
        body: JSON.stringify({
          password: passwordVerified,
          action: 'update_plan',
          userId: managingPlanUser.id,
          plan: selectedPlanOption,
          durationMonths: selectedPlanOption === 'premium' ? selectedDuration : 0,
        }),
      })

      const json = await res.json()
      if (!res.ok) {
        throw new Error(json.error || 'Gagal mengubah status paket pengguna.')
      }

      setUsers((prev) =>
        prev.map((u) => {
          if (u.id === managingPlanUser.id) {
            return {
              ...u,
              plan: selectedPlanOption,
              premium_expires_at: json.data?.premium_expires_at || null,
            }
          }
          return u
        })
      )

      setStats((prev) => {
        if (!prev) return null
        const isNowPremium = selectedPlanOption === 'premium'
        const wasPremium = managingPlanUser.plan === 'premium'
        if (isNowPremium && !wasPremium) {
          return {
            ...prev,
            totalPremiumUsers: prev.totalPremiumUsers + 1,
            totalFreeUsers: Math.max(0, prev.totalFreeUsers - 1),
          }
        } else if (!isNowPremium && wasPremium) {
          return {
            ...prev,
            totalPremiumUsers: Math.max(0, prev.totalPremiumUsers - 1),
            totalFreeUsers: prev.totalFreeUsers + 1,
          }
        }
        return prev
      })

      setPlanSuccessMsg(json.message || 'Status paket berhasil diperbarui.')
      setTimeout(() => {
        setManagingPlanUser(null)
        setPlanSuccessMsg(null)
      }, 1000)
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Terjadi kesalahan sistem'
      setPlanErrorMsg(msg)
    } finally {
      setIsUpdatingPlan(false)
    }
  }

  // Initial Data Fetch on Mount
  useEffect(() => {
    let isCancelled = false

    const loadData = async () => {
      try {
        const res = await fetch('/api/rolegod', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${authToken}`,
          },
          body: JSON.stringify({ password: passwordVerified }),
        })

        const json = await res.json()
        if (isCancelled) return

        if (!res.ok) {
          setErrorMsg(json.error || 'Gagal memuat data Rolegod.')
        } else {
          setUsers(json.data.users)
          setNotes(json.data.notes)
          setFolders(json.data.folders)
          setStats(json.data.stats)
        }
      } catch (err: unknown) {
        if (!isCancelled) {
          const msg = err instanceof Error ? err.message : 'Terjadi kesalahan sistem'
          setErrorMsg(msg)
        }
      } finally {
        if (!isCancelled) {
          setLoading(false)
        }
      }
    }

    loadData()
    return () => {
      isCancelled = true
    }
  }, [authToken, passwordVerified])

  const formatDate = (dateStr?: string | null) => {
    if (!dateStr) return 'Belum pernah login'
    try {
      const d = new Date(dateStr)
      return d.toLocaleDateString('id-ID', {
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

  // Filtered Users
  const filteredUsers = useMemo(() => {
    return users.filter((u) => {
      const matchSearch =
        u.email.toLowerCase().includes(searchQuery.toLowerCase()) ||
        u.full_name.toLowerCase().includes(searchQuery.toLowerCase()) ||
        u.provider.toLowerCase().includes(searchQuery.toLowerCase())
      return matchSearch
    })
  }, [users, searchQuery])

  // Filtered Active Notes
  const filteredActiveNotes = useMemo(() => {
    return notes.filter((n) => {
      if (n.is_trashed) return false
      const matchUser = selectedUserFilter === 'all' || n.user_id === selectedUserFilter
      const matchSearch =
        n.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
        n.content.toLowerCase().includes(searchQuery.toLowerCase()) ||
        n.owner_email.toLowerCase().includes(searchQuery.toLowerCase()) ||
        n.owner_name.toLowerCase().includes(searchQuery.toLowerCase()) ||
        (n.folder_name && n.folder_name.toLowerCase().includes(searchQuery.toLowerCase()))
      return matchUser && matchSearch
    })
  }, [notes, selectedUserFilter, searchQuery])

  // Filtered Trash Notes
  const filteredTrashNotes = useMemo(() => {
    return notes.filter((n) => {
      if (!n.is_trashed) return false
      const matchUser = selectedUserFilter === 'all' || n.user_id === selectedUserFilter
      const matchSearch =
        n.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
        n.content.toLowerCase().includes(searchQuery.toLowerCase()) ||
        n.owner_email.toLowerCase().includes(searchQuery.toLowerCase()) ||
        n.owner_name.toLowerCase().includes(searchQuery.toLowerCase())
      return matchUser && matchSearch
    })
  }, [notes, selectedUserFilter, searchQuery])

  // Filtered Folders
  const filteredFolders = useMemo(() => {
    return folders.filter((f) => {
      const matchUser = selectedUserFilter === 'all' || f.user_id === selectedUserFilter
      const matchSearch =
        f.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
        f.owner_email.toLowerCase().includes(searchQuery.toLowerCase()) ||
        f.owner_name.toLowerCase().includes(searchQuery.toLowerCase())
      return matchUser && matchSearch
    })
  }, [folders, selectedUserFilter, searchQuery])

  return (
    <div
      className={`min-h-screen font-sans transition-colors ${
        isDarkMode ? 'bg-[#1d1d1f] text-[#f5f5f7]' : 'bg-[#f5f5f7] text-[#1d1d1f]'
      }`}
    >
      {/* 1. Global Navigation Bar ala Apple with Rolegod Accent */}
      <header
        className={`sticky top-0 z-40 border-b backdrop-blur-xl transition-colors ${
          isDarkMode
            ? 'border-[#3a3a3e]/80 bg-[#1d1d1f]/90'
            : 'border-[#e0e0e0]/80 bg-[#ffffff]/90'
        }`}
      >
        <div className="mx-auto flex h-[52px] max-w-[1440px] items-center justify-between gap-3 px-4 sm:px-6 lg:px-8">
          {/* Left: Brand + God Mode Pill Badge with Kitsune Mask */}
          <div className="flex items-center gap-2.5">
            <h1 className="font-semibold text-[17px] tracking-[-0.374px]">
              Notes
            </h1>

            <div
              className={`flex items-center gap-1.5 rounded-full px-2.5 py-0.5 text-[11px] font-semibold tracking-wide uppercase transition-all ${
                isDarkMode
                  ? 'border border-[#ff375f]/40 bg-[#ff375f]/15 text-[#ff375f]'
                  : 'border border-[#d70015]/30 bg-[#d70015]/10 text-[#d70015]'
              }`}
            >
              <KitsuneMaskIcon className="h-3.5 w-3.5 shrink-0" aria-hidden="true" />
              <span>God Mode</span>
            </div>

            <span
              className={`hidden sm:inline-block text-[12px] ${
                isDarkMode ? 'text-[#86868b]' : 'text-[#7a7a7a]'
              }`}
            >
              rasyacarnival@gmail.com
            </span>
          </div>

          {/* Right: Actions */}
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={handleRefresh}
              disabled={loading}
              title="Perbarui data"
              aria-label="Perbarui data database"
              className={`flex h-[36px] items-center gap-1.5 rounded-full border px-3 text-[13px] font-normal transition-transform active:scale-95 ${
                isDarkMode
                  ? 'border-[#3a3a3e] bg-[#252527] text-[#f5f5f7] hover:bg-[#303033]'
                  : 'border-[#e0e0e0] bg-white text-[#1d1d1f] hover:bg-[#fafafc]'
              }`}
            >
              <HiOutlineRefresh
                className={`text-[14px] ${loading ? 'animate-spin' : ''}`}
                aria-hidden="true"
              />
              <span className="hidden sm:inline">Refresh</span>
            </button>

            <button
              type="button"
              onClick={onExit}
              className={`flex min-h-[36px] items-center gap-1.5 rounded-full px-4 text-[13px] font-normal text-white transition-transform active:scale-95 ${
                isDarkMode
                  ? 'bg-[#0066cc] hover:bg-[#0071e3]'
                  : 'bg-[#0066cc] hover:bg-[#0055b3]'
              }`}
            >
              <span>Kembali ke Catatan</span>
            </button>
          </div>
        </div>
      </header>

      {/* Main Container */}
      <main className="mx-auto max-w-[1440px] px-4 py-6 sm:px-6 sm:py-8 lg:px-8">

        {/* 2. Stats Grid ala Apple Cards */}
        {stats && (
          <div className="mb-6 grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-6">
            <div
              className={`rounded-[18px] border p-4 transition-all ${
                isDarkMode ? 'border-[#3a3a3e] bg-[#252527]' : 'border-[#e0e0e0] bg-white'
              }`}
            >
              <div className="flex items-center justify-between text-[12px] text-[#7a7a7a] dark:text-[#86868b]">
                <span>Total Pengguna</span>
                <HiOutlineUserGroup aria-hidden="true" className="text-base" />
              </div>
              <p className="mt-2 text-[28px] font-semibold tracking-[-0.3px]">
                {stats.totalUsers}
              </p>
              <span className="text-[11px] text-[#7a7a7a] dark:text-[#86868b]">
                {stats.totalPremiumUsers} Premium · {stats.totalFreeUsers} Free
              </span>
            </div>

            <div
              className={`rounded-[18px] border p-4 transition-all ${
                isDarkMode ? 'border-[#3a3a3e] bg-[#252527]' : 'border-[#e0e0e0] bg-white'
              }`}
            >
              <div className="flex items-center justify-between text-[12px] text-[#7a7a7a] dark:text-[#86868b]">
                <span>Catatan Aktif</span>
                <HiOutlineDocumentText aria-hidden="true" className="text-base" />
              </div>
              <p className="mt-2 text-[28px] font-semibold tracking-[-0.3px]">
                {stats.totalNotes}
              </p>
              <span className="text-[11px] text-[#7a7a7a] dark:text-[#86868b]">
                Di seluruh akun
              </span>
            </div>

            <div
              className={`rounded-[18px] border p-4 transition-all ${
                isDarkMode ? 'border-[#3a3a3e] bg-[#252527]' : 'border-[#e0e0e0] bg-white'
              }`}
            >
              <div className="flex items-center justify-between text-[12px] text-[#7a7a7a] dark:text-[#86868b]">
                <span>Dibagikan</span>
                <HiOutlineShare aria-hidden="true" className="text-base" />
              </div>
              <p className="mt-2 text-[28px] font-semibold tracking-[-0.3px]">
                {stats.totalSharedNotes}
              </p>
              <span className="text-[11px] text-[#7a7a7a] dark:text-[#86868b]">
                Catatan kolaborasi
              </span>
            </div>

            <div
              className={`rounded-[18px] border p-4 transition-all ${
                isDarkMode ? 'border-[#3a3a3e] bg-[#252527]' : 'border-[#e0e0e0] bg-white'
              }`}
            >
              <div className="flex items-center justify-between text-[12px] text-[#7a7a7a] dark:text-[#86868b]">
                <span>Di Sampah</span>
                <HiOutlineTrash aria-hidden="true" className="text-base text-[#ff453a]" />
              </div>
              <p className="mt-2 text-[28px] font-semibold tracking-[-0.3px] text-[#ff453a] dark:text-[#ff453a]">
                {stats.totalTrashedNotes}
              </p>
              <span className="text-[11px] text-[#7a7a7a] dark:text-[#86868b]">
                Catatan terhapus
              </span>
            </div>

            <div
              className={`rounded-[18px] border p-4 transition-all ${
                isDarkMode ? 'border-[#3a3a3e] bg-[#252527]' : 'border-[#e0e0e0] bg-white'
              }`}
            >
              <div className="flex items-center justify-between text-[12px] text-[#7a7a7a] dark:text-[#86868b]">
                <span>Total Folder</span>
                <HiOutlineFolder aria-hidden="true" className="text-base" />
              </div>
              <p className="mt-2 text-[28px] font-semibold tracking-[-0.3px]">
                {stats.totalFolders}
              </p>
              <span className="text-[11px] text-[#7a7a7a] dark:text-[#86868b]">
                Folder dibuat user
              </span>
            </div>

            <div
              className={`rounded-[18px] border p-4 transition-all ${
                isDarkMode ? 'border-[#3a3a3e] bg-[#252527]' : 'border-[#e0e0e0] bg-white'
              }`}
            >
              <div className="flex items-center justify-between text-[12px] text-[#7a7a7a] dark:text-[#86868b]">
                <span>Akun Premium</span>
                <HiStar aria-hidden="true" className="text-base text-[#0066cc] dark:text-[#2997ff]" />
              </div>
              <p className="mt-2 text-[28px] font-semibold tracking-[-0.3px] text-[#0066cc] dark:text-[#2997ff]">
                {stats.totalPremiumUsers}
              </p>
              <span className="text-[11px] text-[#7a7a7a] dark:text-[#86868b]">
                Berlangganan aktif
              </span>
            </div>
          </div>
        )}

        {/* 3. Navigation Tabs + Search Bar Container */}
        <div className="mb-6 flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
          {/* Segmented Control ala Apple Pill */}
          <div
            className={`flex w-full overflow-x-auto rounded-full border p-1 sm:w-auto ${
              isDarkMode
                ? 'border-[#3a3a3e] bg-[#252527]/80'
                : 'border-[#e0e0e0] bg-white/80'
            }`}
          >
            <button
              type="button"
              onClick={() => setActiveTab('users')}
              className={`flex shrink-0 items-center gap-1.5 rounded-full px-4 py-1.5 text-[14px] font-medium transition-all active:scale-95 ${
                activeTab === 'users'
                  ? isDarkMode
                    ? 'bg-[#3a3a3e] text-white shadow-sm'
                    : 'bg-[#0066cc] text-white shadow-sm'
                  : isDarkMode
                  ? 'text-[#b3b3b8] hover:text-white'
                  : 'text-[#7a7a7a] hover:text-[#1d1d1f]'
              }`}
            >
              <HiOutlineUserGroup aria-hidden="true" />
              <span>Pengguna ({users.length})</span>
            </button>

            <button
              type="button"
              onClick={() => setActiveTab('notes')}
              className={`flex shrink-0 items-center gap-1.5 rounded-full px-4 py-1.5 text-[14px] font-medium transition-all active:scale-95 ${
                activeTab === 'notes'
                  ? isDarkMode
                    ? 'bg-[#3a3a3e] text-white shadow-sm'
                    : 'bg-[#0066cc] text-white shadow-sm'
                  : isDarkMode
                  ? 'text-[#b3b3b8] hover:text-white'
                  : 'text-[#7a7a7a] hover:text-[#1d1d1f]'
              }`}
            >
              <HiOutlineDocumentText aria-hidden="true" />
              <span>Catatan Aktif ({notes.filter((n) => !n.is_trashed).length})</span>
            </button>

            <button
              type="button"
              onClick={() => setActiveTab('trash')}
              className={`flex shrink-0 items-center gap-1.5 rounded-full px-4 py-1.5 text-[14px] font-medium transition-all active:scale-95 ${
                activeTab === 'trash'
                  ? isDarkMode
                    ? 'bg-[#3a3a3e] text-white shadow-sm'
                    : 'bg-[#0066cc] text-white shadow-sm'
                  : isDarkMode
                  ? 'text-[#b3b3b8] hover:text-white'
                  : 'text-[#7a7a7a] hover:text-[#1d1d1f]'
              }`}
            >
              <HiOutlineTrash aria-hidden="true" />
              <span>Sampah ({notes.filter((n) => n.is_trashed).length})</span>
            </button>

            <button
              type="button"
              onClick={() => setActiveTab('folders')}
              className={`flex shrink-0 items-center gap-1.5 rounded-full px-4 py-1.5 text-[14px] font-medium transition-all active:scale-95 ${
                activeTab === 'folders'
                  ? isDarkMode
                    ? 'bg-[#3a3a3e] text-white shadow-sm'
                    : 'bg-[#0066cc] text-white shadow-sm'
                  : isDarkMode
                  ? 'text-[#b3b3b8] hover:text-white'
                  : 'text-[#7a7a7a] hover:text-[#1d1d1f]'
              }`}
            >
              <HiOutlineFolder aria-hidden="true" />
              <span>Folder ({folders.length})</span>
            </button>
          </div>

          {/* Search Bar + User Dropdown Filter */}
          <div className="flex flex-wrap items-center gap-2">
            {/* User Dropdown Filter (when in notes, trash, or folders tab) */}
            {activeTab !== 'users' && (
              <div className="relative">
                <select
                  aria-label="Filter berdasarkan pengguna"
                  value={selectedUserFilter}
                  onChange={(e) => setSelectedUserFilter(e.target.value)}
                  className={`h-[40px] appearance-none rounded-full border px-4 pr-8 text-[13px] outline-none transition-colors ${
                    isDarkMode
                      ? 'border-[#3a3a3e] bg-[#252527] text-[#f5f5f7]'
                      : 'border-[#e0e0e0] bg-white text-[#1d1d1f]'
                  }`}
                >
                  <option value="all">Semua Pengguna</option>
                  {users.map((u) => (
                    <option key={u.id} value={u.id}>
                      {u.full_name} ({u.email})
                    </option>
                  ))}
                </select>
                <HiOutlineChevronDown
                  className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-[12px] opacity-70"
                  aria-hidden="true"
                />
              </div>
            )}

            {/* Apple Full Pill Search Input */}
            <div className="relative flex-1 sm:w-64">
              <HiOutlineSearch
                className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 text-[14px] text-[#7a7a7a] dark:text-[#86868b]"
                aria-hidden="true"
              />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder={
                  activeTab === 'users'
                    ? 'Cari email, nama, provider...'
                    : 'Cari judul, isi, pemilik...'
                }
                className={`h-[40px] w-full rounded-full border pl-9 pr-8 text-[13px] outline-none transition-colors focus:border-[#0071e3] ${
                  isDarkMode
                    ? 'border-[#3a3a3e] bg-[#252527] text-[#f5f5f7] placeholder-[#86868b]'
                    : 'border-[#e0e0e0] bg-white text-[#1d1d1f] placeholder-[#7a7a7a]'
                }`}
              />
              {searchQuery && (
                <button
                  type="button"
                  onClick={() => setSearchQuery('')}
                  aria-label="Hapus pencarian"
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-[12px] opacity-60 hover:opacity-100"
                >
                  <HiOutlineX aria-hidden="true" />
                </button>
              )}
            </div>
          </div>
        </div>

        {/* Loading / Error States */}
        {loading && (
          <div className="flex flex-col items-center justify-center py-16">
            <div className="h-8 w-8 animate-spin rounded-full border-2 border-[#0066cc] border-t-transparent" />
            <p className="mt-4 text-[14px] text-[#7a7a7a] dark:text-[#86868b]">
              Memuat data database dengan hak akses Rolegod...
            </p>
          </div>
        )}

        {errorMsg && !loading && (
          <div
            className={`rounded-[18px] border border-[#ff453a]/30 bg-[#ff453a]/10 p-6 text-center text-[14px] text-[#ff453a]`}
          >
            <p className="font-semibold">Terjadi Kesalahan</p>
            <p className="mt-1">{errorMsg}</p>
            <button
              type="button"
              onClick={handleRefresh}
              className="mt-4 rounded-full bg-[#ff453a] px-4 py-1.5 text-white active:scale-95"
            >
              Coba Lagi
            </button>
          </div>
        )}

        {/* 4. Tab Content */}
        {!loading && !errorMsg && (
          <>
            {/* TAB 1: PENGGUNA */}
            {activeTab === 'users' && (
              <div className="space-y-3">
                {filteredUsers.length === 0 ? (
                  <div
                    className={`rounded-[18px] border p-8 text-center text-[14px] ${
                      isDarkMode ? 'border-[#3a3a3e] bg-[#252527] text-[#86868b]' : 'border-[#e0e0e0] bg-white text-[#7a7a7a]'
                    }`}
                  >
                    Tidak ada pengguna yang cocok dengan pencarian.
                  </div>
                ) : (
                  <div className="grid grid-cols-1 gap-3 md:grid-cols-2 xl:grid-cols-3">
                    {filteredUsers.map((u) => {
                      const isGoogle = u.provider.toLowerCase().includes('google')
                      return (
                        <div
                          key={u.id}
                          className={`flex flex-col justify-between rounded-[18px] border p-5 transition-all ${
                            isDarkMode
                              ? 'border-[#3a3a3e] bg-[#252527] hover:border-white/20'
                              : 'border-[#e0e0e0] bg-white hover:border-black/20'
                          }`}
                        >
                          <div>
                            {/* Header: Avatar, Name, Email, Plan */}
                            <div className="flex items-start gap-3">
                              {u.avatar_url && !avatarErrors[`user-${u.id}`] ? (
                                // eslint-disable-next-line @next/next/no-img-element
                                <img
                                  src={u.avatar_url}
                                  alt={u.full_name}
                                  width={44}
                                  height={44}
                                  onError={() => setAvatarErrors((prev) => ({ ...prev, [`user-${u.id}`]: true }))}
                                  className="h-11 w-11 shrink-0 rounded-full object-cover ring-1 ring-black/10 dark:ring-white/10"
                                />
                              ) : (
                                <div
                                  className={`flex h-11 w-11 shrink-0 items-center justify-center rounded-full text-[16px] font-semibold ${
                                    isDarkMode
                                      ? 'bg-white/10 text-[#f5f5f7]'
                                      : 'bg-black/5 text-[#1d1d1f]'
                                  }`}
                                >
                                  {u.full_name.slice(0, 1).toUpperCase()}
                                </div>
                              )}

                              <div className="min-w-0 flex-1">
                                <div className="flex items-center gap-2">
                                  <h2 className="truncate text-[16px] font-semibold tracking-[-0.2px]">
                                    {u.full_name}
                                  </h2>
                                  {u.plan === 'premium' && (
                                    <span className="inline-flex shrink-0 items-center gap-1 rounded-full bg-[#0066cc]/10 px-2 py-0.5 text-[10px] font-semibold text-[#0066cc] dark:bg-[#2997ff]/15 dark:text-[#2997ff]">
                                      <HiStar aria-hidden="true" />
                                      <span>Premium</span>
                                    </span>
                                  )}
                                </div>

                                <p className="truncate text-[13px] text-[#7a7a7a] dark:text-[#86868b]">
                                  {u.email}
                                </p>
                              </div>
                            </div>

                            {/* Info Detail Grid */}
                            <div
                              className={`mt-4 space-y-2 rounded-[14px] p-3 text-[12px] ${
                                isDarkMode ? 'bg-[#1d1d1f]/60' : 'bg-[#f5f5f7]'
                              }`}
                            >
                              <div className="flex items-center justify-between">
                                <span className="text-[#7a7a7a] dark:text-[#86868b]">
                                  Metode Login
                                </span>
                                <span className="flex items-center gap-1 font-medium">
                                  {isGoogle ? (
                                    <>
                                      <FcGoogle aria-hidden="true" className="text-sm" />
                                      <span>Google OAuth</span>
                                    </>
                                  ) : (
                                    <>
                                      <HiOutlineMail aria-hidden="true" className="text-sm" />
                                      <span>Email &amp; Kata Sandi</span>
                                    </>
                                  )}
                                </span>
                              </div>

                              <div className="flex items-center justify-between">
                                <span className="text-[#7a7a7a] dark:text-[#86868b]">
                                  Pertama Login (Dibuat)
                                </span>
                                <span className="font-medium">{formatDate(u.created_at)}</span>
                              </div>

                              <div className="flex items-center justify-between">
                                <span className="text-[#7a7a7a] dark:text-[#86868b]">
                                  Terakhir Login
                                </span>
                                <span className="flex items-center gap-1 font-medium">
                                  <HiOutlineClock aria-hidden="true" />
                                  <span>{formatDate(u.last_sign_in_at)}</span>
                                </span>
                              </div>

                              <div className="flex items-center justify-between">
                                <span className="text-[#7a7a7a] dark:text-[#86868b]">
                                  Status Paket
                                </span>
                                <span className="font-medium">
                                  {u.plan === 'premium' ? (
                                    <span className="text-[#0066cc] dark:text-[#2997ff]">
                                      Aktif {u.premium_expires_at ? `(s/d ${formatDate(u.premium_expires_at)})` : '(Selamanya)'}
                                    </span>
                                  ) : (
                                    <span>Free Plan</span>
                                  )}
                                </span>
                              </div>
                            </div>
                          </div>

                          {/* Footer: Quick Note Counts + Action */}
                          <div className="mt-4 flex items-center justify-between border-t border-black/5 pt-3 dark:border-white/5">
                            <div className="flex items-center gap-2 text-[12px] text-[#7a7a7a] dark:text-[#86868b]">
                              <span>📝 {u.notes_count}</span>
                              <span>·</span>
                              <span>🗑️ {u.trash_count}</span>
                              <span>·</span>
                              <span>📁 {u.folders_count}</span>
                            </div>

                            <div className="flex items-center gap-2">
                              <button
                                type="button"
                                onClick={() => {
                                  setManagingPlanUser(u)
                                  setSelectedPlanOption(u.plan === 'premium' ? 'free' : 'premium')
                                  setSelectedDuration(1)
                                  setPlanErrorMsg(null)
                                  setPlanSuccessMsg(null)
                                }}
                                className={`inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-[11px] font-semibold transition-all active:scale-95 ${
                                  u.plan === 'premium'
                                    ? isDarkMode
                                      ? 'bg-[#ff9500]/15 text-[#ff9500] hover:bg-[#ff9500]/25'
                                      : 'bg-[#ff9500]/10 text-[#d97706] hover:bg-[#ff9500]/20'
                                    : isDarkMode
                                    ? 'bg-[#2997ff]/15 text-[#2997ff] hover:bg-[#2997ff]/25'
                                    : 'bg-[#0066cc]/10 text-[#0066cc] hover:bg-[#0066cc]/20'
                                }`}
                              >
                                <HiStar aria-hidden="true" />
                                <span>{u.plan === 'premium' ? 'Ubah ke Free' : 'Jadikan Premium'}</span>
                              </button>

                              <button
                                type="button"
                                onClick={() => {
                                  setSelectedUserFilter(u.id)
                                  setActiveTab('notes')
                                }}
                                className={`flex items-center gap-1 text-[12px] font-semibold transition-colors active:scale-95 ${
                                  isDarkMode ? 'text-[#2997ff]' : 'text-[#0066cc]'
                                }`}
                              >
                                <span>Lihat Catatan</span>
                                <span>→</span>
                              </button>
                            </div>
                          </div>
                        </div>
                      )
                    })}
                  </div>
                )}
              </div>
            )}

            {/* TAB 2: CATATAN AKTIF (READ-ONLY) */}
            {activeTab === 'notes' && (
              <div className="space-y-4">
                {selectedUserFilter !== 'all' && (
                  <div className="flex items-center justify-between rounded-full bg-[#0066cc]/10 px-4 py-2 text-[13px] text-[#0066cc] dark:bg-[#2997ff]/15 dark:text-[#2997ff]">
                    <span>
                      Menampilkan catatan aktif milik:{' '}
                      <strong>{users.find((u) => u.id === selectedUserFilter)?.full_name || selectedUserFilter}</strong>
                    </span>
                    <button
                      type="button"
                      onClick={() => setSelectedUserFilter('all')}
                      className="font-semibold underline active:scale-95"
                    >
                      Tampilkan Semua
                    </button>
                  </div>
                )}

                {filteredActiveNotes.length === 0 ? (
                  <div
                    className={`rounded-[18px] border p-8 text-center text-[14px] ${
                      isDarkMode ? 'border-[#3a3a3e] bg-[#252527] text-[#86868b]' : 'border-[#e0e0e0] bg-white text-[#7a7a7a]'
                    }`}
                  >
                    Tidak ada catatan aktif yang ditemukan.
                  </div>
                ) : (
                  <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-3">
                    {filteredActiveNotes.map((n) => (
                      <div
                        key={n.id}
                        onClick={() => setPreviewNote(n)}
                        className={`group relative flex cursor-pointer flex-col justify-between rounded-[18px] border p-5 transition-all active:scale-[0.99] ${
                          isDarkMode
                            ? 'border-[#3a3a3e] bg-[#252527] hover:border-white/30'
                            : 'border-[#e0e0e0] bg-white hover:border-black/30'
                        }`}
                      >
                        <div>
                          {/* Note Header: Owner info + Pinned badge */}
                          <div className="flex items-center justify-between gap-2">
                            <div className="flex min-w-0 items-center gap-2">
                              {n.owner_avatar && !avatarErrors[`note-${n.id}`] ? (
                                // eslint-disable-next-line @next/next/no-img-element
                                <img
                                  src={n.owner_avatar}
                                  alt={n.owner_name}
                                  width={24}
                                  height={24}
                                  onError={() => setAvatarErrors((prev) => ({ ...prev, [`note-${n.id}`]: true }))}
                                  className="h-6 w-6 rounded-full object-cover"
                                />
                              ) : (
                                <div
                                  className={`flex h-6 w-6 items-center justify-center rounded-full text-[10px] font-semibold ${
                                    isDarkMode ? 'bg-white/10 text-white' : 'bg-black/10 text-[#1d1d1f]'
                                  }`}
                                >
                                  {n.owner_name.slice(0, 1).toUpperCase()}
                                </div>
                              )}
                              <span className="truncate text-[12px] font-medium text-[#7a7a7a] dark:text-[#86868b]">
                                {n.owner_name} ({n.owner_email})
                              </span>
                            </div>

                            {n.is_pinned && (
                              <span className="flex shrink-0 items-center gap-1 text-[11px] font-medium text-[#0066cc] dark:text-[#2997ff]">
                                <BsPinFill aria-hidden="true" />
                                <span>Dipin</span>
                              </span>
                            )}
                          </div>

                          {/* Title */}
                          <h2 className="mt-3 line-clamp-1 text-[18px] font-semibold tracking-[-0.2px]">
                            {n.title}
                          </h2>

                          {/* Content Snippet */}
                          <p className="mt-2 line-clamp-3 text-[14px] leading-relaxed text-[#7a7a7a] dark:text-[#b3b3b8]">
                            {n.content || '(Catatan ini kosong)'}
                          </p>
                        </div>

                        {/* Metadata Footer: Collaborators + Folder */}
                        <div className="mt-5 border-t border-black/5 pt-3 dark:border-white/5">
                          {/* Collaborator Section */}
                          <div className="mb-2 flex items-center justify-between text-[12px]">
                            <span className="text-[#7a7a7a] dark:text-[#86868b]">
                              Kolaborasi:
                            </span>
                            {n.collaborators.length > 0 ? (
                              <span className="flex items-center gap-1 font-semibold text-[#0066cc] dark:text-[#2997ff]">
                                <HiOutlineShare aria-hidden="true" />
                                <span>Dibagikan ke {n.collaborators.length} user</span>
                              </span>
                            ) : (
                              <span className="text-[#7a7a7a] dark:text-[#86868b]">
                                Pribadi
                              </span>
                            )}
                          </div>

                          {n.collaborators.length > 0 && (
                            <div className="mb-3 flex flex-wrap gap-1">
                              {n.collaborators.map((c) => (
                                <span
                                  key={c.user_id}
                                  title={`${c.full_name} (${c.email})`}
                                  className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] ${
                                    isDarkMode
                                      ? 'bg-white/10 text-[#f5f5f7]'
                                      : 'bg-black/5 text-[#1d1d1f]'
                                  }`}
                                >
                                  <span>👥 {c.full_name}</span>
                                </span>
                              ))}
                            </div>
                          )}

                          <div className="flex items-center justify-between text-[11px] text-[#7a7a7a] dark:text-[#86868b]">
                            <span>
                              {n.folder_name ? `📁 ${n.folder_name}` : 'Tanpa Folder'}
                            </span>
                            <span>Diedit {formatDate(n.updated_at)}</span>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}

            {/* TAB 3: SAMPAH (TRASH NOTES) */}
            {activeTab === 'trash' && (
              <div className="space-y-4">
                {selectedUserFilter !== 'all' && (
                  <div className="flex items-center justify-between rounded-full bg-[#ff453a]/10 px-4 py-2 text-[13px] text-[#ff453a]">
                    <span>
                      Menampilkan tempat sampah milik:{' '}
                      <strong>{users.find((u) => u.id === selectedUserFilter)?.full_name || selectedUserFilter}</strong>
                    </span>
                    <button
                      type="button"
                      onClick={() => setSelectedUserFilter('all')}
                      className="font-semibold underline active:scale-95"
                    >
                      Tampilkan Semua
                    </button>
                  </div>
                )}

                {filteredTrashNotes.length === 0 ? (
                  <div
                    className={`rounded-[18px] border p-8 text-center text-[14px] ${
                      isDarkMode ? 'border-[#3a3a3e] bg-[#252527] text-[#86868b]' : 'border-[#e0e0e0] bg-white text-[#7a7a7a]'
                    }`}
                  >
                    Tempat sampah kosong. Tidak ada catatan yang dihapus.
                  </div>
                ) : (
                  <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-3">
                    {filteredTrashNotes.map((n) => (
                      <div
                        key={n.id}
                        onClick={() => setPreviewNote(n)}
                        className={`group relative flex cursor-pointer flex-col justify-between rounded-[18px] border border-[#ff453a]/20 p-5 transition-all ${
                          isDarkMode ? 'bg-[#252527]' : 'bg-white'
                        }`}
                      >
                        <div>
                          <div className="flex items-center justify-between gap-2">
                            <span className="truncate text-[12px] text-[#7a7a7a] dark:text-[#86868b]">
                              {n.owner_name} ({n.owner_email})
                            </span>
                            <span className="inline-flex items-center gap-1 rounded-full bg-[#ff453a]/10 px-2 py-0.5 text-[10px] font-semibold text-[#ff453a]">
                              <HiOutlineTrash aria-hidden="true" />
                              <span>Di Sampah</span>
                            </span>
                          </div>

                          <h2 className="mt-3 line-clamp-1 text-[17px] font-semibold text-[#ff453a]">
                            {n.title}
                          </h2>

                          <p className="mt-2 line-clamp-3 text-[14px] leading-relaxed text-[#7a7a7a] dark:text-[#b3b3b8]">
                            {n.content || '(Catatan ini kosong)'}
                          </p>
                        </div>

                        <div className="mt-5 border-t border-black/5 pt-3 text-[11px] text-[#7a7a7a] dark:border-white/5 dark:text-[#86868b]">
                          <span>Dihapus / Terakhir diubah: {formatDate(n.updated_at)}</span>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}

            {/* TAB 4: FOLDER */}
            {activeTab === 'folders' && (
              <div className="space-y-4">
                {selectedUserFilter !== 'all' && (
                  <div className="flex items-center justify-between rounded-full bg-[#0066cc]/10 px-4 py-2 text-[13px] text-[#0066cc] dark:bg-[#2997ff]/15 dark:text-[#2997ff]">
                    <span>
                      Menampilkan folder milik:{' '}
                      <strong>{users.find((u) => u.id === selectedUserFilter)?.full_name || selectedUserFilter}</strong>
                    </span>
                    <button
                      type="button"
                      onClick={() => setSelectedUserFilter('all')}
                      className="font-semibold underline active:scale-95"
                    >
                      Tampilkan Semua
                    </button>
                  </div>
                )}

                {filteredFolders.length === 0 ? (
                  <div
                    className={`rounded-[18px] border p-8 text-center text-[14px] ${
                      isDarkMode ? 'border-[#3a3a3e] bg-[#252527] text-[#86868b]' : 'border-[#e0e0e0] bg-white text-[#7a7a7a]'
                    }`}
                  >
                    Tidak ada folder yang dibuat oleh pengguna.
                  </div>
                ) : (
                  <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
                    {filteredFolders.map((f) => (
                      <div
                        key={f.id}
                        className={`rounded-[18px] border p-5 transition-all ${
                          isDarkMode ? 'border-[#3a3a3e] bg-[#252527]' : 'border-[#e0e0e0] bg-white'
                        }`}
                      >
                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-2">
                            <span className="text-[20px]">📁</span>
                            <h2 className="text-[17px] font-semibold">{f.name}</h2>
                          </div>
                          <span
                            className={`rounded-full px-2.5 py-0.5 text-[11px] font-medium ${
                              isDarkMode ? 'bg-white/10 text-white' : 'bg-black/5 text-[#1d1d1f]'
                            }`}
                          >
                            {f.notes_count} catatan
                          </span>
                        </div>

                        <div className="mt-4 border-t border-black/5 pt-3 text-[12px] text-[#7a7a7a] dark:border-white/5 dark:text-[#86868b]">
                          <p>
                            Pemilik: <span className="font-medium text-[#1d1d1f] dark:text-[#f5f5f7]">{f.owner_name}</span> ({f.owner_email})
                          </p>
                          <p className="mt-1">Dibuat: {formatDate(f.created_at)}</p>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}
          </>
        )}
      </main>

      {/* 5. Modal Detail Catatan (Read-Only Preview) */}
      {previewNote && (
        <div
          role="dialog"
          aria-modal="true"
          className="fixed inset-0 z-50 flex items-center justify-center p-4 backdrop-blur-md bg-black/40"
        >
          <div
            className={`w-full max-w-[680px] max-h-[85vh] overflow-y-auto rounded-[24px] border p-6 shadow-2xl transition-all ${
              isDarkMode
                ? 'border-[#3a3a3e] bg-[#252527] text-[#f5f5f7]'
                : 'border-[#e0e0e0] bg-white text-[#1d1d1f]'
            }`}
          >
            {/* Modal Header */}
            <div className="flex items-start justify-between gap-4 border-b border-black/5 pb-4 dark:border-white/10">
              <div>
                <div className="flex items-center gap-2 text-[12px] text-[#7a7a7a] dark:text-[#86868b]">
                  <span>Pemilik: {previewNote.owner_name} ({previewNote.owner_email})</span>
                  {previewNote.is_trashed && (
                    <span className="rounded-full bg-[#ff453a]/10 px-2 py-0.5 font-semibold text-[#ff453a]">
                      Di Sampah
                    </span>
                  )}
                </div>
                <h2 className="mt-2 text-[22px] font-semibold tracking-[-0.2px]">
                  {previewNote.title}
                </h2>
              </div>
              <button
                type="button"
                onClick={() => setPreviewNote(null)}
                className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-full text-[16px] transition-transform active:scale-95 ${
                  isDarkMode ? 'hover:bg-white/10' : 'hover:bg-black/5'
                }`}
              >
                <HiOutlineX aria-hidden="true" />
              </button>
            </div>

            {/* Note Content */}
            <div className="py-5">
              <p className="whitespace-pre-wrap text-[15px] leading-relaxed text-[#1d1d1f] dark:text-[#e5e5ea]">
                {previewNote.content || '(Tidak ada isi catatan)'}
              </p>
            </div>

            {/* Collaborators List */}
            {previewNote.collaborators.length > 0 && (
              <div
                className={`mt-4 rounded-[16px] p-4 text-[13px] ${
                  isDarkMode ? 'bg-[#1d1d1f]' : 'bg-[#f5f5f7]'
                }`}
              >
                <h3 className="font-semibold flex items-center gap-1.5 text-[14px]">
                  <HiOutlineShare aria-hidden="true" />
                  <span>Daftar Kolaborator ({previewNote.collaborators.length})</span>
                </h3>
                <div className="mt-2 divide-y divide-black/5 dark:divide-white/5">
                  {previewNote.collaborators.map((c) => (
                    <div key={c.user_id} className="flex items-center justify-between py-2 text-[12px]">
                      <div>
                        <p className="font-medium text-[#1d1d1f] dark:text-[#f5f5f7]">{c.full_name}</p>
                        <p className="text-[#7a7a7a] dark:text-[#86868b]">{c.email}</p>
                      </div>
                      <span className="text-[#7a7a7a] dark:text-[#86868b]">
                        Diundang: {formatDate(c.created_at)}
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Modal Footer */}
            <div className="mt-6 flex items-center justify-between border-t border-black/5 pt-4 text-[12px] text-[#7a7a7a] dark:border-white/10 dark:text-[#86868b]">
              <span>
                {previewNote.folder_name ? `Folder: ${previewNote.folder_name}` : 'Tanpa Folder'} · Dibuat {formatDate(previewNote.created_at)}
              </span>
              <button
                type="button"
                onClick={() => setPreviewNote(null)}
                className={`rounded-full px-4 py-1.5 font-medium transition-transform active:scale-95 ${
                  isDarkMode ? 'bg-white/10 text-white' : 'bg-black/5 text-[#1d1d1f]'
                }`}
              >
                Tutup
              </button>
            </div>
          </div>
        </div>
      )}

      {/* MODAL KELOLA PAKET PENGGUNA (ROLEGOD ADMIN) */}
      {managingPlanUser && (
        <div
          role="dialog"
          aria-modal="true"
          className="fixed inset-0 z-50 flex items-center justify-center p-4 backdrop-blur-md bg-black/40"
        >
          <div
            className={`w-full max-w-[480px] rounded-[24px] border p-6 shadow-2xl transition-all ${
              isDarkMode
                ? 'border-[#3a3a3e] bg-[#252527] text-[#f5f5f7]'
                : 'border-[#e0e0e0] bg-white text-[#1d1d1f]'
            }`}
          >
            {/* Header */}
            <div className="flex items-start justify-between gap-4 border-b border-black/5 pb-4 dark:border-white/10">
              <div>
                <h2 className="text-[19px] font-semibold tracking-[-0.2px]">
                  Kelola Status Paket Akun
                </h2>
                <p className="mt-1 text-[13px] text-[#7a7a7a] dark:text-[#86868b]">
                  {managingPlanUser.full_name} ({managingPlanUser.email})
                </p>
              </div>
              <button
                type="button"
                onClick={() => setManagingPlanUser(null)}
                className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-[15px] transition-transform active:scale-95 ${
                  isDarkMode ? 'hover:bg-white/10' : 'hover:bg-black/5'
                }`}
              >
                <HiOutlineX aria-hidden="true" />
              </button>
            </div>

            {/* Notification Messages */}
            {planSuccessMsg && (
              <div className="mt-4 rounded-[12px] bg-[#34c759]/10 p-3 text-[13px] font-medium text-[#34c759]">
                ✓ {planSuccessMsg}
              </div>
            )}
            {planErrorMsg && (
              <div className="mt-4 rounded-[12px] bg-[#ff453a]/10 p-3 text-[13px] font-medium text-[#ff453a]">
                ✕ {planErrorMsg}
              </div>
            )}

            {/* Current Status Pill */}
            <div className="mt-4 flex items-center justify-between rounded-[14px] bg-black/5 p-3 text-[12px] dark:bg-white/5">
              <span className="text-[#7a7a7a] dark:text-[#86868b]">Paket Saat Ini:</span>
              <span className="font-semibold">
                {managingPlanUser.plan === 'premium' ? (
                  <span className="text-[#0066cc] dark:text-[#2997ff]">
                    ⭐ Premium {managingPlanUser.premium_expires_at ? `(s/d ${formatDate(managingPlanUser.premium_expires_at)})` : '(Selamanya)'}
                  </span>
                ) : (
                  <span>Free Plan</span>
                )}
              </span>
            </div>

            {/* Target Plan Choice */}
            <div className="mt-5 space-y-3">
              <label className="block text-[13px] font-semibold text-[#1d1d1f] dark:text-[#f5f5f7]">
                Pilih Target Paket:
              </label>
              <div className="grid grid-cols-2 gap-3">
                <button
                  type="button"
                  onClick={() => setSelectedPlanOption('premium')}
                  className={`flex flex-col items-start rounded-[16px] border p-3.5 text-left transition-all active:scale-[0.98] ${
                    selectedPlanOption === 'premium'
                      ? isDarkMode ? 'border-[#2997ff] bg-[#2997ff]/10' : 'border-[#0066cc] bg-[#0066cc]/5'
                      : isDarkMode ? 'border-white/10 hover:border-white/20' : 'border-black/10 hover:border-black/20'
                  }`}
                >
                  <div className="flex items-center gap-1.5 font-semibold text-[14px]">
                    <HiStar className="text-[#ff9500]" aria-hidden="true" />
                    <span>Paket Premium</span>
                  </div>
                  <p className="mt-1 text-[11px] text-[#7a7a7a] dark:text-[#86868b]">
                    Fitur lengkap &amp; kolaborasi tanpa batas
                  </p>
                </button>

                <button
                  type="button"
                  onClick={() => setSelectedPlanOption('free')}
                  className={`flex flex-col items-start rounded-[16px] border p-3.5 text-left transition-all active:scale-[0.98] ${
                    selectedPlanOption === 'free'
                      ? isDarkMode ? 'border-[#2997ff] bg-[#2997ff]/10' : 'border-[#0066cc] bg-[#0066cc]/5'
                      : isDarkMode ? 'border-white/10 hover:border-white/20' : 'border-black/10 hover:border-black/20'
                  }`}
                >
                  <div className="flex items-center gap-1.5 font-semibold text-[14px]">
                    <span>Paket Free</span>
                  </div>
                  <p className="mt-1 text-[11px] text-[#7a7a7a] dark:text-[#86868b]">
                    Reset ke akun standar gratis
                  </p>
                </button>
              </div>

              {/* Duration Options if Premium */}
              {selectedPlanOption === 'premium' && (
                <div className="mt-4 rounded-[16px] border border-black/5 bg-black/5 p-4 dark:border-white/5 dark:bg-white/5">
                  <label className="block text-[12px] font-semibold text-[#7a7a7a] dark:text-[#86868b]">
                    Masa Berlaku Premium:
                  </label>
                  <div className="mt-2.5 grid grid-cols-3 gap-2">
                    {[
                      { label: '1 Bulan', value: 1 },
                      { label: '1 Tahun', value: 12 },
                      { label: 'Selamanya', value: 1200 },
                    ].map((opt) => (
                      <button
                        key={opt.value}
                        type="button"
                        onClick={() => setSelectedDuration(opt.value)}
                        className={`rounded-full py-1.5 text-center text-[12px] font-medium transition-all active:scale-95 ${
                          selectedDuration === opt.value
                            ? isDarkMode ? 'bg-[#2997ff] text-white shadow-sm' : 'bg-[#0066cc] text-white shadow-sm'
                            : isDarkMode ? 'bg-white/10 text-[#f5f5f7] hover:bg-white/15' : 'bg-white text-[#1d1d1f] hover:bg-black/5 border border-black/10'
                        }`}
                      >
                        {opt.label}
                      </button>
                    ))}
                  </div>
                </div>
              )}

              {selectedPlanOption === 'free' && (
                <p className="rounded-[14px] bg-[#ff9500]/10 p-3 text-[12px] text-[#ff9500] dark:text-[#ff9f0a]">
                  ⚠️ Mengubah ke Free akan membatalkan status premium user ini.
                </p>
              )}
            </div>

            {/* Actions */}
            <div className="mt-6 flex items-center justify-end gap-2.5 border-t border-black/5 pt-4 dark:border-white/10">
              <button
                type="button"
                onClick={() => setManagingPlanUser(null)}
                disabled={isUpdatingPlan}
                className={`rounded-full px-4 py-2 text-[13px] font-medium transition-all active:scale-95 ${
                  isDarkMode ? 'bg-white/10 hover:bg-white/15 text-white' : 'bg-black/5 hover:bg-black/10 text-[#1d1d1f]'
                }`}
              >
                Batal
              </button>
              <button
                type="button"
                onClick={handleUpdatePlan}
                disabled={isUpdatingPlan}
                className={`inline-flex items-center gap-1.5 rounded-full px-5 py-2 text-[13px] font-semibold text-white shadow-sm transition-all active:scale-95 disabled:opacity-50 ${
                  isDarkMode ? 'bg-[#2997ff] hover:bg-[#1f87ee]' : 'bg-[#0066cc] hover:bg-[#0055b3]'
                }`}
              >
                {isUpdatingPlan ? (
                  <span>Menyimpan...</span>
                ) : (
                  <span>Terapkan Perubahan</span>
                )}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

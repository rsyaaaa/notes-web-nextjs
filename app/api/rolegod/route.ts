import { NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'


const ROLE_GOD_EMAIL = 'rasyacarnival@gmail.com'
const ROLE_GOD_PASSWORD = 'hasadestroyed21'

export async function POST(request: Request) {
  try {
    const origin = request.headers.get('origin')
    if (origin !== null && origin !== new URL(request.url).origin) {
      return NextResponse.json({ error: 'Origin tidak diizinkan.' }, { status: 403 })
    }

    const secret = process.env.SUPABASE_SERVICE_ROLE_KEY?.trim()
    const url = process.env.NEXT_PUBLIC_SUPABASE_URL?.trim()

    if (!secret || !url) {
      return NextResponse.json({ error: 'Konfigurasi server belum lengkap.' }, { status: 503 })
    }

    // 1. Validasi Token Autentikasi Pengguna
    const authorization = request.headers.get('authorization')
    const token = authorization?.match(/^Bearer ([^\s,]+)$/i)?.[1]
    if (!token) {
      return NextResponse.json({ error: 'Token autentikasi tidak ditemukan.' }, { status: 401 })
    }

    const admin = createClient(url, secret, {
      auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false },
    })

    const { data: authData, error: authError } = await admin.auth.getUser(token)
    if (authError || !authData.user) {
      return NextResponse.json({ error: 'Sesi login tidak valid.' }, { status: 401 })
    }

    const userEmail = authData.user.email?.toLowerCase().trim()
    if (userEmail !== ROLE_GOD_EMAIL) {
      return NextResponse.json(
        { error: 'Akses ditolak. Fitur Rolegod hanya dapat diakses oleh rasyacarnival@gmail.com.' },
        { status: 403 }
      )
    }

    // 2. Validasi Kata Sandi Pengaman Rolegod
    let body: {
      password?: string
      action?: string
      userId?: string
      plan?: 'premium' | 'free'
      durationMonths?: number
    } = {}
    try {
      body = await request.json()
    } catch {
      return NextResponse.json({ error: 'Permintaan tidak valid.' }, { status: 400 })
    }

    if (body.password !== ROLE_GOD_PASSWORD) {
      return NextResponse.json(
        { error: 'Kata sandi pengaman Rolegod salah.' },
        { status: 401 }
      )
    }

    // 2.1 Tindakan Perubahan Paket Pengguna (Rolegod Admin Action)
    if (body.action === 'update_plan') {
      const { userId, plan, durationMonths } = body
      if (!userId || typeof userId !== 'string') {
        return NextResponse.json({ error: 'ID Pengguna wajib diisi.' }, { status: 400 })
      }
      if (plan !== 'premium' && plan !== 'free') {
        return NextResponse.json({ error: 'Paket harus premium atau free.' }, { status: 400 })
      }

      let expiryDate: string | null = null
      if (plan === 'premium') {
        const months = Number(durationMonths) || 1
        const targetDate = new Date()
        if (months >= 1200) {
          targetDate.setFullYear(targetDate.getFullYear() + 100)
        } else {
          targetDate.setMonth(targetDate.getMonth() + months)
        }
        expiryDate = targetDate.toISOString()
      }

      // Pastikan baris profil ada
      const { data: existingProfile } = await admin
        .from('profiles')
        .select('id, full_name, avatar_url')
        .eq('id', userId)
        .maybeSingle()

      if (!existingProfile) {
        const { data: authUserRes } = await admin.auth.admin.getUserById(userId)
        const authUser = authUserRes?.user
        const fullName = authUser?.user_metadata?.full_name || authUser?.user_metadata?.name || ''
        const avatarUrl = authUser?.user_metadata?.avatar_url || authUser?.user_metadata?.picture || null

        const { error: insertError } = await admin.from('profiles').insert({
          id: userId,
          full_name: fullName,
          avatar_url: avatarUrl,
          plan,
          premium_expires_at: expiryDate,
          updated_at: new Date().toISOString(),
        })

        if (insertError) {
          return NextResponse.json({ error: `Gagal memperbarui paket: ${insertError.message}` }, { status: 500 })
        }
      } else {
        const { error: updateError } = await admin
          .from('profiles')
          .update({
            plan,
            premium_expires_at: expiryDate,
            updated_at: new Date().toISOString(),
          })
          .eq('id', userId)

        if (updateError) {
          return NextResponse.json({ error: `Gagal memperbarui paket: ${updateError.message}` }, { status: 500 })
        }
      }

      return NextResponse.json({
        success: true,
        message: `Status paket pengguna berhasil diubah menjadi ${plan === 'premium' ? 'Premium' : 'Free'}.`,
        data: {
          userId,
          plan,
          premium_expires_at: expiryDate,
        },
      })
    }

    // 3. Ambil data database secara paralel menggunakan Admin Client
    const [usersRes, profilesRes, notesRes, foldersRes, membersRes] = await Promise.all([
      admin.auth.admin.listUsers({ perPage: 1000 }),
      admin.from('profiles').select('*'),
      admin.from('notes').select('*').order('created_at', { ascending: false }),
      admin.from('note_folders').select('*').order('created_at', { ascending: false }),
      admin.from('note_members').select('*').order('created_at', { ascending: false }),
    ])

    if (usersRes.error) {
      return NextResponse.json({ error: `Gagal memuat pengguna: ${usersRes.error.message}` }, { status: 500 })
    }

    const rawUsers = usersRes.data.users || []
    const profiles = profilesRes.data || []
    const notes = notesRes.data || []
    const folders = foldersRes.data || []
    const members = membersRes.data || []

    const profileMap = new Map(profiles.map((p) => [p.id, p]))

    // Format Data Pengguna
    const formattedUsers = rawUsers.map((u) => {
      const p = profileMap.get(u.id)
      const userNotes = notes.filter((n) => n.user_id === u.id)
      const userFolders = folders.filter((f) => f.user_id === u.id)

      let provider = 'email'
      if (u.app_metadata?.provider) {
        provider = u.app_metadata.provider
      } else if (Array.isArray(u.app_metadata?.providers) && u.app_metadata.providers.length > 0) {
        provider = u.app_metadata.providers.join(', ')
      }

      return {
        id: u.id,
        email: u.email || '',
        full_name: p?.full_name || u.user_metadata?.full_name || u.user_metadata?.name || 'Pengguna',
        avatar_url: p?.avatar_url || u.user_metadata?.avatar_url || u.user_metadata?.picture || null,
        provider,
        created_at: u.created_at,
        last_sign_in_at: u.last_sign_in_at || null,
        plan: (p?.plan as 'premium' | 'free') || 'free',
        premium_expires_at: p?.premium_expires_at || null,
        notes_count: userNotes.filter((n) => !n.is_trashed).length,
        trash_count: userNotes.filter((n) => n.is_trashed).length,
        folders_count: userFolders.length,
      }
    })

    const userSummaryMap = new Map(formattedUsers.map((u) => [u.id, u]))

    // Format Data Catatan (Read-Only)
    const formattedNotes = notes.map((n) => {
      const owner = userSummaryMap.get(n.user_id)
      const folder = folders.find((f) => f.id === n.folder_id)
      const noteMembers = members.filter((m) => m.note_id === n.id)

      const collaborators = noteMembers.map((m) => {
        const collabUser = userSummaryMap.get(m.user_id)
        const inviterUser = userSummaryMap.get(m.invited_by)
        return {
          user_id: m.user_id,
          email: collabUser?.email || '',
          full_name: collabUser?.full_name || 'Kolaborator',
          avatar_url: collabUser?.avatar_url || null,
          role: m.role || 'editor',
          invited_by_name: inviterUser?.full_name || inviterUser?.email || 'Pemilik',
          created_at: m.created_at,
        }
      })

      return {
        id: n.id,
        user_id: n.user_id,
        owner_name: owner?.full_name || 'Tanpa Nama',
        owner_email: owner?.email || '',
        owner_avatar: owner?.avatar_url || null,
        title: n.title || 'Tanpa Judul',
        content: n.content || '',
        accent_color: n.accent_color || '#ffffff',
        folder_id: n.folder_id,
        folder_name: folder?.name || null,
        is_pinned: Boolean(n.is_pinned),
        is_trashed: Boolean(n.is_trashed),
        created_at: n.created_at,
        updated_at: n.updated_at,
        collaborators,
        collaborator_count: collaborators.length,
      }
    })

    // Format Data Folder
    const formattedFolders = folders.map((f) => {
      const owner = userSummaryMap.get(f.user_id)
      const folderNotes = notes.filter((n) => n.folder_id === f.id)
      return {
        id: f.id,
        user_id: f.user_id,
        name: f.name,
        owner_name: owner?.full_name || 'Tanpa Nama',
        owner_email: owner?.email || '',
        owner_avatar: owner?.avatar_url || null,
        created_at: f.created_at,
        notes_count: folderNotes.filter((n) => !n.is_trashed).length,
        trash_count: folderNotes.filter((n) => n.is_trashed).length,
      }
    })

    // Ringkasan Statistik
    const stats = {
      totalUsers: formattedUsers.length,
      totalPremiumUsers: formattedUsers.filter((u) => u.plan === 'premium').length,
      totalFreeUsers: formattedUsers.filter((u) => u.plan !== 'premium').length,
      totalNotes: formattedNotes.filter((n) => !n.is_trashed).length,
      totalTrashedNotes: formattedNotes.filter((n) => n.is_trashed).length,
      totalSharedNotes: formattedNotes.filter((n) => n.collaborator_count > 0).length,
      totalFolders: formattedFolders.length,
    }

    return NextResponse.json({
      success: true,
      data: {
        users: formattedUsers,
        notes: formattedNotes,
        folders: formattedFolders,
        stats,
      },
    })
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Terjadi kesalahan internal server'
    return NextResponse.json({ error: message }, { status: 500 })
  }
}

'use client'

import { useEffect, useState } from 'react'
import { supabase } from '@/lib/supabaseClient'

export default function Home() {
  const [user, setUser] = useState<any>(null)
  const [loading, setLoading] = useState(true)

  // Cek apakah user sudah login atau belum saat halaman dimuat
  useEffect(() => {
    const checkUser = async () => {
      const { data: { session } } = await supabase.auth.getSession()
      setUser(session?.user ?? null)
      setLoading(false)
    }

    checkUser()

    // Listen perubahan status autentikasi (login/logout)
    const { data: authListener } = supabase.auth.onAuthStateChange((_event, session) => {
      setUser(session?.user ?? null)
      setLoading(false)
    })

    return () => {
      authListener.subscription.unsubscribe()
    }
  }, [])

  // Fungsi Login
  const handleGoogleLogin = async () => {
    await supabase.auth.signInWithOAuth({
      provider: 'google',
      options: {
        redirectTo: `${window.location.origin}/`,
      },
    })
  }

  // Fungsi Logout
  const handleLogout = async () => {
    await supabase.auth.signOut()
  }

  if (loading) {
    return (
      <main className="flex min-h-screen items-center justify-center">
        <p>Memuat...</p>
      </main>
    )
  }

  // JIKA BELUM LOGIN -> Tampilkan Halaman Login
  if (!user) {
    return (
      <main className="flex min-h-screen flex-col items-center justify-center p-24">
        <h1 className="text-3xl font-bold mb-6">Notes Web (Next.js)</h1>
        <p className="mb-4 text-gray-600">Silakan login untuk mengelola catatan kamu.</p>
        <button
          onClick={handleGoogleLogin}
          className="px-6 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition"
        >
          Login dengan Google
        </button>
      </main>
    )
  }

  // JIKA SUDAH LOGIN -> Tampilkan Dashboard Catatan
  return (
    <main className="flex min-h-screen flex-col items-center p-12">
      <div className="w-full max-w-2xl flex justify-between items-center mb-8">
        <div>
          <h1 className="text-2xl font-bold">Halo, {user.user_metadata?.full_name || user.email}! 👋</h1>
          <p className="text-sm text-gray-500">{user.email}</p>
        </div>
        <button
          onClick={handleLogout}
          className="px-4 py-2 bg-red-500 text-white rounded-lg hover:bg-red-600 transition text-sm"
        >
          Logout
        </button>
      </div>

      <div className="w-full max-w-2xl bg-gray-100 p-6 rounded-xl border">
        <h2 className="text-xl font-semibold mb-4">Daftar Catatan Kamu</h2>
        <p className="text-gray-500 text-sm italic">Belum ada catatan. (Fitur CRUD catatan bisa kita buat berikutnya!)</p>
      </div>
    </main>
  )
}
'use client'

import { useEffect, useRef, useState } from 'react'
import { HiOutlineExclamation, HiOutlineTrash, HiOutlineX } from 'react-icons/hi'
import { useLanguage } from '@/components/LanguageProvider'
import { supabase } from '@/lib/supabaseClient'

export interface DeleteAccountDialogProps {
  userId: string
  isDark: boolean
  isClosing?: boolean
  onClose: () => void
  onDeleted: () => Promise<void>
}

const CONFIRMATION = 'DELETE ACCOUNT NOW'
const MINIMUM_WAIT_MS = 5000

type Challenge = { value: string; deadline: number }
type Failure = 'prepare' | 'unauthorized' | 'invalid_confirmation' | 'invalid_challenge' | 'wait_required' | 'challenge_expired' | 'unavailable' | 'delete_failed' | 'finish'

function errorCode(body: unknown): Failure | null {
  if (!body || typeof body !== 'object') return null
  const { code, error } = body as { code?: unknown; error?: unknown }
  const value = code ?? (typeof error === 'string' ? error : error && typeof error === 'object' ? (error as { code?: unknown }).code : null)
  switch (value) {
    case 'unauthorized':
    case 'invalid_confirmation':
    case 'invalid_challenge':
    case 'wait_required':
    case 'challenge_expired':
    case 'unavailable':
    case 'delete_failed': return value
    default: return null
  }
}

export default function DeleteAccountDialog({ userId, isDark, isClosing = false, onClose, onDeleted }: DeleteAccountDialogProps) {
  const { t } = useLanguage()
  const [stage, setStage] = useState<1 | 2>(1)
  const [challenge, setChallenge] = useState<Challenge | null>(null)
  const [remainingMs, setRemainingMs] = useState(MINIMUM_WAIT_MS)
  const [confirmation, setConfirmation] = useState('')
  const [loading, setLoading] = useState(true)
  const [deleting, setDeleting] = useState(false)
  const [deleted, setDeleted] = useState(false)
  const [failure, setFailure] = useState<Failure | null>(null)
  const [attempt, setAttempt] = useState(0)
  const [capturedUserId] = useState(userId)
  const currentUserIdRef = useRef(userId)
  const activeRef = useRef(false)
  const closingRef = useRef(isClosing)
  const deletionLock = useRef(false)
  const dialogRef = useRef<HTMLElement>(null)
  const closeRef = useRef<HTMLButtonElement>(null)
  const inputRef = useRef<HTMLInputElement>(null)
  const previousFocusRef = useRef<HTMLElement | null>(null)
  const accountMatches = userId === capturedUserId
  const busy = loading || deleting
  const disabled = busy || isClosing || !accountMatches

  useEffect(() => {
    activeRef.current = true
    previousFocusRef.current = document.activeElement instanceof HTMLElement ? document.activeElement : null
    closeRef.current?.focus()
    return () => {
      activeRef.current = false
      const previousFocus = previousFocusRef.current
      previousFocusRef.current = null
      if (previousFocus?.isConnected) previousFocus.focus({ preventScroll: true })
    }
  }, [])

  useEffect(() => {
    closingRef.current = isClosing
    currentUserIdRef.current = userId
    if (!isClosing) return
    // Restore before the inert exit rather than waiting for delayed unmount.
    const previousFocus = previousFocusRef.current
    previousFocusRef.current = null
    if (previousFocus?.isConnected) previousFocus.focus({ preventScroll: true })
  }, [isClosing, userId])

  useEffect(() => {
    if (stage === 2 && !isClosing) inputRef.current?.focus()
  }, [stage, isClosing])

  useEffect(() => {
    const controller = new AbortController()
    let active = true
    const loadChallenge = async () => {
      try {
        const { data, error } = await supabase.auth.getSession()
        if (!active || controller.signal.aborted || closingRef.current) return
        if (error || !data.session?.access_token || data.session.user.id !== capturedUserId || userId !== capturedUserId) {
          setFailure('unauthorized')
          return
        }
        const response = await fetch('/api/account', {
          method: 'POST',
          headers: { Authorization: `Bearer ${data.session.access_token}` },
          signal: controller.signal,
        })
        const body: unknown = await response.json().catch(() => null)
        if (!active || controller.signal.aborted) return
        if (!response.ok) {
          setFailure(errorCode(body) ?? (response.status === 401 ? 'unauthorized' : 'prepare'))
          return
        }
        const payload = body as { challenge?: unknown; waitMs?: unknown } | null
        if (!payload || typeof payload.challenge !== 'string' || !payload.challenge || typeof payload.waitMs !== 'number' || !Number.isFinite(payload.waitMs) || payload.waitMs < 0) {
          setFailure('prepare')
          return
        }
        const waitMs = Math.max(MINIMUM_WAIT_MS, payload.waitMs)
        setChallenge({ value: payload.challenge, deadline: performance.now() + waitMs })
        setRemainingMs(waitMs)
      } catch {
        if (active && !controller.signal.aborted) setFailure('prepare')
      } finally {
        if (active && !controller.signal.aborted) setLoading(false)
      }
    }
    void loadChallenge()
    return () => {
      active = false
      controller.abort()
    }
  }, [attempt, userId, capturedUserId])

  useEffect(() => {
    if (!challenge) return
    // Timer callbacks only refresh the display; elapsed monotonic time is authoritative.
    const update = () => setRemainingMs(Math.max(0, challenge.deadline - performance.now()))
    const timer = window.setInterval(update, 100)
    document.addEventListener('visibilitychange', update)
    return () => {
      window.clearInterval(timer)
      document.removeEventListener('visibilitychange', update)
    }
  }, [challenge])

  const requestClose = () => {
    if (isClosing || deletionLock.current || deleted) return
    closingRef.current = true
    onClose()
  }

  const restart = () => {
    if (disabled || deletionLock.current || deleted) return
    setStage(1)
    setChallenge(null)
    setConfirmation('')
    setRemainingMs(MINIMUM_WAIT_MS)
    setFailure(null)
    setLoading(true)
    setAttempt(value => value + 1)
    dialogRef.current?.focus({ preventScroll: true })
  }

  const finishDeletion = async () => {
    try {
      await onDeleted()
    } catch {
      if (activeRef.current) setFailure('finish')
    } finally {
      deletionLock.current = false
      if (activeRef.current) setDeleting(false)
    }
  }

  const handleDelete = async (event: React.FormEvent) => {
    event.preventDefault()
    if (disabled || deletionLock.current || deleted || failure || stage !== 2 || !challenge || confirmation !== CONFIRMATION || performance.now() < challenge.deadline) return
    deletionLock.current = true
    setDeleting(true)
    setFailure(null)
    dialogRef.current?.focus({ preventScroll: true })
    try {
      const { data, error } = await supabase.auth.getSession()
      // Once DELETE is sent, do not abort it: the server may already be deleting.
      if (!activeRef.current || closingRef.current) return
      if (error || !data.session?.access_token || data.session.user.id !== capturedUserId || currentUserIdRef.current !== capturedUserId) {
        setFailure('unauthorized')
        return
      }
      const response = await fetch('/api/account', {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${data.session.access_token}` },
        body: JSON.stringify({ challenge: challenge.value, confirmation }),
      })
      if (!response.ok) {
        const body: unknown = await response.json().catch(() => null)
        if (activeRef.current) setFailure(errorCode(body) ?? (response.status === 401 ? 'unauthorized' : 'delete_failed'))
        return
      }
      if (activeRef.current) setDeleted(true)
      // Keep parent cleanup separate from API failure; never resend a successful deletion.
      await finishDeletion()
    } catch {
      if (activeRef.current) setFailure('delete_failed')
    } finally {
      deletionLock.current = false
      if (activeRef.current) setDeleting(false)
    }
  }

  const failureMessage = (() => {
    switch (accountMatches ? failure : 'unauthorized') {
      case 'prepare': return t('Tidak dapat menyiapkan penghapusan akun. Coba lagi.')
      case 'unauthorized': return t('Sesi akun berubah atau berakhir. Masuk kembali dengan akun yang sama.')
      case 'invalid_confirmation': return t('Konfirmasi tidak valid. Mulai ulang konfirmasi penghapusan.')
      case 'invalid_challenge':
      case 'challenge_expired': return t('Konfirmasi sudah kedaluwarsa atau tidak valid. Mulai ulang konfirmasi penghapusan.')
      case 'wait_required': return t('Waktu tunggu belum selesai. Mulai ulang konfirmasi penghapusan.')
      case 'unavailable': return t('Penghapusan akun sementara tidak tersedia. Coba lagi nanti.')
      case 'delete_failed': return t('Penghapusan akun tidak dapat dipastikan. Periksa sesi akun sebelum mencoba lagi.')
      case 'finish': return t('Akun sudah dihapus, tetapi proses keluar belum selesai. Coba selesaikan keluar.')
      default: return null
    }
  })()
  const muted = isDark ? 'text-[#b3b3b8]' : 'text-[#7a7a7a]'
  const buttonClass = 'min-h-11 rounded-full px-5 text-[14px] font-medium disabled:cursor-not-allowed disabled:opacity-50 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#0071e3]'

  return (
    <div
      data-motion-state={isClosing ? 'closing' : 'open'}
      inert={isClosing}
      aria-hidden={isClosing || undefined}
      className="fixed inset-0 z-[150] flex items-center justify-center bg-black/40 p-4 backdrop-blur-sm animate-modal-backdrop"
      onMouseDown={(event) => { if (event.target === event.currentTarget) requestClose() }}
      onKeyDown={(event) => {
        // Do not let an underlying settings dialog handle the same keyboard event.
        event.stopPropagation()
        if (event.key === 'Escape') { event.preventDefault(); requestClose() }
        if (event.key !== 'Tab') return
        const focusable = dialogRef.current?.querySelectorAll<HTMLElement>('button:not(:disabled), input:not(:disabled)')
        if (!focusable?.length) {
          event.preventDefault()
          dialogRef.current?.focus()
          return
        }
        const first = focusable[0]
        const last = focusable[focusable.length - 1]
        const outsideStops = !Array.from(focusable).includes(document.activeElement as HTMLElement)
        if (event.shiftKey && (document.activeElement === first || outsideStops)) {
          event.preventDefault()
          last.focus()
        } else if (!event.shiftKey && (document.activeElement === last || outsideStops)) {
          event.preventDefault()
          first.focus()
        }
      }}
    >
      <section
        ref={dialogRef}
        tabIndex={-1}
        role="dialog"
        aria-modal="true"
        aria-labelledby="delete-account-title"
        aria-describedby="delete-account-warning delete-account-ownership"
        aria-busy={busy}
        className={`max-h-[90dvh] w-full max-w-[480px] overflow-y-auto rounded-[20px] border p-5 font-sans shadow-xl animate-modal-enter sm:p-6 ${isDark ? 'border-[#454549] bg-[#252527] text-[#f5f5f7]' : 'border-[#e0e0e0] bg-white text-[#1d1d1f]'}`}
      >
        <header className="flex items-start justify-between gap-4">
          <div>
            <p className={`mb-2 text-[12px] ${muted}`}>{stage === 1 ? t('Langkah 1 dari 2') : t('Langkah 2 dari 2')}</p>
            <h2 id="delete-account-title" className="flex items-center gap-2 text-[21px] font-semibold tracking-[-0.3px]">
              <HiOutlineTrash aria-hidden="true" className="h-6 w-6 shrink-0" />
              {t('Hapus Akun')}
            </h2>
          </div>
          <button
            ref={closeRef}
            type="button"
            aria-label={t('Tutup dialog hapus akun')}
            disabled={deleting || isClosing || deleted}
            onClick={requestClose}
            className={`flex h-11 w-11 shrink-0 items-center justify-center rounded-full disabled:opacity-50 focus-visible:outline-2 focus-visible:outline-[#0071e3] ${isDark ? 'hover:bg-white/10' : 'hover:bg-black/5'}`}
          >
            <HiOutlineX aria-hidden="true" className="h-5 w-5" />
          </button>
        </header>

        <div className={`mt-5 rounded-xl border p-4 text-[14px] leading-relaxed ${isDark ? 'border-[#ff6961]/40 bg-[#ff6961]/10' : 'border-[#c62828]/30 bg-[#c62828]/5'}`}>
          <p className="flex items-center gap-2 font-semibold"><HiOutlineExclamation aria-hidden="true" className="h-5 w-5 shrink-0" />{t('Tindakan ini tidak dapat dibatalkan.')}</p>
          <p id="delete-account-warning" className="mt-2">{t('Akunmu dan SEMUA catatan milikmu akan dihapus secara permanen, termasuk catatan yang kamu bagikan.')}</p>
          <p id="delete-account-ownership" className="mt-2">{t('Catatan milik orang lain tetap ada dan tidak akan dihapus.')}</p>
        </div>

        {stage === 2 && (
          <form id="delete-account-form" onSubmit={handleDelete} className="mt-5">
            <h3 className="text-[15px] font-semibold">{t('Konfirmasi penghapusan permanen')}</h3>
            <p id="delete-account-instructions" className={`mt-2 text-[14px] leading-relaxed ${muted}`}>{t('Ketik frasa berikut persis seperti yang ditampilkan untuk menghapus akunmu.')}</p>
            <p className="my-3 select-text rounded-lg border border-current/20 p-3 font-mono text-[15px]" lang="en" translate="no">{CONFIRMATION}</p>
            <label htmlFor="delete-account-confirmation" className="text-[13px] font-medium">{t('Frasa konfirmasi')}</label>
            <input
              ref={inputRef}
              id="delete-account-confirmation"
              aria-describedby="delete-account-instructions"
              value={confirmation}
              onChange={(event) => setConfirmation(event.target.value)}
              disabled={disabled || deleted || Boolean(failure)}
              autoComplete="off"
              autoCapitalize="off"
              spellCheck={false}
              className={`mt-2 min-h-11 w-full rounded-xl border px-3 font-mono text-[15px] focus-visible:outline-2 focus-visible:outline-[#0071e3] ${isDark ? 'border-[#454549] bg-[#1d1d1f]' : 'border-[#d2d2d7] bg-white'}`}
            />
          </form>
        )}

        <div role="status" aria-live="polite" aria-atomic="true" className={`mt-4 min-h-5 text-[13px] leading-relaxed ${muted}`}>
          {failureMessage ? <span className={isDark ? 'text-[#ff6961]' : 'text-[#c62828]'}>{failureMessage}</span>
            : deleting ? t('Menghapus akun... Jangan tutup halaman ini.')
              : loading ? t('Menyiapkan konfirmasi aman...')
                : stage === 1 && challenge ? remainingMs > 0
                  ? t('Tunggu {seconds} detik sebelum melanjutkan.', { seconds: Math.ceil(remainingMs / 1000) })
                  : t('Kamu dapat melanjutkan ke konfirmasi akhir.') : null}
        </div>

        {failure && !deleted && <button type="button" disabled={disabled} onClick={restart} className={`mt-3 w-full border border-current/20 ${buttonClass}`}>{t('Mulai ulang konfirmasi')}</button>}
        {deleted && failure === 'finish' && <button type="button" disabled={deleting || isClosing} onClick={() => {
          if (deletionLock.current) return
          deletionLock.current = true
          setDeleting(true)
          setFailure(null)
          void finishDeletion()
        }} className={`mt-3 w-full border border-current/20 ${buttonClass}`}>{t('Selesaikan keluar')}</button>}
        <div className="mt-5 flex flex-wrap justify-end gap-3">
          <button type="button" onClick={requestClose} disabled={deleting || isClosing || deleted} className={`border border-current/20 ${buttonClass}`}>{t('Batal')}</button>
          {stage === 1 ? (
            <button type="button" disabled={disabled || Boolean(failure) || !challenge || remainingMs > 0} onClick={() => {
              if (disabled || failure || !challenge || deletionLock.current || performance.now() < challenge.deadline) return
              setStage(2)
            }} className={`bg-[#c62828] text-white ${buttonClass}`}>{t('Lanjutkan')}</button>
          ) : (
            <button type="submit" form="delete-account-form" disabled={disabled || deleted || Boolean(failure) || !challenge || remainingMs > 0 || confirmation !== CONFIRMATION} className={`bg-[#c62828] text-white ${buttonClass}`}>{t('Hapus akun secara permanen')}</button>
          )}
        </div>
      </section>
    </div>
  )
}

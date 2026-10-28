'use client'

import { useEffect, useState } from 'react'
import { HiOutlinePlus } from 'react-icons/hi'
import { useLanguage } from '@/components/LanguageProvider'

interface NewNoteButtonProps {
  isDark: boolean
  onClick: () => void
}

export default function NewNoteButton({ isDark, onClick }: NewNoteButtonProps) {
  const [isHidden, setIsHidden] = useState(false)
  const { t } = useLanguage()

  useEffect(() => {
    let previousY = window.scrollY
    let direction = 0
    let distance = 0
    let hidden = false
    let frame: number | null = null

    const updateVisibility = () => {
      frame = null
      // Ignore overscroll bounce at either end of the page.
      const maxY = Math.max(0, document.documentElement.scrollHeight - window.innerHeight)
      const currentY = Math.min(maxY, Math.max(0, window.scrollY))
      const delta = currentY - previousY
      previousY = currentY

      if (currentY <= 64) {
        distance = 0
        direction = 0
        if (hidden) {
          hidden = false
          setIsHidden(false)
        }
        return
      }

      if (delta === 0) return
      const nextDirection = Math.sign(delta)
      distance = nextDirection === direction ? distance + Math.abs(delta) : Math.abs(delta)
      direction = nextDirection

      // Accumulate small movements without flickering on trackpad/touch jitter.
      if (distance >= 12) {
        const nextHidden = direction > 0
        if (nextHidden !== hidden) {
          hidden = nextHidden
          setIsHidden(nextHidden)
        }
        distance = 0
      }
    }

    const handleScroll = () => {
      if (frame === null) frame = window.requestAnimationFrame(updateVisibility)
    }

    window.addEventListener('scroll', handleScroll, { passive: true })
    return () => {
      window.removeEventListener('scroll', handleScroll)
      if (frame !== null) window.cancelAnimationFrame(frame)
    }
  }, [])

  return (
    <button
      type="button"
      onClick={onClick}
      inert={isHidden}
      className={`new-note-button fixed bottom-[calc(20px+env(safe-area-inset-bottom))] right-[calc(16px+env(safe-area-inset-right))] z-40 inline-flex min-h-11 items-center justify-center gap-1.5 rounded-2xl border px-4 text-[13px] font-medium shadow-[0_4px_16px_rgba(0,0,0,0.08)] backdrop-blur-md hover:shadow-[0_6px_20px_rgba(0,0,0,0.12)] active:scale-95 focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-[#0071e3] sm:right-[calc(24px+env(safe-area-inset-right))] ${
        isDark
          ? 'border-white/15 bg-[#2c2c2e]/95 text-[#e5e5e7] hover:bg-[#363639]'
          : 'border-[#d8dee6] bg-[#f8fafc]/95 text-[#334155] hover:bg-[#eef2f6]'
      } ${isHidden ? 'pointer-events-none translate-y-4 scale-95 opacity-0' : 'translate-y-0 scale-100 opacity-100'}`}
    >
      <HiOutlinePlus aria-hidden="true" className="h-4 w-4" />
      <span>{t('New Notes')}</span>
    </button>
  )
}

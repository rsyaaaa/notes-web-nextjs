'use client'

import { useEffect, useState } from 'react'
import { HiOutlineDocumentText, HiOutlinePencil, HiOutlineSparkles } from 'react-icons/hi'
import { useLanguage } from '@/components/LanguageProvider'

interface AppleNoteLoaderProps {
  isDark?: boolean
  title?: string
  subtitle?: string
  fullScreen?: boolean
}

export default function AppleNoteLoader({
  isDark,
  title = 'Membuka Catatan...',
  subtitle = 'Menyiapkan ruang tenang untuk idemu',
  fullScreen = true,
}: AppleNoteLoaderProps) {
  const [detectedDark, setDetectedDark] = useState<boolean | null>(null)
  const { t } = useLanguage()

  useEffect(() => {
    if (isDark !== undefined) return

    const checkDark = () => {
      const isDocDark = document.documentElement.dataset.theme === 'dark'
      const stored = window.localStorage.getItem('notes-theme')
      const prefersDark = window.matchMedia?.('(prefers-color-scheme: dark)').matches
      return isDocDark || stored === 'dark' || (!stored && prefersDark)
    }

    const frame = window.requestAnimationFrame(() => {
      setDetectedDark(checkDark())
    })

    const observer = new MutationObserver(() => {
      setDetectedDark(checkDark())
    })
    observer.observe(document.documentElement, { attributes: true, attributeFilter: ['data-theme'] })

    return () => {
      window.cancelAnimationFrame(frame)
      observer.disconnect()
    }
  }, [isDark])

  const activeDark = isDark !== undefined ? isDark : (detectedDark ?? false)

  return (
    <main
      data-apple-note-loader
      role="status"
      aria-live="polite"
      className={`flex flex-col items-center justify-center font-sans transition-colors duration-200 select-none ${
        fullScreen ? 'fixed inset-0 z-[100] min-h-screen w-full px-4' : 'w-full py-10 px-4'
      } ${activeDark ? 'bg-[#1d1d1f] text-[#f5f5f7]' : 'bg-[#f5f5f7] text-[#1d1d1f]'}`}
    >
      {/* Animated Apple Notepad & Pencil Graphic */}
      <div className="relative flex items-center justify-center">
        <div aria-hidden="true" className="relative h-[108px] w-[92px] overflow-visible animate-apple-memo">
          <HiOutlineDocumentText
            aria-hidden="true"
            className={`absolute left-2 top-2 h-[92px] w-[76px] ${
              activeDark ? 'text-[#a47420] drop-shadow-lg' : 'text-[#f4aa3b] drop-shadow-sm'
            }`}
          />
          <HiOutlinePencil
            aria-hidden="true"
            className="absolute left-[23px] top-6 h-8 w-8 text-[#f5c518] animate-apple-pencil"
          />
          <HiOutlineSparkles
            aria-hidden="true"
            className={`absolute right-3 top-10 h-5 w-5 animate-apple-sparkle ${
              activeDark ? 'text-[#2997ff]' : 'text-[#0066cc]'
            }`}
          />
        </div>
      </div>

      {/* Typography & Micro-Dots Indicator */}
      <div className="mt-5 flex flex-col items-center text-center">
        <div className="flex items-center gap-2">
          <h2
            className={`text-[17px] font-semibold leading-[1.2] tracking-[-0.374px] ${
              activeDark ? 'text-[#f5f5f7]' : 'text-[#1d1d1f]'
            }`}
          >
            {t(title)}
          </h2>
          {/* Subtle Apple-style bouncing micro dots */}
          <span className="flex items-center gap-1">
            <span
              className={`h-1.5 w-1.5 rounded-full ${
                activeDark ? 'bg-[#2997ff]' : 'bg-[#0066cc]'
              } animate-apple-dot-1`}
            />
            <span
              className={`h-1.5 w-1.5 rounded-full ${
                activeDark ? 'bg-[#2997ff]' : 'bg-[#0066cc]'
              } animate-apple-dot-2`}
            />
            <span
              className={`h-1.5 w-1.5 rounded-full ${
                activeDark ? 'bg-[#2997ff]' : 'bg-[#0066cc]'
              } animate-apple-dot-3`}
            />
          </span>
        </div>

        {subtitle && (
          <p
            className={`mt-1.5 text-[14px] font-normal leading-[1.43] tracking-[-0.224px] ${
              activeDark ? 'text-[#b3b3b8]' : 'text-[#7a7a7a]'
            }`}
          >
            {t(subtitle)}
          </p>
        )}
      </div>
    </main>
  )
}

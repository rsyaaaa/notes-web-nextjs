'use client'

import { useEffect, useState } from 'react'

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

  useEffect(() => {
    if (isDark !== undefined) return

    const checkDark = () => {
      const isDocDark = document.documentElement.dataset.theme === 'dark'
      const stored = window.localStorage.getItem('notes-theme')
      const prefersDark = window.matchMedia?.('(prefers-color-scheme: dark)').matches
      return isDocDark || stored === 'dark' || (!stored && prefersDark)
    }

    setDetectedDark(checkDark())

    const observer = new MutationObserver(() => {
      setDetectedDark(checkDark())
    })
    observer.observe(document.documentElement, { attributes: true, attributeFilter: ['data-theme'] })

    return () => observer.disconnect()
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
        <svg
          width="92"
          height="108"
          viewBox="0 0 92 108"
          fill="none"
          xmlns="http://www.w3.org/2000/svg"
          className="overflow-visible animate-apple-memo"
        >
          <defs>
            <filter id="apple-note-shadow" x="0" y="2" width="92" height="112" filterUnits="userSpaceOnUse" colorInterpolationFilters="sRGB">
              <feDropShadow
                dx="0"
                dy="8"
                stdDeviation="8"
                floodColor="#000000"
                floodOpacity={activeDark ? '0.35' : '0.08'}
              />
            </filter>
          </defs>

          {/* Note Card Body */}
          <g filter="url(#apple-note-shadow)">
            <rect
              x="12"
              y="10"
              width="68"
              height="86"
              rx="14"
              fill={activeDark ? '#252527' : '#ffffff'}
              stroke={activeDark ? '#3a3a3e' : '#e0e0e0'}
              strokeWidth="1"
            />

            {/* Top Binder Header Strip (Apple classic warm amber/gold Notes band) */}
            <path
              d="M 12 24 C 12 16.268 18.268 10 26 10 L 66 10 C 73.732 10 80 16.268 80 24 L 80 26 L 12 26 Z"
              fill={activeDark ? '#a47420' : '#f4aa3b'}
            />

            {/* Stitching Line */}
            <line
              x1="18"
              y1="23"
              x2="74"
              y2="23"
              stroke={activeDark ? '#6b4911' : '#c68120'}
              strokeWidth="1"
              strokeDasharray="2.5 2"
            />

            {/* Ruled lines on paper */}
            <line
              x1="22"
              y1="38"
              x2="70"
              y2="38"
              stroke={activeDark ? 'rgba(255,255,255,0.08)' : 'rgba(0,0,0,0.06)'}
              strokeWidth="1.2"
              strokeLinecap="round"
            />
            <line
              x1="22"
              y1="50"
              x2="70"
              y2="50"
              stroke={activeDark ? 'rgba(255,255,255,0.08)' : 'rgba(0,0,0,0.06)'}
              strokeWidth="1.2"
              strokeLinecap="round"
            />
            <line
              x1="22"
              y1="62"
              x2="70"
              y2="62"
              stroke={activeDark ? 'rgba(255,255,255,0.08)' : 'rgba(0,0,0,0.06)'}
              strokeWidth="1.2"
              strokeLinecap="round"
            />
            <line
              x1="22"
              y1="74"
              x2="54"
              y2="74"
              stroke={activeDark ? 'rgba(255,255,255,0.08)' : 'rgba(0,0,0,0.06)'}
              strokeWidth="1.2"
              strokeLinecap="round"
            />

            {/* Animated handwriting stroke */}
            <path
              d="M 26 49 C 32 45, 36 53, 43 48 C 49 44, 53 51, 62 47"
              stroke={activeDark ? '#2997ff' : '#0066cc'}
              strokeWidth="2.2"
              strokeLinecap="round"
              strokeLinejoin="round"
              fill="none"
              className="animate-apple-stroke"
            />

            {/* Playful twinkling sparkle at stroke completion */}
            <path
              d="M 64 45 L 65.2 47.5 L 67.5 48.5 L 65.2 49.5 L 64 52 L 62.8 49.5 L 60.5 48.5 L 62.8 47.5 Z"
              fill={activeDark ? '#2997ff' : '#0066cc'}
              className="animate-apple-sparkle"
            />
          </g>

          {/* Cute Apple Pencil */}
          <g className="animate-apple-pencil">
            <g transform="translate(23, 24) rotate(-38)">
              {/* Wooden hexagonal body */}
              <rect x="0" y="0" width="5.5" height="26" rx="1" fill="#f5c518" />
              <rect x="2" y="0" width="1.8" height="26" fill="#e5b80b" />
              {/* Silver ferrule ring */}
              <rect x="0" y="-3.5" width="5.5" height="3.5" fill="#d1d5db" />
              {/* Pink rounded eraser */}
              <rect x="0" y="-6.5" width="5.5" height="3" rx="1.5" fill="#f48fb1" />
              {/* Sharpened natural wood cone */}
              <polygon points="0,26 5.5,26 2.75,32" fill="#f3dfb9" />
              {/* Ink tip */}
              <polygon points="1.2,29.5 4.3,29.5 2.75,32" fill={activeDark ? '#2997ff' : '#0066cc'} />
            </g>
          </g>
        </svg>
      </div>

      {/* Typography & Micro-Dots Indicator */}
      <div className="mt-5 flex flex-col items-center text-center">
        <div className="flex items-center gap-2">
          <h2
            className={`text-[17px] font-semibold leading-[1.2] tracking-[-0.374px] ${
              activeDark ? 'text-[#f5f5f7]' : 'text-[#1d1d1f]'
            }`}
          >
            {title}
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
            {subtitle}
          </p>
        )}
      </div>
    </main>
  )
}

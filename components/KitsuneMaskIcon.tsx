import React from 'react'

export default function KitsuneMaskIcon({
  className = 'h-4 w-4',
  ...props
}: React.SVGProps<SVGSVGElement>) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      className={className}
      xmlns="http://www.w3.org/2000/svg"
      {...props}
    >
      {/* Soft Silhouette Fill */}
      <path
        d="M12 21.5c-3.2 0-7.5-4.2-7.5-9.8 0-3.3 1.3-6.4 1.7-7.7.2-.6.9-.9 1.4-.6L10.2 5c.6-.2 1.2-.3 1.8-.3s1.2.1 1.8.3l2.6-1.6c.5-.3 1.2 0 1.4.6.4 1.3 1.7 4.4 1.7 7.7 0 5.6-4.3 9.8-7.5 9.8z"
        fill="currentColor"
        fillOpacity="0.12"
      />
      {/* Outer Stroke Outline */}
      <path
        d="M12 21.5c-3.2 0-7.5-4.2-7.5-9.8 0-3.3 1.3-6.4 1.7-7.7.2-.6.9-.9 1.4-.6L10.2 5c.6-.2 1.2-.3 1.8-.3s1.2.1 1.8.3l2.6-1.6c.5-.3 1.2 0 1.4.6.4 1.3 1.7 4.4 1.7 7.7 0 5.6-4.3 9.8-7.5 9.8z"
        stroke="currentColor"
        strokeWidth="1.6"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      {/* Inner Ear Folds */}
      <path
        d="M7.4 6.8l2.2 2.3M16.6 6.8l-2.2 2.3"
        stroke="currentColor"
        strokeWidth="1.4"
        strokeLinecap="round"
      />
      {/* Slanted Kitsune Fox Eyes */}
      <path
        d="M7.6 12.8c1.2-.6 2.5-.2 2.7.2M16.4 12.8c-1.2-.6-2.5-.2-2.7.2"
        stroke="currentColor"
        strokeWidth="1.6"
        strokeLinecap="round"
      />
      {/* Forehead Kitsune Flame Mark */}
      <path
        d="M12 7.2v3.2M10.8 9.5c.7-.6 1.7-.6 2.4 0"
        stroke="currentColor"
        strokeWidth="1.4"
        strokeLinecap="round"
      />
      {/* Whiskers / Cheek Markings */}
      <path
        d="M5.8 14.8c1.2.2 2 .5 2.4.8M18.2 14.8c-1.2.2-2 .5-2.4.8"
        stroke="currentColor"
        strokeWidth="1.3"
        strokeLinecap="round"
      />
      {/* Fox Nose */}
      <circle cx="12" cy="17.2" r="0.9" fill="currentColor" />
    </svg>
  )
}

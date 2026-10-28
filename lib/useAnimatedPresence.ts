'use client'

import { useEffect, useState } from 'react'

export const MOTION_EXIT_MS = 180

export function getMotionDuration(duration: number): number {
  return typeof window !== 'undefined' && window.matchMedia?.('(prefers-reduced-motion: reduce)').matches
    ? 0
    : duration
}

/** Keep closing UI and its last content mounted until its exit animation finishes. */
export function useAnimatedPresence<T>(value: T, duration = MOTION_EXIT_MS) {
  const [retained, setRetained] = useState(value)

  // Synchronize during render so opening/replacing content never waits for an effect.
  if (value && retained !== value) setRetained(value)

  useEffect(() => {
    if (value || !retained) return
    const timer = window.setTimeout(() => setRetained(value), getMotionDuration(duration))
    return () => window.clearTimeout(timer)
  }, [duration, retained, value])

  return {
    isPresent: Boolean(value || retained),
    isExiting: !value && Boolean(retained),
    value: value || retained,
  }
}

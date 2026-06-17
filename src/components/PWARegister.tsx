'use client'
import { useEffect } from 'react'

export default function PWARegister() {
  useEffect(() => {
    if ('serviceWorker' in navigator) {
      navigator.serviceWorker.register('/sw.js').catch(() => {
        // Silently fail if registration doesn't work (e.g. dev mode)
      })
    }
  }, [])
  return null
}

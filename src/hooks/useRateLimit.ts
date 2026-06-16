'use client'

// Simple client-side rate limiter for login attempts
// Stores attempt count in sessionStorage
export function useLoginRateLimit() {
  const KEY = 'i8_login_attempts'
  const WINDOW = 15 * 60 * 1000 // 15 minutes
  const MAX    = 5                // max 5 attempts

  function check(): { allowed: boolean; remaining: number; waitMin: number } {
    try {
      const raw = sessionStorage.getItem(KEY)
      const data = raw ? JSON.parse(raw) : { count: 0, firstAt: Date.now() }
      const age  = Date.now() - data.firstAt

      // Reset window if expired
      if (age > WINDOW) {
        sessionStorage.setItem(KEY, JSON.stringify({ count: 0, firstAt: Date.now() }))
        return { allowed: true, remaining: MAX, waitMin: 0 }
      }

      if (data.count >= MAX) {
        const waitMin = Math.ceil((WINDOW - age) / 60000)
        return { allowed: false, remaining: 0, waitMin }
      }

      return { allowed: true, remaining: MAX - data.count, waitMin: 0 }
    } catch {
      return { allowed: true, remaining: MAX, waitMin: 0 }
    }
  }

  function record() {
    try {
      const raw = sessionStorage.getItem(KEY)
      const data = raw ? JSON.parse(raw) : { count: 0, firstAt: Date.now() }
      const age  = Date.now() - data.firstAt
      if (age > WINDOW) {
        sessionStorage.setItem(KEY, JSON.stringify({ count: 1, firstAt: Date.now() }))
      } else {
        sessionStorage.setItem(KEY, JSON.stringify({ ...data, count: data.count + 1 }))
      }
    } catch {}
  }

  function reset() {
    try { sessionStorage.removeItem(KEY) } catch {}
  }

  return { check, record, reset }
}

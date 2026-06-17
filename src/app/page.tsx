'use client'
import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { supabase } from '@/lib/supabase'
import LandingPage from './pages/LandingPage'

export default function RootPage() {
  const router = useRouter()
  const [checking, setChecking] = useState(true)

  useEffect(() => {
    // If already logged in, skip the landing and go straight to the app
    supabase.auth.getSession().then(({ data }) => {
      if (data.session?.user) {
        router.replace('/app')
      } else {
        setChecking(false)
      }
    })
  }, [router])

  if (checking) {
    return (
      <div style={{ position: 'fixed', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', background: '#06101e' }}>
        <div style={{ fontSize: '32px', animation: 'spin .8s linear infinite' }}>⚙️</div>
      </div>
    )
  }

  return <LandingPage onEnter={() => router.push('/app')} />
}

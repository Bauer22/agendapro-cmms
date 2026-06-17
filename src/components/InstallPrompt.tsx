'use client'
import { useEffect, useState } from 'react'

export default function InstallPrompt() {
  const [deferredPrompt, setDeferredPrompt] = useState<any>(null)
  const [show, setShow] = useState(false)
  const [isIOS, setIsIOS] = useState(false)

  useEffect(() => {
    // Detect iOS (Chrome's native prompt doesn't fire there)
    const ios = /iPad|iPhone|iPod/.test(navigator.userAgent) && !(window as any).MSStream
    setIsIOS(ios)

    // Don't show if already installed (standalone mode)
    const isStandalone = window.matchMedia('(display-mode: standalone)').matches || (navigator as any).standalone
    if (isStandalone) return

    // Don't show again if dismissed recently
    const dismissed = localStorage.getItem('i8_install_dismissed')
    if (dismissed && Date.now() - parseInt(dismissed) < 7 * 24 * 60 * 60 * 1000) return

    if (ios) {
      // iOS has no beforeinstallprompt — show custom instructions after a delay
      const t = setTimeout(() => setShow(true), 3000)
      return () => clearTimeout(t)
    }

    function handler(e: any) {
      e.preventDefault()
      setDeferredPrompt(e)
      setShow(true)
    }
    window.addEventListener('beforeinstallprompt', handler)
    return () => window.removeEventListener('beforeinstallprompt', handler)
  }, [])

  async function install() {
    if (deferredPrompt) {
      deferredPrompt.prompt()
      await deferredPrompt.userChoice
      setDeferredPrompt(null)
    }
    setShow(false)
  }

  function dismiss() {
    localStorage.setItem('i8_install_dismissed', String(Date.now()))
    setShow(false)
  }

  if (!show) return null

  return (
    <div style={{
      position: 'fixed', bottom: 'calc(16px + var(--sab))', left: '16px', right: '16px',
      zIndex: 200, background: 'rgba(8,16,32,.97)', border: '1px solid rgba(249,115,22,.35)',
      borderRadius: '16px', padding: '14px 16px', boxShadow: '0 8px 32px rgba(0,0,0,.5)',
      backdropFilter: 'blur(20px)', display: 'flex', alignItems: 'center', gap: '12px',
      fontFamily: "'Sora',system-ui,sans-serif",
    }}>
      <div style={{ width: '38px', height: '38px', borderRadius: '10px', background: 'linear-gradient(135deg,#f97316,#c85a00)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '18px', flexShrink: 0 }}>
        ⚙️
      </div>
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ fontSize: '12px', fontWeight: 700, color: '#e8edf5' }}>Instalar Industrial8</div>
        <div style={{ fontSize: '10px', color: '#8fa3bf', marginTop: '1px' }}>
          {isIOS
            ? 'Toque em Compartilhar ⬆ e "Adicionar à Tela de Início"'
            : 'Acesso rápido direto da tela inicial do celular'}
        </div>
      </div>
      {!isIOS && (
        <button onClick={install} style={{
          background: 'linear-gradient(135deg,#f97316,#c85a00)', color: '#fff', border: 'none',
          borderRadius: '10px', padding: '8px 14px', fontSize: '11px', fontWeight: 700,
          cursor: 'pointer', flexShrink: 0, fontFamily: "'Sora',system-ui",
        }}>
          Instalar
        </button>
      )}
      <button onClick={dismiss} style={{
        background: 'none', border: 'none', color: '#4a6380', fontSize: '16px',
        cursor: 'pointer', padding: '4px', flexShrink: 0,
      }}>×</button>
    </div>
  )
}

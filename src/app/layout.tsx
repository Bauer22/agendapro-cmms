import type { Metadata, Viewport } from 'next'
import './globals.css'
import { Toaster } from 'react-hot-toast'
import PWARegister from '@/components/PWARegister'
import InstallPrompt from '@/components/InstallPrompt'

export const metadata: Metadata = {
  title: 'Industrial8',
  description: 'Manutenção Industrial Inteligente',
  manifest: '/manifest.json',
  appleWebApp: {
    capable: true,
    statusBarStyle: 'black-translucent',
    title: 'Industrial8',
  },
  icons: {
    icon: [
      { url: '/icons/icon-192.png', sizes: '192x192', type: 'image/png' },
      { url: '/icons/icon-512.png', sizes: '512x512', type: 'image/png' },
    ],
    apple: [
      { url: '/icons/apple-touch-icon.png', sizes: '180x180', type: 'image/png' },
    ],
  },
}

export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
  viewportFit: 'cover',
  themeColor: '#06101e',
  userScalable: false,
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="pt-BR">
      <head>
        <link href="https://fonts.googleapis.com/css2?family=Bebas+Neue&family=Sora:wght@400;500;600;700&display=swap" rel="stylesheet" />
        <meta name="apple-mobile-web-app-capable" content="yes" />
        <meta name="apple-mobile-web-app-status-bar-style" content="black-translucent" />
        <meta name="mobile-web-app-capable" content="yes" />
      </head>
      <body>
        <PWARegister />
        <InstallPrompt />
        {children}
        <Toaster position="bottom-center" toastOptions={{
          style: {
            background: '#0c1a30', color: '#e2e8f0',
            border: '1px solid rgba(249,115,22,.3)',
            borderRadius: '16px',
            fontFamily: 'Sora,system-ui,sans-serif',
            fontSize: '13px'
          }
        }} />
      </body>
    </html>
  )
}

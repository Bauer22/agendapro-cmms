import type { Metadata } from 'next'
import './globals.css'
import { Toaster } from 'react-hot-toast'

export const metadata: Metadata = {
  title: 'Industrial8',
  description: 'Sistema de Gestão de Manutenção Industrial',
  manifest: '/manifest.json',
  themeColor: '#0c1628',
  viewport: 'width=device-width,initial-scale=1,viewport-fit=cover',
  appleWebApp: { capable: true, statusBarStyle: 'black-translucent', title: 'Industrial8' },
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="pt-BR">
      <head>
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link href="https://fonts.googleapis.com/css2?family=Bebas+Neue&family=Sora:wght@400;500;600;700&display=swap" rel="stylesheet" />
      </head>
      <body>
        {children}
        <Toaster position="bottom-center" toastOptions={{
          style: { background:'#111d33', color:'#e2e8f0', border:'1px solid #1e3a5f', borderRadius:'24px', fontFamily:'Sora,system-ui,sans-serif', fontSize:'13px' },
          success: { iconTheme:{ primary:'#10b981', secondary:'#060d1a' } },
          error:   { iconTheme:{ primary:'#ef4444', secondary:'#060d1a' } },
        }} />
      </body>
    </html>
  )
}

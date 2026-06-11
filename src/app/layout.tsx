import type { Metadata } from 'next'
import './globals.css'
import { Toaster } from 'react-hot-toast'
export const metadata: Metadata = {
  title: 'Industrial8',
  description: 'Manutenção Industrial Inteligente',
  themeColor: '#06101e',
  viewport: 'width=device-width,initial-scale=1,viewport-fit=cover',
}
export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="pt-BR">
      <head>
        <link href="https://fonts.googleapis.com/css2?family=Bebas+Neue&family=Sora:wght@400;500;600;700&display=swap" rel="stylesheet" />
      </head>
      <body>
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

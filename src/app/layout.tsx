import type { Metadata } from 'next'
import { Inter, JetBrains_Mono } from 'next/font/google'
import '../styles/globals.css'
import '../styles/button-fix.css'
import { QueryProvider } from '@/components/providers/query-provider'
import { ToastProvider } from '@/components/providers/toast-provider'
import { StudioTheme } from '@/components/providers/studio-theme'
import { TraderraProvider } from '@/contexts/TraderraContext'
import { GlobalTraderraProvider } from '@/components/global/GlobalTraderraProvider'
import { GuestModeProvider } from '@/contexts/GuestModeContext'
import { TradeUploadProvider } from '@/components/providers/trade-upload-provider'

const inter = Inter({
  subsets: ['latin'],
  variable: '--font-sans',
  display: 'swap',
})

const jetbrainsMono = JetBrains_Mono({
  subsets: ['latin'],
  variable: '--font-mono',
  display: 'swap',
})

export const metadata: Metadata = {
  title: 'Traderra — Find the Edge. Prove the Edge.',
  description: 'V31 equity scanning, vectorbt backtesting, SEC dilution intelligence, and professional charting',
  keywords: 'trading, journal, AI, performance, analysis, Renata',
  authors: [{ name: 'Traderra Team' }],
  creator: 'Traderra',
  publisher: 'Traderra',
  robots: {
    index: false,
    follow: false,
  },
  icons: {
    icon: '/favicon.ico',
    shortcut: '/favicon-16x16.png',
    apple: '/apple-touch-icon.png',
  },
  manifest: '/site.webmanifest',
  openGraph: {
    type: 'website',
    locale: 'en_US',
    url: 'https://traderra.com',
    siteName: 'Traderra',
    title: 'Traderra - Trading Strategy Platform',
    description: 'Professional trading journal and performance analysis platform powered by Renata AI',
  },
  twitter: {
    card: 'summary_large_image',
    title: 'Traderra — Find the Edge. Prove the Edge.',
    description: 'V31 equity scanning, vectorbt backtesting, SEC dilution intelligence',
  },
}

export const viewport = {
  width: 'device-width',
  initialScale: 1,
  maximumScale: 1,
  themeColor: [
    { media: '(prefers-color-scheme: light)', color: '#ffffff' },
    { media: '(prefers-color-scheme: dark)', color: '#0a0a0a' },
  ],
}

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <html lang="en" className="dark">
      <head>
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
      </head>
      <body className={`${inter.variable} ${jetbrainsMono.variable} font-mono antialiased studio-bg min-h-screen`} style={{ fontSize: 11 }}>
        <StudioTheme>
          <TraderraProvider>
            <GlobalTraderraProvider>
              <GuestModeProvider>
                <QueryProvider>
                  <TradeUploadProvider>
                    <ToastProvider />
                    {children}
                  </TradeUploadProvider>
                </QueryProvider>
              </GuestModeProvider>
            </GlobalTraderraProvider>
          </TraderraProvider>
        </StudioTheme>
      </body>
    </html>
  )
}

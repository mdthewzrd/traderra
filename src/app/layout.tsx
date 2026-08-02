import { TopNav } from '@/components/layout/top-nav'
import type { Metadata } from 'next'
import { Inter } from 'next/font/google'
import '../styles/globals.css'
import '../styles/button-fix.css'
import { QueryProvider } from '@/components/providers/query-provider'
import { ToastProvider } from '@/components/providers/toast-provider'
import { StudioTheme } from '@/components/providers/studio-theme'
import { TraderraProvider } from '@/contexts/TraderraContext'
import { GlobalTraderraProvider } from '@/components/global/GlobalTraderraProvider'
import { GuestModeProvider } from '@/contexts/GuestModeContext'
import { TradeUploadProvider } from '@/components/providers/trade-upload-provider'
import { RequestInbox } from '@/components/inbox/RequestInbox'
import { InboxPush } from '@/components/layout/inbox-push'
import { ApprovalGuard } from '@/components/layout/approval-guard'

const inter = Inter({
  subsets: ['latin'],
  variable: '--font-sans',
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
      <body className={`${inter.variable} font-sans antialiased studio-bg min-h-screen`} style={{ fontSize: 13 }}>
        <StudioTheme>
          <TraderraProvider>
            <TopNav />
            <GlobalTraderraProvider>
              <GuestModeProvider>
                <QueryProvider>
                  <TradeUploadProvider>
                    <ToastProvider />
                    <ApprovalGuard>
                      <InboxPush>{children}</InboxPush>
                      <RequestInbox />
                    </ApprovalGuard>
                  </TradeUploadProvider>
                </QueryProvider>
              </GuestModeProvider>
            </GlobalTraderraProvider>
          </TraderraProvider>
        </StudioTheme>
        <span className="fixed bottom-0.5 left-1 text-[9px] text-[#444] pointer-events-none select-none z-0" title="deployed build time — if this looks old, hard-refresh (Ctrl/Cmd+Shift+R)">
          build {new Date(process.env.NEXT_PUBLIC_BUILD_AT || 0).toISOString().slice(5, 19).replace('T', ' ')}Z
        </span>
      </body>
    </html>
  )
}

'use client'
import { usePathname } from 'next/navigation'
import { Footer } from '@/components/layout/footer'
import { AgentSystemInitializer } from '@/components/agents/AgentSystemInitializer'

/**
 * Main app layout — wraps journal/traderra pages with Footer + Agent system.
 * Renata AI sidebar removed on request (2026-07-15).
 * Backtest page (/backtest) hides the footer.
 */
export default function MainLayout({
  children,
}: {
  children: React.ReactNode
}) {
  const pathname = usePathname()
  const isBacktest = pathname.startsWith('/backtest')

  return (
    <>
      {!isBacktest && <AgentSystemInitializer />}
      <div className="relative flex min-h-screen flex-col">
        {children}
        {!isBacktest && <Footer />}
      </div>
    </>
  )
}

'use client'
import { usePathname } from 'next/navigation'
import { Footer } from '@/components/layout/footer'
import { RenataSidebar } from '@/components/layout/renata-sidebar'
import { AgentSystemInitializer } from '@/components/agents/AgentSystemInitializer'

/**
 * Main app layout — wraps pages with Footer, Renata AI sidebar, and Agent system.
 * Backtest page (/backtest) hides the Renata sidebar and footer.
 */
export default function MainLayout({
  children,
}: {
  children: React.ReactNode
}) {
  const pathname = usePathname()
  const isBacktest = pathname === '/backtest'

  return (
    <>
      {!isBacktest && <AgentSystemInitializer />}
      <div className="relative flex min-h-screen flex-col">
        {children}
        {!isBacktest && <Footer />}
      </div>
      {!isBacktest && <RenataSidebar />}
    </>
  )
}

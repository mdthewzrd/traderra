import { Footer } from '@/components/layout/footer'
import { RenataSidebar } from '@/components/layout/renata-sidebar'
import { AgentSystemInitializer } from '@/components/agents/AgentSystemInitializer'

/**
 * Main app layout — wraps pages with Footer, Renata AI sidebar, and Agent system.
 * Only routes inside the (main) route group get these.
 * Charts route is outside this group — no footer, no Renata.
 */
export default function MainLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <>
      <AgentSystemInitializer />
      <div className="relative flex min-h-screen flex-col">
        {children}
        <Footer />
      </div>
      <RenataSidebar />
    </>
  )
}

'use client'

import { useState, useEffect } from 'react'
import { usePathname } from 'next/navigation'
import { Brain, Github, Search, Radio, Gauge, Database, LineChart as LineChartIcon, FlaskConical, BookOpen, Droplets, TestTube, MessageCircle } from 'lucide-react'
import { cn } from '@/lib/utils'

// Edge-dev trading tools — the real daily-use nav.
const edgeTools = [
  { name: 'Scanner', href: '/scanner', icon: Search },
  { name: 'Live Scan', href: '/live-scan', icon: Radio },
  { name: 'Gap Stats', href: '/gap-stats', icon: Gauge },
  { name: 'Database', href: '/database', icon: Database },
  { name: 'Charts', href: '/charts', icon: LineChartIcon },
  { name: 'Backtest', href: '/backtest', icon: FlaskConical },
  { name: 'Playbook', href: '/playbook', icon: BookOpen },
  { name: 'Dilution', href: '/dilution', icon: Droplets },
  { name: 'Lab', href: '/lab', icon: TestTube },
]

// Routes that render their own nav via AppLayout (journal/traderra), or want none (auth/landing).
// TopNav (root-mounted) is hidden on these to avoid a double bar.
const HIDDEN_PREFIXES = ['/journal', '/trades', '/dashboard', '/calendar', '/statistics', '/stats', '/analytics', '/research', '/settings', '/daily-summary', '/sign-in', '/sign-up', '/auth']

function NavInner({ forceShow = false }: { forceShow?: boolean }) {
  const pathname = usePathname()
  // Render nothing during SSR / static collection (avoids pages-manifest crash).
  // Hydrates on client — same pattern RequestInbox uses safely in the root layout.
  const [mounted, setMounted] = useState(false)
  useEffect(() => setMounted(true), [])
  if (!mounted) return null
  if (!forceShow && (pathname === '/' || HIDDEN_PREFIXES.some(p => pathname === p || pathname.startsWith(p + '/')))) return null

  return (
    <nav className="h-14 bg-[#0a0a0a] border-b border-[#1a1a1a] flex items-center justify-between px-4 sticky top-0 z-40" style={{
      boxShadow: '0 4px 8px rgba(0, 0, 0, 0.25), 0 1px 0px rgba(255, 255, 255, 0.08) inset'
    }}>
      {/* Left side */}
      <div className="flex items-center gap-4">
        {/* Logo */}
        <a href="/" className="flex items-center gap-2">
          <div className="h-8 w-8 rounded-lg bg-primary/20 border border-primary/40 flex items-center justify-center">
            <Brain className="h-5 w-5 text-primary" />
          </div>
          <span className="text-lg font-bold text-primary">Traderra</span>
        </a>

        {/* Edge-dev tools — primary trading nav */}
        <div className="hidden md:flex items-center gap-0.5">
          {edgeTools.map((item) => {
            const isActive = pathname === item.href || pathname.startsWith(item.href + '/')
            return (
              <a
                key={item.name}
                href={item.href}
                className={cn(
                  'flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-sm font-medium transition-all whitespace-nowrap border',
                  isActive
                    ? 'bg-primary/20 text-primary border-primary/40'
                    : 'text-[#888] hover:text-primary hover:bg-[#161616] border-transparent'
                )}
              >
                <item.icon className="h-3.5 w-3.5" />
                {item.name}
              </a>
            )
          })}
        </div>

        {/* Divider */}
        <div className="w-px h-6 bg-[#1a1a1a] hidden lg:block" />

        {/* Journal — traderra subpages live inside /journal as a sub-nav */}
        <a
          href="/journal"
          className={cn(
            'hidden lg:flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-sm transition-colors',
            ['/journal', '/trades', '/dashboard', '/calendar', '/statistics', '/settings'].some(p => pathname.startsWith(p))
              ? 'bg-[#161616] text-[#ccc]'
              : 'text-[#555] hover:text-[#999] hover:bg-[#161616]'
          )}
        >
          Journal
        </a>
      </div>

      {/* Right side */}
      <div className="flex items-center gap-2">
        <button
          onClick={() => window.dispatchEvent(new CustomEvent('open-request-inbox'))}
          className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm font-semibold text-amber-300 bg-amber-500/10 border border-amber-500/30 hover:bg-amber-500/20 transition-all"
          title="Send to Renata"
        >
          <MessageCircle className="h-4 w-4" />
          <span className="hidden sm:inline">Renata</span>
        </button>
        <a
          href="https://github.com/mdthewzrd/traderra"
          target="_blank"
          className="flex items-center justify-center w-8 h-8 rounded bg-[#111] hover:bg-[#1a1a1a] border border-[#1a1a1a] hover:border-primary/40 transition-all group"
        >
          <Github className="h-4 w-4 text-[#555] group-hover:text-primary transition-colors" />
        </a>
        <div className="h-8 w-8 rounded-full bg-primary/20 border border-primary/40 flex items-center justify-center">
          <span className="text-xs font-bold text-primary">T</span>
        </div>
      </div>
    </nav>
  )
}

// Root-layout mounted — guarded (shows only on edge-dev tool pages).
export function TopNav() {
  return <NavInner />
}

// AppLayout-mounted (journal/traderra) — always shown there.
export function TopNavigation() {
  return <NavInner forceShow />
}

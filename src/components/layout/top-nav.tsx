'use client'

import { usePathname } from 'next/navigation'
import { Brain, Settings, TrendingUp, BarChart3, FileText, Calendar, Camera, Search, LineChart as LineChartIcon, FileSearch, Activity, Github } from 'lucide-react'
import { cn } from '@/lib/utils'

const platformTools = [
  { name: 'Scanner', href: '/scanner', icon: Search },
  { name: 'Backtest', href: '/backtest', icon: Activity },
  { name: 'Charts', href: '/charts-terminal.html', icon: LineChartIcon },
  { name: 'Research', href: '/research', icon: FileSearch },
]

const journalPages = [
  { name: 'Dashboard', href: '/dashboard', icon: BarChart3 },
  { name: 'Trades', href: '/trades', icon: TrendingUp },
  { name: 'Calendar', href: '/calendar', icon: Calendar },
  { name: 'Journal', href: '/journal', icon: FileText },
  { name: 'Stats', href: '/statistics', icon: BarChart3 },
  { name: 'Settings', href: '/settings', icon: Settings },
]

function NavInner() {
  const pathname = usePathname()

  return (
    <nav className="h-14 bg-[#0a0a0a] border-b border-[#1a1a1a] flex items-center justify-between px-4" style={{
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

        {/* Platform Tools — bold, gold when active */}
        <div className="hidden md:flex items-center gap-0.5">
          {platformTools.map((item) => {
            const isActive = pathname === item.href || pathname.startsWith(item.href + '/')
            return (
              <a
                key={item.name}
                href={item.href}
                className={cn(
                  'flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm font-bold transition-all',
                  isActive
                    ? 'bg-primary/20 text-primary border border-primary/40'
                    : 'text-[#888] hover:text-primary hover:bg-[#161616]'
                )}
              >
                <item.icon className="h-4 w-4" />
                {item.name}
              </a>
            )
          })}
        </div>

        {/* Divider */}
        <div className="w-px h-6 bg-[#1a1a1a] hidden md:block" />

        {/* Journal Pages — subtle */}
        <div className="hidden lg:flex items-center gap-0.5">
          {journalPages.map((item) => {
            const isActive = pathname === item.href
            return (
              <a
                key={item.name}
                href={item.href}
                className={cn(
                  'flex items-center gap-1 px-2 py-1 rounded-lg text-sm transition-colors',
                  isActive
                    ? 'bg-[#161616] text-[#ccc]'
                    : 'text-[#555] hover:text-[#999] hover:bg-[#161616]'
                )}
              >
                <item.icon className="h-3.5 w-3.5" />
                {item.name}
              </a>
            )
          })}
        </div>
      </div>

      {/* Right side */}
      <div className="flex items-center gap-2">
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

export function TopNav() {
  return <NavInner />
}

export function TopNavigation() {
  return <NavInner />
}

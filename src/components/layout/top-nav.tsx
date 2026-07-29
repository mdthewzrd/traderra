'use client'

import { useState, useEffect } from 'react'
import { usePathname } from 'next/navigation'
import {
  Brain, Github, ChevronDown, Menu, X,
  Search, Radio, Gauge, Database, LineChart as LineChartIcon,
  FlaskConical, BookOpen, Droplets, TestTube, MessageCircle,
  Calendar, BarChart3, NotebookPen, Settings as SettingsIcon,
} from 'lucide-react'
import { cn } from '@/lib/utils'
import { useChatContext } from '@/contexts/TraderraContext'
import { ApprovalBell } from '@/components/layout/approval-bell'

type IconType = typeof Brain

interface NavItem { name: string; href: string; icon: IconType }
interface NavGroupDef { name: string; items: NavItem[] }

// Grouped nav (shared by desktop + mobile).
// A top tab with items OPENS its dropdown and never navigates.
// Charts is standalone (clicks straight through).
// A group stays open when you're on one of its pages (active-open persistence).
const NAV_GROUPS: NavGroupDef[] = [
  {
    name: 'Traderra',
    items: [
      { name: 'Journal', href: '/journal', icon: NotebookPen },
      { name: 'Trades', href: '/trades', icon: BarChart3 },
      { name: 'Dashboard', href: '/dashboard', icon: Gauge },
      { name: 'Calendar', href: '/calendar', icon: Calendar },
      { name: 'Statistics', href: '/statistics', icon: BarChart3 },
    ],
  },
  {
    name: 'Edge Dev',
    items: [
      { name: 'Scanner', href: '/scanner', icon: Search },
      { name: 'Database', href: '/database', icon: Database },
      { name: 'Playbook', href: '/playbook', icon: BookOpen },
      { name: 'Lab', href: '/lab', icon: TestTube },
      { name: 'Backtest', href: '/backtest', icon: FlaskConical },
    ],
  },
  {
    name: 'Live',
    items: [
      { name: 'Live Scan', href: '/live-scan', icon: Radio },
      { name: 'Gap Stats', href: '/gap-stats', icon: Gauge },
      { name: 'Dilution', href: '/dilution', icon: Droplets },
      { name: 'Personality', href: '/personality', icon: Brain },
    ],
  },
]
const CHARTS_ITEM: NavItem = { name: 'Charts', href: '/charts', icon: LineChartIcon }
const SETTINGS_HREF = '/settings'

function isActive(pathname: string, href: string) {
  return pathname === href || pathname.startsWith(href + '/')
}

/** Desktop dropdown group — opens on hover/click; auto-opens on an active child. */
function NavGroupMenu({ group }: { group: NavGroupDef }) {
  const pathname = usePathname()
  const [clicked, setClicked] = useState(false)
  const [hovered, setHovered] = useState(false)
  const groupActive = group.items.some((i) => isActive(pathname, i.href))
  const open = clicked || hovered || groupActive

  return (
    <div
      className="relative"
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => { setHovered(false); setClicked(false) }}
    >
      <button
        type="button"
        onClick={() => setClicked((c) => !c)}
        className={cn(
          'flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-sm font-medium transition-all whitespace-nowrap border',
          groupActive
            ? 'bg-primary/20 text-primary border-primary/40'
            : 'text-[#888] hover:text-primary hover:bg-[#161616] border-transparent'
        )}
      >
        {group.name}
        <ChevronDown className={cn('h-3 w-3 transition-transform', open && 'rotate-180')} />
      </button>
      {open && (
        <div className="absolute left-0 top-full pt-1 min-w-[176px] z-50">
          <div className="bg-[#0f0f0f] border border-[#1f1f1f] rounded-lg shadow-xl py-1">
            {group.items.map((item) => {
              const a = isActive(pathname, item.href)
              return (
                <a
                  key={item.href}
                  href={item.href}
                  className={cn(
                    'flex items-center gap-2 px-3 py-1.5 text-sm transition-colors whitespace-nowrap',
                    a ? 'text-primary bg-primary/10' : 'text-[#999] hover:text-primary hover:bg-[#161616]'
                  )}
                >
                  <item.icon className="h-3.5 w-3.5" />
                  {item.name}
                </a>
              )
            })}
          </div>
        </div>
      )}
    </div>
  )
}

/** Mobile drawer — full nav tree, groups expandable. Replaces the vanishing nav (REQ-299). */
function MobileNav({ open, onClose }: { open: boolean; onClose: () => void }) {
  const pathname = usePathname()
  const [expanded, setExpanded] = useState<string | null>(null)
  useEffect(() => {
    const g = NAV_GROUPS.find((grp) => grp.items.some((i) => isActive(pathname, i.href)))
    setExpanded(g?.name ?? null)
  }, [pathname])

  if (!open) return null
  return (
    <div className="fixed inset-0 z-[60] md:hidden">
      <div className="absolute inset-0 bg-black/60" onClick={onClose} />
      <div className="absolute right-0 top-0 h-full w-[260px] max-w-[80vw] bg-[#0a0a0a] border-l border-[#1a1a1a] overflow-y-auto py-3 px-2">
        <div className="flex items-center justify-between px-2 mb-2">
          <span className="text-sm font-bold text-primary">Menu</span>
          <button onClick={onClose} className="p-1 text-[#888] hover:text-primary"><X className="h-5 w-5" /></button>
        </div>
        {NAV_GROUPS.map((group) => {
          const groupActive = group.items.some((i) => isActive(pathname, i.href))
          const isOpen = expanded === group.name
          return (
            <div key={group.name} className="mb-1">
              <button
                onClick={() => setExpanded(isOpen ? null : group.name)}
                className={cn('w-full flex items-center justify-between px-3 py-2 rounded-lg text-sm font-medium',
                  groupActive ? 'text-primary bg-primary/10' : 'text-[#bbb] hover:bg-[#161616]')}
              >
                {group.name}
                <ChevronDown className={cn('h-4 w-4 transition-transform', isOpen && 'rotate-180')} />
              </button>
              {isOpen && (
                <div className="pl-2 mt-0.5">
                  {group.items.map((item) => {
                    const a = isActive(pathname, item.href)
                    return (
                      <a key={item.href} href={item.href} onClick={onClose}
                        className={cn('flex items-center gap-2 px-3 py-2 rounded-lg text-sm',
                          a ? 'text-primary bg-primary/10' : 'text-[#999] hover:text-primary hover:bg-[#161616]')}>
                        <item.icon className="h-3.5 w-3.5" />{item.name}
                      </a>
                    )
                  })}
                </div>
              )}
            </div>
          )
        })}
        <a href={CHARTS_ITEM.href} onClick={onClose}
          className={cn('mt-1 flex items-center gap-2 px-3 py-2 rounded-lg text-sm font-medium',
            isActive(pathname, CHARTS_ITEM.href) ? 'text-primary bg-primary/10' : 'text-[#bbb] hover:bg-[#161616]')}>
          <CHARTS_ITEM.icon className="h-4 w-4" />{CHARTS_ITEM.name}
        </a>
        <a href={SETTINGS_HREF} onClick={onClose}
          className={cn('mt-1 flex items-center gap-2 px-3 py-2 rounded-lg text-sm font-medium',
            isActive(pathname, SETTINGS_HREF) ? 'text-primary bg-primary/10' : 'text-[#bbb] hover:bg-[#161616]')}>
          <SettingsIcon className="h-4 w-4" />Settings
        </a>
      </div>
    </div>
  )
}

// Global nav — mounted once in the root layout. Hidden only on landing + auth.
function NavInner() {
  const pathname = usePathname()
  const { isSidebarOpen } = useChatContext()
  const [mounted, setMounted] = useState(false)
  const [mobileOpen, setMobileOpen] = useState(false)
  useEffect(() => setMounted(true), [])
  const [activeGroup, setActiveGroup] = useState<string | null>(null)
  useEffect(() => {
    const g = NAV_GROUPS.find((grp) => grp.items.some((i) => isActive(pathname, i.href)))
    if (g) setActiveGroup(g.name)
  }, [pathname])
  if (!mounted) return null
  if (
    pathname === '/' ||
    pathname.startsWith('/sign-in') ||
    pathname.startsWith('/sign-up') ||
    pathname.startsWith('/auth')
  ) return null

  return (
    <>
      <nav className="h-14 bg-[#0a0a0a] border-b border-[#1a1a1a] flex items-center justify-between px-4 sticky top-0 z-40" style={{
        boxShadow: '0 4px 8px rgba(0, 0, 0, 0.25), 0 1px 0px rgba(255, 255, 255, 0.08) inset'
      }}>
        {/* Left side */}
        <div className="flex items-center gap-3">
          <a href="/" className="flex items-center gap-2">
            <div className="h-8 w-8 rounded-lg bg-primary/20 border border-primary/40 flex items-center justify-center">
              <Brain className="h-5 w-5 text-primary" />
            </div>
            <span className="text-lg font-bold text-primary">Traderra</span>
          </a>

          {/* Desktop main tabs: Traderra · Edge Dev · Charts(standalone) · Live.
              A group tab sets activeGroup (no navigation); Charts clicks through. */}
          <div className="hidden md:flex items-center gap-0.5">
            {NAV_GROUPS.map((group) => (
              <button key={group.name} type="button" onClick={() => setActiveGroup(group.name)}
                className={cn('flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-sm font-medium transition-all whitespace-nowrap border',
                  activeGroup === group.name ? 'bg-primary/20 text-primary border-primary/40' : 'text-[#888] hover:text-primary hover:bg-[#161616] border-transparent')}>
                {group.name}
              </button>
            ))}
            <a href={CHARTS_ITEM.href}
              className={cn('flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-sm font-medium transition-all whitespace-nowrap border',
                isActive(pathname, CHARTS_ITEM.href) ? 'bg-primary/20 text-primary border-primary/40' : 'text-[#888] hover:text-primary hover:bg-[#161616] border-transparent')}>
              <CHARTS_ITEM.icon className="h-3.5 w-3.5" />{CHARTS_ITEM.name}
            </a>
          </div>
        </div>

        {/* Right side */}
        <div className="flex items-center gap-2">
          <ApprovalBell />
          <a href={SETTINGS_HREF} title="Settings"
            className={cn('hidden sm:flex items-center justify-center w-8 h-8 rounded-lg border transition-all',
              isActive(pathname, SETTINGS_HREF) ? 'text-primary bg-primary/10 border-primary/40' : 'text-[#888] hover:text-primary hover:bg-[#161616] border-[#1a1a1a]')}>
            <SettingsIcon className="h-4 w-4" />
          </a>
          <button
            onClick={() => window.dispatchEvent(new CustomEvent(isSidebarOpen ? 'close-request-inbox' : 'open-request-inbox'))}
            className={cn("flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm font-semibold border transition-all",
              isSidebarOpen ? "text-[#0a0a0a] bg-amber-500 border-amber-500" : "text-amber-300 bg-amber-500/10 border-amber-500/30 hover:bg-amber-500/20")}
            title="Send to Renata">
            <MessageCircle className="h-4 w-4" />
            <span className="hidden sm:inline">Renata</span>
          </button>
          <a href="https://github.com/mdthewzrd/traderra" target="_blank"
            className="hidden sm:flex items-center justify-center w-8 h-8 rounded bg-[#111] hover:bg-[#1a1a1a] border border-[#1a1a1a] hover:border-primary/40 transition-all group">
            <Github className="h-4 w-4 text-[#555] group-hover:text-primary transition-colors" />
          </a>
          <div className="h-8 w-8 rounded-full bg-primary/20 border border-primary/40 flex items-center justify-center">
            <span className="text-xs font-bold text-primary">T</span>
          </div>
          {/* Mobile hamburger (REQ-299) */}
          <button onClick={() => setMobileOpen(true)} className="md:hidden flex items-center justify-center w-8 h-8 rounded-lg text-[#888] hover:text-primary hover:bg-[#161616]" title="Menu">
            <Menu className="h-5 w-5" />
          </button>
        </div>
      </nav>
      {/* Row 2: persistent sub-nav bar — the active group's children. */}
      {(() => {
        const ag = NAV_GROUPS.find((g) => g.name === activeGroup)
        if (!ag) return null
        return (
          <div className="hidden md:flex items-center gap-1 px-4 h-10 bg-[#0d0d0d] border-b border-[#1a1a1a] overflow-x-auto sticky top-14 z-30">
            {ag.items.map((item) => {
              const a = isActive(pathname, item.href)
              return (
                <a key={item.href} href={item.href}
                  className={cn('flex items-center gap-1.5 px-3 py-1 rounded-md text-sm whitespace-nowrap transition-colors',
                    a ? 'text-primary bg-primary/10' : 'text-[#999] hover:text-primary hover:bg-[#161616]')}>
                  <item.icon className="h-3.5 w-3.5" />{item.name}
                </a>
              )
            })}
          </div>
        )
      })()}
      <MobileNav open={mobileOpen} onClose={() => setMobileOpen(false)} />
    </>
  )
}

export function TopNav() {
  return <NavInner />
}

// Kept for backward compatibility — the nav is now unified (global).
export function TopNavigation() {
  return <NavInner />
}

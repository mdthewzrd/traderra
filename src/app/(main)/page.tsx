'use client'

import { Search, Activity, LineChart, FileSearch, TrendingUp, Brain, BarChart3, Calendar, FileText, ArrowRight } from 'lucide-react'

const tools = [
  {
    name: 'Scanner',
    href: '/scanner',
    icon: Search,
    description: 'V31 equity scanner — scan 16,000+ tickers for pattern setups',
    status: 'LIVE',
    color: 'text-green-400',
  },
  {
    name: 'Backtest',
    href: '/backtest',
    icon: Activity,
    description: 'Strategy builder with vectorbt engine, WFO validation, robustness scoring',
    status: 'BUILDING',
    color: 'text-yellow-400',
  },
  {
    name: 'Charts',
    href: '/charts',
    icon: LineChart,
    description: 'ProChart Terminal — multi-timeframe, drawing tools, backtest replay',
    status: 'LIVE',
    color: 'text-green-400',
  },
  {
    name: 'Research',
    href: '/research',
    icon: FileSearch,
    description: 'SEC dilution intelligence — 4-axis risk scoring, EdgarTools, shelf tracking',
    status: 'BUILDING',
    color: 'text-yellow-400',
  },
]

const existingPages = [
  { name: 'Dashboard', href: '/dashboard', icon: BarChart3 },
  { name: 'Trades', href: '/trades', icon: TrendingUp },
  { name: 'Journal', href: '/journal', icon: FileText },
  { name: 'Calendar', href: '/calendar', icon: Calendar },
  { name: 'Statistics', href: '/statistics', icon: BarChart3 },
]

export default function HomePage() {
  return (
    <div className="min-h-screen bg-[#0a0a0a]">
      {/* Header */}
      <header className="border-b border-[#1a1a1a] bg-[#0a0a0a]">
        <div className="max-w-[1800px] mx-auto px-6 py-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="h-10 w-10 rounded-lg bg-primary/20 border border-primary/40 flex items-center justify-center">
              <Brain className="h-6 w-6 text-primary" />
            </div>
            <div>
              <h1 className="text-xl font-bold text-primary">Traderra</h1>
              <p className="text-xs text-[#666]">Trading Strategy Platform</p>
            </div>
          </div>
          <nav className="flex items-center gap-1">
            {tools.map((t) => (
              <a
                key={t.name}
                href={t.href}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm font-medium text-[#999] hover:text-primary hover:bg-[#111] transition-colors"
              >
                <t.icon className="h-4 w-4" />
                {t.name}
              </a>
            ))}
            <div className="w-px h-5 bg-[#1a1a1a] mx-2" />
            {existingPages.slice(0, 3).map((p) => (
              <a
                key={p.name}
                href={p.href}
                className="flex items-center gap-1.5 px-2 py-1.5 rounded-lg text-sm text-[#666] hover:text-[#999] hover:bg-[#111] transition-colors"
              >
                <p.icon className="h-3.5 w-3.5" />
                {p.name}
              </a>
            ))}
          </nav>
        </div>
      </header>

      {/* Hero */}
      <section className="max-w-[1800px] mx-auto px-6 pt-16 pb-12">
        <div className="text-center max-w-3xl mx-auto">
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-primary/10 border border-primary/30 text-primary text-xs font-medium mb-6">
            <span className="h-1.5 w-1.5 rounded-full bg-green-400 animate-pulse" />
            Renata AI Agent Online
          </div>
          <h2 className="text-5xl font-bold text-[#e5e5e5] mb-4">
            Find the edge.<br />
            <span className="text-primary">Prove the edge.</span>
          </h2>
          <p className="text-lg text-[#666] mb-8">
            V31 equity scanning, vectorbt backtesting, SEC dilution intelligence, and professional charting — all in one platform.
          </p>
        </div>
      </section>

      {/* Tool Cards */}
      <section className="max-w-[1800px] mx-auto px-6 pb-16">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {tools.map((tool) => (
            <a
              key={tool.name}
              href={tool.href}
              className="group block bg-[#111] border border-[#1a1a1a] rounded-xl p-6 hover:border-primary/40 transition-all duration-300"
            >
              <div className="flex items-start justify-between mb-4">
                <div className="h-12 w-12 rounded-lg bg-primary/10 flex items-center justify-center">
                  <tool.icon className="h-6 w-6 text-primary" />
                </div>
                <span className={`text-xs font-medium ${tool.color} bg-current/10 px-2 py-0.5 rounded`}>
                  {tool.status}
                </span>
              </div>
              <h3 className="text-xl font-bold text-[#e5e5e5] mb-2 group-hover:text-primary transition-colors">
                {tool.name}
              </h3>
              <p className="text-sm text-[#666] mb-4">{tool.description}</p>
              <div className="flex items-center gap-1 text-primary text-sm font-medium">
                Open <ArrowRight className="h-3.5 w-3.5 group-hover:translate-x-1 transition-transform" />
              </div>
            </a>
          ))}
        </div>
      </section>

      {/* Quick Stats */}
      <section className="max-w-[1800px] mx-auto px-6 pb-16">
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          {[
            { label: 'Tickers Scanned', value: '16,416', sub: 'US Equities' },
            { label: 'Pipeline Speed', value: '360×', sub: 'vs per-ticker' },
            { label: 'Data Points', value: '8.4M', sub: 'rows per scan' },
            { label: 'API Cost', value: '$0', sub: 'EdgarTools free' },
          ].map((stat) => (
            <div key={stat.label} className="bg-[#111] border border-[#1a1a1a] rounded-lg p-4 text-center">
              <div className="text-2xl font-bold text-primary">{stat.value}</div>
              <div className="text-xs text-[#666] mt-1">{stat.label}</div>
              <div className="text-xs text-[#444]">{stat.sub}</div>
            </div>
          ))}
        </div>
      </section>

      {/* Existing Pages */}
      <section className="max-w-[1800px] mx-auto px-6 pb-16">
        <h3 className="text-sm font-medium text-[#666] uppercase tracking-wider mb-4">Trading Journal</h3>
        <div className="flex gap-2">
          {existingPages.map((page) => (
            <a
              key={page.name}
              href={page.href}
              className="flex items-center gap-2 px-4 py-2 bg-[#111] border border-[#1a1a1a] rounded-lg text-sm text-[#999] hover:text-primary hover:border-primary/30 transition-colors"
            >
              <page.icon className="h-4 w-4" />
              {page.name}
            </a>
          ))}
        </div>
      </section>

      {/* Footer */}
      <footer className="border-t border-[#1a1a1a] py-6 text-center text-xs text-[#444]">
        Traderra — Powered by Renata AI · V31 Pipeline · EdgarTools · vectorbt · Polygon.io
      </footer>
    </div>
  )
}

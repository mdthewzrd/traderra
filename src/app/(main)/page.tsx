'use client'

import { Search, FlaskConical, LineChart, FileText, Brain, ArrowRight, Radio } from 'lucide-react'

const headerNav = [
  { name: 'Scanner', href: '/scanner', icon: Search },
  { name: 'Live Scan', href: '/live-scan', icon: Radio },
  { name: 'Charts', href: '/charts', icon: LineChart },
  { name: 'Journal', href: '/journal', icon: FileText },
]

const cards = [
  {
    title: 'Find new edge',
    href: '/scanner',
    icon: Search,
    description: 'Scan 16,000+ tickers for pattern setups, plus live market intel — gap stats, dilution, personality.',
  },
  {
    title: 'Dial in your edge',
    href: '/playbook',
    icon: FlaskConical,
    description: 'Build, validate & store your playbook. Scans and backtests run through wzrd.pi workflows + REQ — your edge, versioned and reproducible.',
  },
  {
    title: 'See it',
    href: '/charts',
    icon: LineChart,
    description: 'ProChart Terminal — multi-timeframe, drawing tools, backtest replay.',
  },
  {
    title: 'Review & execute',
    href: '/journal',
    icon: FileText,
    description: 'Journal, trades, dashboard, calendar & stats — your daily loop, logged and refined.',
  },
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
              <p className="text-xs text-[#666]">Agentic Trading Playbook</p>
            </div>
          </div>
          <nav className="flex items-center gap-1">
            {headerNav.map((t) => (
              <a
                key={t.name}
                href={t.href}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm font-medium text-[#999] hover:text-primary hover:bg-[#111] transition-colors"
              >
                <t.icon className="h-4 w-4" />
                {t.name}
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
            Renata online — powered by wzrd.pi
          </div>
          <h2 className="text-5xl font-bold text-[#e5e5e5] mb-4">
            Your <span className="text-primary">agentic trading playbook.</span>
          </h2>
          <p className="text-lg text-[#666] mb-8">
            Traderra fuses the wzrd.pi agentic framework with your trading playbook — with Renata, a fully custom agent that works beside you to dial in your edge, find new edge, and review + execute, day to day.
          </p>
        </div>
      </section>

      {/* Value-Prop Cards */}
      <section className="max-w-[1800px] mx-auto px-6 pb-16">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {cards.map((card) => (
            <a
              key={card.title}
              href={card.href}
              className="group block bg-[#111] border border-[#1a1a1a] rounded-xl p-6 hover:border-primary/40 transition-all duration-300"
            >
              <div className="h-12 w-12 rounded-lg bg-primary/10 flex items-center justify-center mb-4">
                <card.icon className="h-6 w-6 text-primary" />
              </div>
              <h3 className="text-xl font-bold text-[#e5e5e5] mb-2 group-hover:text-primary transition-colors">
                {card.title}
              </h3>
              <p className="text-sm text-[#666] mb-4">{card.description}</p>
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

      {/* Footer */}
      <footer className="border-t border-[#1a1a1a] py-6 text-center text-xs text-[#444]">
        Traderra — your agentic trading playbook · powered by wzrd.pi + Renata · EdgarTools · Polygon.io
      </footer>
    </div>
  )
}

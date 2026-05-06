'use client'

import { useState } from 'react'
import { AppLayout } from '@/components/layout/app-layout'
import { FileSearch, Search, Loader2, AlertTriangle, TrendingDown, DollarSign, BarChart3 } from 'lucide-react'

interface RiskScore { label: string; value: string | null; color: string; icon: React.ElementType }

export default function ResearchPage() {
  const [ticker, setTicker] = useState('')
  const [loading, setLoading] = useState(false)
  const [riskScores, setRiskScores] = useState<RiskScore[]>([])
  const [filings, setFilings] = useState<unknown[]>([])
  const [error, setError] = useState('')

  const analyze = async () => {
    if (!ticker.trim()) return
    setLoading(true)
    setError('')
    setRiskScores([])
    setFilings([])
    try {
      const res = await fetch(`/api/research?ticker=${ticker.toUpperCase()}`)
      const data = await res.json()
      if (data.error) { setError(data.error); return }
      setRiskScores([
        { label: 'Overall', value: data.risk_scores?.overall, color: 'text-red-400', icon: AlertTriangle },
        { label: 'Offering Ability', value: data.risk_scores?.offering_ability, color: 'text-yellow-400', icon: DollarSign },
        { label: 'Cash Need', value: data.risk_scores?.cash_need, color: 'text-orange-400', icon: TrendingDown },
        { label: 'Float Risk', value: data.risk_scores?.float_risk, color: 'text-purple-400', icon: BarChart3 },
      ])
      setFilings(data.filings || [])
      if (data.message) setError(data.message)
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Network error')
    } finally {
      setLoading(false)
    }
  }

  return (
    <AppLayout>
    <div className="p-4 space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="text-lg font-bold studio-text flex items-center gap-2">
          <FileSearch className="h-5 w-5 text-primary" />
          SEC Dilution Research
        </h1>
        <span className="text-xs studio-muted">EdgarTools · 424B/S-1/S-3/8-K · Free</span>
      </div>

      {/* Lookup */}
      <div className="flex gap-2 max-w-md">
        <input type="text" value={ticker} onChange={e => setTicker(e.target.value)}
          onKeyDown={e => e.key === 'Enter' && analyze()}
          placeholder="Ticker (e.g. DNA)"
          className="flex-1 bg-[#0a0a0a] border border-[#1a1a1a] rounded-lg px-3 py-2 studio-text text-sm uppercase focus:border-primary focus:outline-none" />
        <button onClick={analyze} disabled={loading || !ticker.trim()}
          className="bg-primary hover:bg-primary/90 disabled:opacity-50 text-primary-foreground font-bold py-2 px-4 rounded-lg text-sm flex items-center gap-2 transition-colors">
          {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Search className="h-4 w-4" />}
          Analyze
        </button>
      </div>

      {/* Risk Scores */}
      {riskScores.length > 0 && (
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
          {riskScores.map(score => (
            <div key={score.label} className="bg-[#111] border border-[#1a1a1a] rounded-lg p-4">
              <div className="flex items-center gap-2 mb-2">
                <score.icon className={`h-4 w-4 ${score.color}`} />
                <span className="text-[10px] studio-muted uppercase tracking-wider">{score.label}</span>
              </div>
              <div className={`text-2xl font-bold ${score.value ? score.color : 'text-gray-600'}`}>
                {score.value ?? '—'}
              </div>
              <div className="text-[9px] studio-muted mt-1">
                {score.value ? `${score.label} risk score` : 'Requires EdgarTools connection'}
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Info message */}
      {error && !riskScores.length && (
        <div className="bg-yellow-900/20 border border-yellow-800/40 rounded-lg p-3 text-yellow-400 text-sm">{error}</div>
      )}

      {/* Filings + Instruments */}
      {ticker && riskScores.length > 0 && (
        <div className="grid grid-cols-2 gap-3">
          <div className="bg-[#111] border border-[#1a1a1a] rounded-lg p-3">
            <div className="text-[10px] studio-muted uppercase tracking-wider mb-3">Recent SEC Filings</div>
            {filings.length > 0 ? (
              <table className="w-full text-xs">
                <thead><tr className="text-[10px] studio-muted">
                  <th className="text-left pb-2">Type</th><th className="text-left pb-2">Date</th><th className="text-left pb-2">Details</th>
                </tr></thead>
                <tbody>{/* populated when API wired */}</tbody>
              </table>
            ) : (
              <div className="text-center py-6 studio-muted text-xs">Connect EdgarTools SDK to see filings</div>
            )}
          </div>
          <div className="bg-[#111] border border-[#1a1a1a] rounded-lg p-3">
            <div className="text-[10px] studio-muted uppercase tracking-wider mb-3">Active Instruments</div>
            <div className="space-y-2">
              {['Shelf Registration', 'ATM Offering', 'Warrants Outstanding', 'Convertible Notes'].map(inst => (
                <div key={inst} className="flex items-center justify-between bg-[#0a0a0a] rounded px-3 py-2">
                  <span className="text-xs studio-text">{inst}</span>
                  <span className="text-[10px] text-gray-600">—</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* Empty state */}
      {!ticker && !loading && (
        <div className="bg-[#111] border border-[#1a1a1a] rounded-lg p-8 text-center">
          <FileSearch className="h-10 w-10 mx-auto studio-muted opacity-30 mb-3" />
          <p className="studio-text font-medium text-sm">Enter a ticker to analyze dilution risk</p>
          <p className="studio-muted text-xs mt-1">424B, S-1, S-3, 8-K filings · Insider trades · Shelf registrations</p>
        </div>
      )}
    </div>
    </AppLayout>
  )
}

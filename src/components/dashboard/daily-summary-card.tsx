'use client'

import { useState, useRef } from 'react'
import { Download, Share, Camera, Twitter, MessageSquare, Copy, Check } from 'lucide-react'
import html2canvas from 'html2canvas'
import { cn } from '@/lib/utils'
import { usePnLMode } from '@/contexts/TraderraContext'
import { getRMultipleValue } from '@/utils/trade-statistics'

interface DailySummaryCardProps {
  date: string
  trades: Array<{
    id: string
    symbol: string
    side: 'Long' | 'Short'
    pnl: number
    rMultiple?: number
    quantity: number
    entryPrice: number
    exitPrice: number
    strategy: string
  }>
  accountSize: number
  startingBalance: number
  endingBalance: number
}

type CropRatio = '1:1' | '4:5' | '9:16'

interface CropDimensions {
  width: number
  height: number
}

const cropDimensions: Record<CropRatio, CropDimensions> = {
  '1:1': { width: 720, height: 720 },
  '4:5': { width: 720, height: 900 },
  '9:16': { width: 720, height: 1280 }
}

export function DailySummaryCard({
  date,
  trades,
  accountSize,
  startingBalance,
  endingBalance
}: DailySummaryCardProps) {
  const [cropRatio, setCropRatio] = useState<CropRatio>('4:5')
  const [isExporting, setIsExporting] = useState(false)
  const [copied, setCopied] = useState(false)
  const { pnlMode } = usePnLMode()
  const cardRef = useRef<HTMLDivElement>(null)

  // Calculate metrics
  const totalPnL = trades.reduce((sum, trade) => sum + trade.pnl, 0)
  const winningTrades = trades.filter(trade => trade.pnl > 0)
  const losingTrades = trades.filter(trade => trade.pnl < 0)
  const winRate = trades.length > 0 ? (winningTrades.length / trades.length) * 100 : 0
  const avgWin = winningTrades.length > 0 ? winningTrades.reduce((sum, trade) => sum + trade.pnl, 0) / winningTrades.length : 0
  const avgLoss = losingTrades.length > 0 ? Math.abs(losingTrades.reduce((sum, trade) => sum + trade.pnl, 0) / losingTrades.length) : 0
  const profitFactor = losingTrades.length === 0 && winningTrades.length > 0 ? Infinity : avgLoss > 0 ? (avgWin * winningTrades.length) / (avgLoss * losingTrades.length) : 0
  const dailyReturn = startingBalance > 0 ? (totalPnL / startingBalance) * 100 : 0
  const totalRisk = trades.reduce((sum, trade) => {
    const rMultiple = getRMultipleValue(trade, pnlMode)
    return sum + (rMultiple ? Math.abs(trade.pnl / rMultiple) : 0)
  }, 0)
  const avgRMultiple = trades.length > 0 ? trades.reduce((sum, trade) => sum + getRMultipleValue(trade, pnlMode), 0) / trades.length : 0
  const totalR = trades.reduce((sum, trade) => sum + getRMultipleValue(trade, pnlMode), 0)

  // Dynamic layout calculations based on crop ratio and content
  const getTradeCount = () => {
    switch(cropRatio) {
      case '1:1': return Math.min(trades.length, 4)
      case '4:5': return Math.min(trades.length, 3)
      case '9:16': return Math.min(trades.length, 5)
      default: return Math.min(trades.length, 3)
    }
  }

  const getScaling = () => {
    // Fixed, independent scaling for each format
    if (cropRatio === '1:1') {
      return {
        headerSize: 'text-sm',
        headerSpacing: 'mb-2',
        pnlSize: 'text-2xl',
        pnlSpacing: 'mb-2',
        statsText: 'text-xs',
        statsGrid: 'gap-2',
        statsPadding: 'p-2',
        tradeSize: 'text-xs',
        spacing: 'space-y-2',
        tradeSpacing: 'space-y-0.5',
        padding: 'p-2',
        footerPadding: 'pt-1'
      }
    }

    if (cropRatio === '9:16') {
      return {
        headerSize: 'text-2xl',
        headerSpacing: 'mb-8',
        pnlSize: 'text-5xl',
        pnlSpacing: 'mb-6',
        statsText: 'text-lg',
        statsGrid: 'gap-4',
        statsPadding: 'p-4',
        tradeSize: 'text-sm',
        spacing: 'space-y-8',
        tradeSpacing: 'space-y-2',
        padding: 'pt-8 px-5 pb-5',
        footerPadding: 'pt-4'
      }
    }

    // Default 4:5 ratio
    return {
      headerSize: 'text-xl',
      headerSpacing: 'mb-6',
      pnlSize: 'text-4xl',
      pnlSpacing: 'mb-4',
      statsText: 'text-lg',
      statsGrid: 'gap-4',
      statsPadding: 'p-4',
      tradeSize: 'text-base',
      spacing: 'space-y-6',
      tradeSpacing: 'space-y-2',
      padding: 'pt-8 px-6 pb-6',
      footerPadding: 'pt-4'
    }
  }

  const scaling = getScaling()
  const maxTrades = getTradeCount()

  const formatDate = (dateStr: string) => {
    return new Date(dateStr).toLocaleDateString('en-US', {
      weekday: 'long',
      year: 'numeric',
      month: 'long',
      day: 'numeric'
    })
  }

  const exportAsImage = async () => {
    if (!cardRef.current) return

    setIsExporting(true)
    try {
      const canvas = await html2canvas(cardRef.current, {
        backgroundColor: '#0a0a0a',
        scale: 2,
        useCORS: true,
        allowTaint: true,
        width: cropDimensions[cropRatio].width,
        height: cropDimensions[cropRatio].height,
      })

      const link = document.createElement('a')
      link.download = `traderra-daily-summary-${date}.png`
      link.href = canvas.toDataURL()
      link.click()
    } catch (error) {
      console.error('Export failed:', error)
    } finally {
      setIsExporting(false)
    }
  }

  const shareToTwitter = () => {
    const text = `📊 Daily Trading Summary - ${formatDate(date)}

💰 P&L: ${totalPnL >= 0 ? '+' : ''}$${totalPnL.toFixed(2)}
📈 Win Rate: ${winRate.toFixed(1)}%
🎯 Avg R-Multiple: ${avgRMultiple.toFixed(2)}R
📱 Trades: ${trades.length}

#Trading #DayTrading #TradingResults #Traderra`

    const url = `https://twitter.com/intent/tweet?text=${encodeURIComponent(text)}`
    window.open(url, '_blank')
  }

  const shareToDiscord = () => {
    // Copy formatted message to clipboard for Discord
    const message = `**📊 Daily Trading Summary - ${formatDate(date)}**

💰 **P&L:** ${totalPnL >= 0 ? '+' : ''}$${totalPnL.toFixed(2)}
📈 **Win Rate:** ${winRate.toFixed(1)}%
🎯 **Avg R-Multiple:** ${avgRMultiple.toFixed(2)}R
📱 **Trades:** ${trades.length}

*Powered by Traderra - Professional Trading Analytics*`

    navigator.clipboard.writeText(message).then(() => {
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    })
  }

  const dimensions = cropDimensions[cropRatio]

  return (
    <div className="space-y-4">
      {/* Controls */}
      <div className="flex items-center justify-between p-4 studio-surface rounded-lg">
        <div>
          <h3 className="text-lg font-semibold studio-text">Daily Summary</h3>
          <p className="text-sm studio-muted">Export and share your trading results</p>
        </div>
        <div className="flex items-center space-x-2">
          {/* Crop Ratio Selection */}
          <div className="flex items-center space-x-1 mr-4">
            <span className="text-sm studio-muted mr-2">Format:</span>
            {(['1:1', '4:5', '9:16'] as CropRatio[]).map((ratio) => (
              <button
                key={ratio}
                onClick={() => setCropRatio(ratio)}
                className={cn(
                  'px-3 py-1 text-xs font-medium rounded transition-colors',
                  cropRatio === ratio
                    ? 'bg-primary text-white'
                    : 'studio-surface studio-border studio-text hover:bg-[#161616]'
                )}
              >
                {ratio}
              </button>
            ))}
          </div>

          {/* Action Buttons */}
          <button
            onClick={exportAsImage}
            disabled={isExporting}
            className="btn-ghost flex items-center space-x-2"
          >
            <Download className="h-4 w-4" />
            <span>{isExporting ? 'Exporting...' : 'Download'}</span>
          </button>

          <button
            onClick={shareToTwitter}
            className="btn-ghost flex items-center space-x-2 text-blue-400 hover:text-blue-300"
          >
            <Twitter className="h-4 w-4" />
            <span>Tweet</span>
          </button>

          <button
            onClick={shareToDiscord}
            className="btn-ghost flex items-center space-x-2 text-indigo-400 hover:text-indigo-300"
          >
            {copied ? <Check className="h-4 w-4" /> : <MessageSquare className="h-4 w-4" />}
            <span>{copied ? 'Copied!' : 'Discord'}</span>
          </button>
        </div>
      </div>

      {/* Summary Card */}
      <div className="flex justify-center">
        <div
          ref={cardRef}
          className="relative overflow-hidden"
          style={{
            width: `${dimensions.width}px`,
            height: `${dimensions.height}px`,
            maxWidth: '100%',
            aspectRatio: `${dimensions.width}/${dimensions.height}`
          }}
        >
        <div className={`w-full h-full bg-gradient-to-br from-[#0a0a0a] via-[#111111] to-[#0f0f0f] ${scaling.padding} flex flex-col relative overflow-hidden border border-gray-800/50 shadow-2xl`}>
          {/* Enhanced Decorative Background Elements */}
          <div className="absolute top-0 right-0 w-40 h-40 bg-gradient-to-br from-primary/30 via-primary/20 to-transparent rounded-full blur-3xl animate-pulse"></div>
          <div className="absolute bottom-0 left-0 w-48 h-48 bg-gradient-to-tr from-blue-500/15 via-purple-500/10 to-transparent rounded-full blur-3xl"></div>
          <div className="absolute top-1/2 left-1/2 transform -translate-x-1/2 -translate-y-1/2 w-32 h-32 bg-gradient-to-br from-green-400/10 to-transparent rounded-full blur-2xl"></div>

          {/* Subtle grid overlay */}
          <div className="absolute inset-0 opacity-5" style={{
            backgroundImage: `linear-gradient(rgba(255,255,255,0.1) 1px, transparent 1px),
                              linear-gradient(90deg, rgba(255,255,255,0.1) 1px, transparent 1px)`,
            backgroundSize: '20px 20px'
          }}></div>

          {/* Header */}
          <div className={`text-center ${scaling.headerSpacing} relative z-10`}>
            <div className="mb-8">
              <h1 className={`${cropRatio === '1:1' ? 'text-2xl' : cropRatio === '4:5' ? 'text-3xl' : 'text-4xl'} font-black bg-gradient-to-r from-white via-gray-200 to-gray-300 bg-clip-text text-transparent mb-4 tracking-tight drop-shadow-lg`}>Traderra</h1>
              <div className={`inline-block ${cropRatio === '1:1' ? 'px-4 py-2' : cropRatio === '4:5' ? 'px-6 py-3' : 'px-8 py-4'} bg-gradient-to-r from-primary/25 via-primary/20 to-blue-500/25 rounded-3xl border border-primary/40 shadow-2xl shadow-primary/20 backdrop-blur-sm`}>
                <h2 className={`${cropRatio === '1:1' ? 'text-base' : cropRatio === '4:5' ? 'text-lg' : 'text-xl'} font-bold text-white tracking-wide`}>Daily Trading Summary</h2>
                <div className="absolute inset-0 rounded-3xl bg-gradient-to-r from-primary/10 to-blue-500/10 blur-sm"></div>
              </div>
            </div>
            <p className={`${cropRatio === '1:1' ? 'text-xs mt-2' : cropRatio === '4:5' ? 'text-sm mt-3' : 'text-base mt-4'} text-gray-300 font-semibold tracking-wide`}>{formatDate(date)}</p>
          </div>

          {/* Main Metrics - Expanded Section */}
          <div className={`${scaling.spacing} flex-1`}>
            {/* P&L Section */}
            <div className="text-center relative">
              <div className="text-sm text-gray-400 mb-4 uppercase tracking-widest font-semibold">Daily P&L</div>
              <div className={cn(
                `${scaling.pnlSize} font-black ${scaling.pnlSpacing} tracking-tight relative`,
                totalPnL >= 0 ? 'text-green-400 drop-shadow-[0_0_12px_rgba(34,197,94,0.4)]' : 'text-red-400 drop-shadow-[0_0_12px_rgba(239,68,68,0.4)]'
              )}>
                <div className="absolute inset-0 blur-sm opacity-30">
                  {totalPnL >= 0 ? '+' : ''}${totalPnL.toFixed(2)}
                </div>
                <div className="relative z-10">
                  {totalPnL >= 0 ? '+' : ''}${totalPnL.toFixed(2)}
                </div>
              </div>
              <div className={cn(
                `${cropRatio === '1:1' ? 'text-lg' : cropRatio === '4:5' ? 'text-xl' : 'text-2xl'} font-bold ${cropRatio === '1:1' ? 'px-4 py-2' : cropRatio === '4:5' ? 'px-5 py-2' : 'px-6 py-3'} rounded-2xl inline-block border-2 shadow-lg backdrop-blur-sm`,
                totalR >= 0
                  ? 'text-green-300 bg-green-400/20 border-green-400/50 shadow-green-400/20'
                  : 'text-red-300 bg-red-400/20 border-red-400/50 shadow-red-400/20'
              )}>
                {totalR >= 0 ? '+' : ''}{totalR.toFixed(2)}R
              </div>
            </div>

            {/* Stats Grid */}
            <div className={`grid grid-cols-2 ${scaling.statsGrid}`}>
              <div className={`text-center ${scaling.statsPadding} bg-gradient-to-br from-white/10 via-white/5 to-transparent rounded-xl border border-white/20 backdrop-blur-sm shadow-lg hover:shadow-xl transition-all duration-300 hover:scale-105`}>
                <div className="text-xs text-gray-300 uppercase tracking-widest font-semibold mb-2">Trades</div>
                <div className={`${scaling.statsText} font-black text-white drop-shadow-lg`}>{trades.length}</div>
              </div>
              <div className={`text-center ${scaling.statsPadding} bg-gradient-to-br from-white/10 via-white/5 to-transparent rounded-xl border border-white/20 backdrop-blur-sm shadow-lg hover:shadow-xl transition-all duration-300 hover:scale-105`}>
                <div className="text-xs text-gray-300 uppercase tracking-widest font-semibold mb-2">Win Rate</div>
                <div className={`${scaling.statsText} font-black text-white drop-shadow-lg`}>{winRate.toFixed(1)}%</div>
              </div>
              <div className={`text-center ${scaling.statsPadding} bg-gradient-to-br from-white/10 via-white/5 to-transparent rounded-xl border border-white/20 backdrop-blur-sm shadow-lg hover:shadow-xl transition-all duration-300 hover:scale-105`}>
                <div className="text-xs text-gray-300 uppercase tracking-widest font-semibold mb-2">Avg R-Multiple</div>
                <div className={cn(
                  `${scaling.statsText} font-black drop-shadow-lg`,
                  avgRMultiple >= 0 ? 'text-green-300' : 'text-red-300'
                )}>
                  {avgRMultiple >= 0 ? '+' : ''}{avgRMultiple.toFixed(2)}R
                </div>
              </div>
              <div className={`text-center ${scaling.statsPadding} bg-gradient-to-br from-white/10 via-white/5 to-transparent rounded-xl border border-white/20 backdrop-blur-sm shadow-lg hover:shadow-xl transition-all duration-300 hover:scale-105`}>
                <div className="text-xs text-gray-300 uppercase tracking-widest font-semibold mb-2">Profit Factor</div>
                <div className={`${scaling.statsText} font-black text-white drop-shadow-lg`}>
                  {profitFactor === Infinity ? '∞' : profitFactor.toFixed(2)}
                </div>
              </div>
            </div>
          </div>

          {/* Trade List - Anchored above footer */}
          {trades.length > 0 && (
            <div className="space-y-4">
              <div className="text-sm text-gray-300 text-center font-semibold uppercase tracking-wider">Trades</div>
              <div className={scaling.tradeSpacing}>
                {trades
                  .sort((a, b) => Math.abs(b.pnl) - Math.abs(a.pnl))
                  .slice(0, maxTrades)
                  .map((trade, index) => (
                    <div key={trade.id} className={`${cropRatio === '1:1' ? 'px-4 py-3' : cropRatio === '4:5' ? 'px-5 py-4' : 'px-6 py-5'} bg-white/5 rounded-xl border border-white/10 backdrop-blur-sm hover:bg-white/10 transition-all duration-200`}>
                      <div className="flex items-center justify-between">
                        <div className="flex items-center space-x-4">
                          <span className={`font-bold text-white ${cropRatio === '1:1' ? 'text-lg' : cropRatio === '4:5' ? 'text-xl' : 'text-2xl'}`}>{trade.symbol}</span>
                          <span className={cn(
                            `${cropRatio === '1:1' ? 'text-sm' : 'text-base'} px-3 py-1 rounded-full font-semibold`,
                            trade.side === 'Long'
                              ? 'bg-blue-500/20 text-blue-300'
                              : 'bg-red-500/20 text-red-300'
                          )}>
                            {trade.side}
                          </span>
                          <span className={`${cropRatio === '1:1' ? 'text-sm' : 'text-lg'} text-gray-300 font-semibold`}>{trade.strategy}</span>
                        </div>
                        <div className="flex items-center space-x-6">
                          <span className={cn(
                            `font-bold ${cropRatio === '1:1' ? 'text-lg' : cropRatio === '4:5' ? 'text-xl' : 'text-2xl'}`,
                            trade.pnl >= 0 ? 'text-green-300' : 'text-red-300'
                          )}>
                            {trade.pnl >= 0 ? '+' : ''}${trade.pnl.toFixed(2)}
                          </span>
                          <span className={cn(
                            `font-bold ${cropRatio === '1:1' ? 'text-base' : cropRatio === '4:5' ? 'text-lg' : 'text-xl'}`,
                            getRMultipleValue(trade, pnlMode) >= 0 ? 'text-green-400' : 'text-red-400'
                          )}>
                            {getRMultipleValue(trade, pnlMode) >= 0 ? '+' : ''}{getRMultipleValue(trade, pnlMode).toFixed(2)}R
                          </span>
                        </div>
                      </div>
                    </div>
                  ))}
              </div>
            </div>
          )}

          {/* Footer */}
          <div className={`text-center ${scaling.footerPadding} border-t border-gray-600/30 relative z-10`}>
            <div className={`${cropRatio === '1:1' ? 'text-xs mb-1' : 'text-sm mb-3'} text-gray-300 font-semibold tracking-wide`}>
              Powered by <span className="font-bold bg-gradient-to-r from-yellow-400 via-yellow-500 to-amber-500 bg-clip-text text-transparent">Traderra</span> - Agentic Trading Journal
            </div>
            <div className={`${cropRatio === '1:1' ? 'text-xs' : 'text-xs'} text-gray-400 font-medium tracking-wider`}>
              traderra.com
            </div>
          </div>
        </div>
        </div>
      </div>
    </div>
  )
}
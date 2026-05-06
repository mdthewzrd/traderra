'use client'

import React, { useState, useEffect } from 'react'
import {
  Calculator,
  TrendingUp,
  TrendingDown,
  DollarSign,
  Percent,
  Target,
  AlertTriangle,
  Edit3,
  Trash2,
  Copy,
  PlayCircle,
  RefreshCw,
} from 'lucide-react'
import { cn } from '@/lib/utils'

export interface CalculationFormula {
  id: string
  name: string
  description: string
  formula: string
  variables: Record<string, number>
  result?: number
  resultFormat: 'currency' | 'percentage' | 'number' | 'ratio'
  category: 'risk' | 'profit' | 'position' | 'analysis'
}

interface CalculationBlockProps {
  calculation: CalculationFormula
  editable?: boolean
  onEdit?: (calculation: CalculationFormula) => void
  onDelete?: (id: string) => void
  onDuplicate?: (calculation: CalculationFormula) => void
  className?: string
}

// Predefined calculation templates
export const calculationTemplates: CalculationFormula[] = [
  {
    id: 'position-size',
    name: 'Position Size',
    description: 'Calculate optimal position size based on risk management',
    formula: '(accountSize * riskPercentage) / (entryPrice - stopLoss)',
    variables: {
      accountSize: 10000,
      riskPercentage: 0.02, // 2%
      entryPrice: 100,
      stopLoss: 95,
    },
    resultFormat: 'number',
    category: 'position',
  },
  {
    id: 'risk-reward',
    name: 'Risk-Reward Ratio',
    description: 'Calculate the risk-reward ratio for a trade',
    formula: '(takeProfit - entryPrice) / (entryPrice - stopLoss)',
    variables: {
      entryPrice: 100,
      takeProfit: 110,
      stopLoss: 95,
    },
    resultFormat: 'ratio',
    category: 'risk',
  },
  {
    id: 'pnl-calculation',
    name: 'P&L Calculation',
    description: 'Calculate profit and loss for a position',
    formula: '(exitPrice - entryPrice) * quantity - commission',
    variables: {
      exitPrice: 105,
      entryPrice: 100,
      quantity: 100,
      commission: 5,
    },
    resultFormat: 'currency',
    category: 'profit',
  },
  {
    id: 'win-rate',
    name: 'Win Rate',
    description: 'Calculate trading win rate percentage',
    formula: '(winningTrades / totalTrades) * 100',
    variables: {
      winningTrades: 65,
      totalTrades: 100,
    },
    resultFormat: 'percentage',
    category: 'analysis',
  },
  {
    id: 'sharpe-ratio',
    name: 'Sharpe Ratio',
    description: 'Risk-adjusted return metric',
    formula: '(averageReturn - riskFreeRate) / standardDeviation',
    variables: {
      averageReturn: 0.12, // 12%
      riskFreeRate: 0.03, // 3%
      standardDeviation: 0.15, // 15%
    },
    resultFormat: 'number',
    category: 'analysis',
  },
]

export function CalculationBlock({
  calculation,
  editable = false,
  onEdit,
  onDelete,
  onDuplicate,
  className,
}: CalculationBlockProps) {
  const [result, setResult] = useState<number | null>(null)
  const [isCalculating, setIsCalculating] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [localVariables, setLocalVariables] = useState(calculation.variables)

  const {
    id,
    name,
    description,
    formula,
    resultFormat,
    category,
  } = calculation

  // Calculate result
  const calculateResult = () => {
    setIsCalculating(true)
    setError(null)

    try {
      // Replace variables in formula with actual values
      let processedFormula = formula
      Object.entries(localVariables).forEach(([key, value]) => {
        processedFormula = processedFormula.replace(new RegExp(key, 'g'), value.toString())
      })

      // Evaluate the formula (in a real app, use a safer math parser)
      const result = Function(`"use strict"; return (${processedFormula})`)()

      if (isNaN(result) || !isFinite(result)) {
        throw new Error('Invalid calculation result')
      }

      setResult(result)
    } catch (err) {
      setError('Error in calculation formula')
      console.error('Calculation error:', err)
    } finally {
      setIsCalculating(false)
    }
  }

  // Auto-calculate on variable change
  useEffect(() => {
    calculateResult()
  }, [localVariables, formula])

  // Format result based on type
  const formatResult = (value: number) => {
    switch (resultFormat) {
      case 'currency':
        return new Intl.NumberFormat('en-US', {
          style: 'currency',
          currency: 'USD',
        }).format(value)
      case 'percentage':
        return `${value.toFixed(2)}%`
      case 'ratio':
        return `1:${value.toFixed(2)}`
      case 'number':
        return value.toFixed(4)
      default:
        return value.toString()
    }
  }

  // Get category styling
  const getCategoryStyle = () => {
    switch (category) {
      case 'risk':
        return {
          color: 'text-red-500',
          bg: 'bg-red-500/10',
          icon: AlertTriangle,
        }
      case 'profit':
        return {
          color: 'text-green-500',
          bg: 'bg-green-500/10',
          icon: TrendingUp,
        }
      case 'position':
        return {
          color: 'text-blue-500',
          bg: 'bg-blue-500/10',
          icon: Target,
        }
      case 'analysis':
        return {
          color: 'text-purple-500',
          bg: 'bg-purple-500/10',
          icon: TrendingDown,
        }
      default:
        return {
          color: 'text-muted-foreground',
          bg: 'bg-muted/10',
          icon: Calculator,
        }
    }
  }

  const categoryStyle = getCategoryStyle()

  // Handle variable change
  const handleVariableChange = (key: string, value: string) => {
    const numValue = parseFloat(value) || 0
    setLocalVariables(prev => ({
      ...prev,
      [key]: numValue,
    }))
  }

  return (
    <div className={cn(
      'studio-surface border border-studio-border rounded-lg overflow-hidden',
      'transition-all duration-200 hover:shadow-studio-lg',
      className
    )}>
      {/* Header */}
      <div className="flex items-center justify-between p-4 border-b border-studio-border">
        <div className="flex items-center gap-3">
          <div className={cn('p-2 rounded-lg', categoryStyle.bg)}>
            <categoryStyle.icon className={cn('w-5 h-5', categoryStyle.color)} />
          </div>
          <div>
            <h3 className="font-semibold text-lg">{name}</h3>
            <p className="text-sm text-muted-foreground">{description}</p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={calculateResult}
            disabled={isCalculating}
            className="p-2 rounded-lg hover:bg-accent transition-colors disabled:opacity-50"
            title="Recalculate"
          >
            <RefreshCw className={cn('w-4 h-4', isCalculating && 'animate-spin')} />
          </button>

          {editable && (
            <>
              <button
                onClick={() => onEdit?.(calculation)}
                className="p-2 rounded-lg hover:bg-accent transition-colors"
                title="Edit calculation"
              >
                <Edit3 className="w-4 h-4" />
              </button>

              <button
                onClick={() => onDuplicate?.(calculation)}
                className="p-2 rounded-lg hover:bg-accent transition-colors"
                title="Duplicate calculation"
              >
                <Copy className="w-4 h-4" />
              </button>

              <button
                onClick={() => onDelete?.(id)}
                className="p-2 rounded-lg hover:bg-destructive/10 hover:text-destructive transition-colors"
                title="Delete calculation"
              >
                <Trash2 className="w-4 h-4" />
              </button>
            </>
          )}
        </div>
      </div>

      {/* Formula Display */}
      <div className="p-4 border-b border-studio-border">
        <div className="text-sm font-medium text-muted-foreground mb-2">Formula</div>
        <div className="font-mono text-sm bg-muted/30 rounded-lg p-3 border">
          {formula}
        </div>
      </div>

      {/* Variables */}
      <div className="p-4 border-b border-studio-border">
        <div className="text-sm font-medium text-muted-foreground mb-3">Variables</div>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          {Object.entries(localVariables).map(([key, value]) => (
            <div key={key} className="flex items-center gap-3">
              <label className="text-sm font-medium min-w-0 flex-1 capitalize">
                {key.replace(/([A-Z])/g, ' $1').toLowerCase()}
              </label>
              <input
                type="number"
                value={value}
                onChange={(e) => handleVariableChange(key, e.target.value)}
                step="any"
                className="w-24 px-2 py-1 text-sm border border-border rounded bg-background focus:outline-none focus:ring-2 focus:ring-ring"
                disabled={!editable}
              />
            </div>
          ))}
        </div>
      </div>

      {/* Result */}
      <div className="p-4">
        <div className="flex items-center justify-between">
          <div className="text-sm font-medium text-muted-foreground">Result</div>
          {isCalculating && (
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <RefreshCw className="w-3 h-3 animate-spin" />
              <span>Calculating...</span>
            </div>
          )}
        </div>

        <div className="mt-2">
          {error ? (
            <div className="flex items-center gap-2 p-3 bg-destructive/10 border border-destructive/20 rounded-lg">
              <AlertTriangle className="w-4 h-4 text-destructive" />
              <span className="text-sm text-destructive">{error}</span>
            </div>
          ) : result !== null ? (
            <div className={cn(
              'p-4 rounded-lg border',
              categoryStyle.bg,
              'border-current/20'
            )}>
              <div className={cn('text-2xl font-bold', categoryStyle.color)}>
                {formatResult(result)}
              </div>
              {resultFormat === 'ratio' && result > 0 && (
                <div className="text-sm text-muted-foreground mt-1">
                  {result >= 2 ? 'Good' : result >= 1.5 ? 'Acceptable' : 'Poor'} risk-reward ratio
                </div>
              )}
            </div>
          ) : (
            <div className="p-4 bg-muted/30 rounded-lg text-center text-muted-foreground">
              Click calculate to see result
            </div>
          )}
        </div>
      </div>

      {/* Category Badge */}
      <div className="absolute top-4 right-4">
        <span className={cn(
          'px-2 py-1 rounded-full text-xs font-medium',
          categoryStyle.bg,
          categoryStyle.color
        )}>
          {category.charAt(0).toUpperCase() + category.slice(1)}
        </span>
      </div>
    </div>
  )
}
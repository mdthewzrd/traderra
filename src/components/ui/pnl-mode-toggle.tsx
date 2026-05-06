'use client'

import { useState } from 'react'
import { cn } from '@/lib/utils'
import { usePnLMode } from '@/contexts/TraderraContext'
import { useComponentRegistry } from '@/lib/ag-ui/component-registry'

interface PnLModeToggleProps {
  className?: string
}

export function PnLModeToggle({ className }: PnLModeToggleProps) {
  const { pnlMode, setPnLMode, isGrossPnL, isNetPnL } = usePnLMode()
  const [forceUpdate, setForceUpdate] = useState(0)

  // Register P&L mode component with AG-UI registry
  useComponentRegistry('pnl-mode', {
    setState: (state) => {
      console.log('🎯 PnLModeToggle received state change:', state)
      if (state === 'gross' || state === 'net') {
        console.log('🎯 PnLModeToggle setting mode to:', state)
        // Force a re-render by updating state
        setForceUpdate(prev => prev + 1)
        // Use setTimeout to ensure the state update happens after the current render cycle
        setTimeout(() => {
          setPnLMode(state)
        }, 0)
      }
    }
  })

  return (
    <div className={cn('flex items-center gap-1', className)} id="pnl-mode-toggle-container">
      {/* Gross P&L button */}
      <button
        key="gross"
        id="pnl-mode-gross-button"
        onClick={() => setPnLMode('gross')}
        className={cn(
          'px-3 py-1.5 text-sm font-medium rounded transition-all duration-200',
          isGrossPnL
            ? 'bg-[#B8860B] text-black shadow-lg'
            : 'text-gray-400 hover:text-gray-200 hover:bg-gray-700/50'
        )}
        title="Gross P&L (before commissions)"
        data-agui-component="pnl-mode-toggle"
        data-agui-action="set-mode"
        data-agui-value="gross"
        data-testid="pnl-mode-gross"
      >
        G
      </button>

      {/* Net P&L button */}
      <button
        key="net"
        id="pnl-mode-net-button"
        onClick={() => setPnLMode('net')}
        className={cn(
          'px-3 py-1.5 text-sm font-medium rounded transition-all duration-200',
          isNetPnL
            ? 'bg-[#B8860B] text-black shadow-lg'
            : 'text-gray-400 hover:text-gray-200 hover:bg-gray-700/50'
        )}
        title="Net P&L (after commissions)"
        data-agui-component="pnl-mode-toggle"
        data-agui-action="set-mode"
        data-agui-value="net"
        data-testid="pnl-mode-net"
      >
        N
      </button>
    </div>
  )
}
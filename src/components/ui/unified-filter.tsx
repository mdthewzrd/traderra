'use client'

import React from 'react'
import { cn } from '@/lib/utils'

// Standard unified filter that should be used across all pages
interface UnifiedFilterProps {
  // Time period filter
  selectedPeriod?: string
  onPeriodChange?: (period: string) => void

  // Performance display mode filter (for dashboard/analytics pages)
  showDisplayMode?: boolean
  selectedDisplayMode?: string
  onDisplayModeChange?: (mode: string) => void

  className?: string
}

export function UnifiedFilter({
  selectedPeriod = '30d',
  onPeriodChange,
  showDisplayMode = false,
  selectedDisplayMode = '$',
  onDisplayModeChange,
  className = ''
}: UnifiedFilterProps) {
  // Force recompile - ensuring All button is visible
  // Standard time periods: 7d, 30d, 90d, All
  const timePeriods = [
    { id: '7d', label: '7d' },
    { id: '30d', label: '30d' },
    { id: '90d', label: '90d' },
    { id: 'all', label: 'All' }
  ]

  // Performance display modes: $, R
  const displayModes = [
    { id: '$', label: '$' },
    { id: 'R', label: 'R' }
  ]

  return (
    <div className={cn("flex items-center space-x-3", className)}>
      {/* Time Period Filter */}
      <div className="flex items-center space-x-1 bg-[#1a1a1a] rounded-lg p-1">
        {timePeriods.map((period) => (
          <button
            key={period.id}
            onClick={() => onPeriodChange?.(period.id)}
            className={cn(
              'px-3 py-1.5 rounded-md text-sm font-medium transition-colors',
              selectedPeriod === period.id
                ? 'bg-[#B8860B] text-black' // Gold color for active state to match design
                : 'text-gray-400 hover:bg-[#2a2a2a] hover:text-white'
            )}
          >
            {period.label}
          </button>
        ))}
      </div>

      {/* Performance Display Mode Filter (if enabled) */}
      {showDisplayMode && (
        <div className="flex items-center space-x-1 bg-[#1a1a1a] rounded-lg p-1">
          {displayModes.map((mode) => (
            <button
              key={mode.id}
              onClick={() => onDisplayModeChange?.(mode.id)}
              className={cn(
                'px-3 py-1.5 rounded-md text-sm font-medium transition-colors',
                selectedDisplayMode === mode.id
                  ? 'bg-[#B8860B] text-black' // Gold color for active state to match design
                  : 'text-gray-400 hover:bg-[#2a2a2a] hover:text-white'
              )}
            >
              {mode.label}
            </button>
          ))}
        </div>
      )}
    </div>
  )
}
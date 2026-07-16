'use client'

import { DollarSign, Target } from 'lucide-react'
import { cn } from '@/lib/utils'
import { useDisplayMode, DisplayMode } from '@/contexts/TraderraContext'
import { useComponentRegistry } from '@/lib/ag-ui/component-registry'

interface DisplayModeToggleProps {
  className?: string
  size?: 'sm' | 'md' | 'lg'
  variant?: 'default' | 'compact' | 'icon-only' | 'flat'
  showLabels?: boolean
}

const sizeClasses = {
  sm: { container: 'p-0.5', button: 'px-2 py-1 text-xs', icon: 'h-3 w-3' },
  md: { container: 'p-1', button: 'px-3 py-1 text-sm', icon: 'h-4 w-4' },
  lg: { container: 'p-1.5', button: 'px-4 py-2 text-base', icon: 'h-5 w-5' },
}

const modes: Array<{ value: DisplayMode; label: string; icon: React.ComponentType<any>; shortLabel: string }> = [
  { value: 'dollar', label: 'Dollar', icon: DollarSign, shortLabel: '$' },
  { value: 'r', label: 'Risk Multiple', icon: Target, shortLabel: 'R' },
]

export function DisplayModeToggle({
  className,
  size = 'md',
  variant = 'default',
  showLabels = false,
}: DisplayModeToggleProps) {
  const { displayMode, setDisplayMode } = useDisplayMode()
  const sizes = sizeClasses[size]

  // Register with AG-UI registry — call setDisplayMode directly (no hacks).
  useComponentRegistry('display-mode', {
    setState: (state: string) => {
      if (state === 'dollar' || state === 'r') setDisplayMode(state as DisplayMode)
    },
  })

  // icon-only variant
  if (variant === 'icon-only') {
    return (
      <div className={cn('flex items-center space-x-1', className)}>
        {modes.map((mode) => {
          const Icon = mode.icon
          const isActive = displayMode === mode.value
          return (
            <button
              key={mode.value}
              onClick={() => setDisplayMode(mode.value)}
              className={cn(
                'rounded transition-colors',
                sizes.button,
                isActive ? 'bg-[#B8860B] text-black' : 'text-gray-400 hover:text-gray-200 hover:bg-gray-800'
              )}
              title={mode.label}
              aria-label={`Switch to ${mode.label} display mode`}
            >
              <Icon className={sizes.icon} />
            </button>
          )
        })}
      </div>
    )
  }

  // compact variant
  if (variant === 'compact') {
    return (
      <div className={cn('flex items-center bg-gray-800 rounded-lg', sizes.container, className)}>
        {modes.map((mode) => (
          <button
            key={mode.value}
            onClick={() => setDisplayMode(mode.value)}
            className={cn(
              'font-medium rounded transition-colors',
              sizes.button,
              displayMode === mode.value ? 'bg-[#B8860B] text-black' : 'text-gray-400 hover:text-gray-200'
            )}
            aria-label={`Switch to ${mode.label} display mode`}
          >
            {mode.shortLabel}
          </button>
        ))}
      </div>
    )
  }

  // flat variant (used by CalendarRow) + default — clean, no DOM manipulation
  return (
    <div className={cn('flex items-center gap-1', className)} data-testid="display-mode-toggle">
      {modes.map((mode) => {
        const isActive = displayMode === mode.value
        const Icon = mode.icon
        return (
          <button
            key={mode.value}
            onClick={() => setDisplayMode(mode.value)}
            className={cn(
              'px-3 py-1.5 text-sm font-medium rounded transition-colors',
              isActive
                ? 'bg-[#B8860B] text-black'
                : 'text-gray-400 hover:text-gray-200 hover:bg-gray-700/50'
            )}
            title={mode.label}
            aria-label={`Switch to ${mode.label} display mode`}
            data-testid={`display-mode-${mode.value}`}
            data-active={isActive.toString()}
          >
            {showLabels ? (
              <span className="flex items-center gap-1">
                <Icon className="h-3.5 w-3.5" />
                {mode.shortLabel}
              </span>
            ) : (
              mode.shortLabel
            )}
          </button>
        )
      })}
    </div>
  )
}

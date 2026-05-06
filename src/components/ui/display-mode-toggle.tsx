'use client'

import { useState, useEffect } from 'react'
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
  sm: {
    container: 'p-0.5',
    button: 'px-2 py-1 text-xs',
    icon: 'h-3 w-3',
  },
  md: {
    container: 'p-1',
    button: 'px-3 py-1 text-sm',
    icon: 'h-4 w-4',
  },
  lg: {
    container: 'p-1.5',
    button: 'px-4 py-2 text-base',
    icon: 'h-5 w-5',
  },
}

export function DisplayModeToggle({
  className,
  size = 'md',
  variant = 'default',
  showLabels = false,
}: DisplayModeToggleProps) {
  const { displayMode, setDisplayMode } = useDisplayMode()
  const sizes = sizeClasses[size]
  const [isMounted, setIsMounted] = useState(false)
  const [forceUpdate, setForceUpdate] = useState(0)

  // Register display mode component with AG-UI registry
  useComponentRegistry('display-mode', {
    setState: (state) => {
      console.log('🎯 DisplayModeToggle received state change:', state)
      if (state === 'dollar' || state === 'r') {
        console.log('🎯 DisplayModeToggle setting displayMode to:', state)
        // Force a re-render by updating state
        setForceUpdate(prev => prev + 1)
        // Use setTimeout to ensure the state update happens after the current render cycle
        setTimeout(() => {
          setDisplayMode(state as DisplayMode)
        }, 0)
      }
    }
  })

  // CRITICAL: Debug logging to check if component receives context updates
  useEffect(() => {
    console.log('🎯 DisplayModeToggle: Component re-rendered with displayMode:', displayMode, 'forceUpdate:', forceUpdate)
  }, [displayMode, forceUpdate])

  // CRITICAL: Listen for AG UI tool events (displayModeChange custom event)
  useEffect(() => {
    const handleDisplayModeChange = (event: Event) => {
      const customEvent = event as CustomEvent<{ mode: string }>
      console.log('🎯 DisplayModeToggle received displayModeChange event:', customEvent.detail.mode)
      if (customEvent.detail.mode === 'dollar' || customEvent.detail.mode === 'r_multiple') {
        const modeValue = customEvent.detail.mode === 'r_multiple' ? 'r' : 'dollar'
        console.log('🎯 DisplayModeToggle setting mode from AG UI event to:', modeValue)
        setForceUpdate(prev => prev + 1)
        setTimeout(() => {
          setDisplayMode(modeValue)
        }, 0)
      }
    }

    window.addEventListener('displayModeChange', handleDisplayModeChange)
    return () => {
      window.removeEventListener('displayModeChange', handleDisplayModeChange)
    }
  }, [setDisplayMode])

  // Prevent hydration mismatch
  useEffect(() => {
    setIsMounted(true)
  }, [])

  const modes: Array<{
    value: DisplayMode
    label: string
    icon: React.ComponentType<any>
    shortLabel: string
  }> = [
    { value: 'dollar', label: 'Dollar', icon: DollarSign, shortLabel: '$' },
    { value: 'r', label: 'Risk Multiple', icon: Target, shortLabel: 'R' },
  ]

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
                isActive
                  ? 'bg-yellow-500 text-black'
                  : 'text-gray-400 hover:text-gray-200 hover:bg-gray-800'
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

  if (variant === 'compact') {
    return (
      <div className={cn(
        'flex items-center bg-gray-800 rounded-lg',
        sizes.container,
        className
      )}>
        {modes.map((mode) => (
          <button
            key={mode.value}
            onClick={() => setDisplayMode(mode.value)}
            className={cn(
              'font-medium rounded transition-colors',
              sizes.button,
              displayMode === mode.value
                ? 'bg-yellow-500 text-black'
                : 'text-gray-400 hover:text-gray-200'
            )}
            aria-label={`Switch to ${mode.label} display mode`}
          >
            {mode.shortLabel}
          </button>
        ))}
      </div>
    )
  }

  if (variant === 'flat') {
    console.log('🎯 DisplayModeToggle flat rendering with displayMode:', displayMode)

    return (
      <div
        className={cn('flex items-center gap-1', className)}
        data-testid="display-mode-toggle"
        id="display-mode-toggle-container"
      >
        {modes.map((mode) => {
          // CRITICAL: Simple, reliable mode matching
          const isActiveMode = displayMode === mode.value
          const isRiskMode = mode.value === 'r'
          const isDollarMode = mode.value === 'dollar'

          console.log(`🎯 FLAT Button ${mode.shortLabel}: displayMode="${displayMode}", mode.value="${mode.value}", isActive=${isActiveMode}`)

          return (
            <button
              key={mode.value}
              onClick={(e) => {
                console.log(`🔧 FLAT Clicking ${mode.shortLabel} button, setting displayMode to: "${mode.value}"`)
                e.preventDefault()
                e.stopPropagation()

                // ENHANCED: Immediate visual feedback before context update
                const currentButton = e.currentTarget
                currentButton.style.backgroundColor = '#B8860B'
                currentButton.style.color = '#000000'
                currentButton.style.border = '2px solid #B8860B'

                // ENHANCED: Clear other button states immediately
                const allButtons = Array.from(document.querySelectorAll('button'))
                allButtons.forEach(btn => {
                  if (btn !== currentButton && (btn.textContent?.trim() === 'R' || btn.textContent?.trim() === '$')) {
                    btn.style.backgroundColor = ''
                    btn.style.color = ''
                    btn.style.border = '2px solid transparent'
                  }
                })

                setDisplayMode(mode.value)
              }}
              className={cn(
                'px-3 py-1.5 text-sm font-medium rounded transition-all duration-200',
                isActiveMode
                  ? 'bg-[#B8860B] text-black shadow-lg'
                  : 'text-gray-400 hover:text-gray-200 hover:bg-gray-700/50'
              )}
              style={{
                // ENHANCED: More aggressive inline styling to force correct display
                backgroundColor: isActiveMode ? '#B8860B' : '',
                color: isActiveMode ? '#000000' : '',
                border: isActiveMode ? '2px solid #B8860B' : '2px solid transparent',
                // ADDITIONAL: Force specificity with important
                boxShadow: isActiveMode ? '0 4px 6px -1px rgba(0, 0, 0, 0.1), 0 2px 4px -1px rgba(0, 0, 0, 0.06)' : 'none',
              }}
              aria-label={`Switch to ${mode.label} display mode`}
              data-testid={`display-mode-${mode.value}`}
              data-active={isActiveMode.toString()}
              data-display-mode={displayMode}
              data-mode-value={mode.value}
              data-button-type={isRiskMode ? 'risk' : isDollarMode ? 'dollar' : 'other'}
              // CRITICAL: Unique IDs for AG UI to find the correct buttons
              id={mode.value === 'r' ? 'display-mode-r-button' : mode.value === 'dollar' ? 'display-mode-dollar-button' : undefined}
              // CRITICAL: AG UI specific attributes
              data-agui-component="display-mode-toggle"
              data-agui-action="set-mode"
              data-agui-value={mode.value}
            >
              {mode.shortLabel}
            </button>
          )
        })}
      </div>
    )
  }

  // Default variant with full buttons
  return (
    <div className={cn(
      'flex items-center bg-gray-800 rounded-lg',
      sizes.container,
      className
    )}>
      {modes.map((mode) => {
        const Icon = mode.icon
        const isActive = displayMode === mode.value

        return (
          <button
            key={mode.value}
            onClick={() => setDisplayMode(mode.value)}
            className={cn(
              'flex items-center gap-2 font-medium rounded transition-colors',
              sizes.button,
              isActive
                ? 'bg-yellow-500 text-black'
                : 'text-gray-400 hover:text-gray-200'
            )}
            aria-label={`Switch to ${mode.label} display mode`}
          >
            <Icon className={sizes.icon} />
            {showLabels && <span>{mode.label}</span>}
            {!showLabels && <span>{mode.shortLabel}</span>}
          </button>
        )
      })}
    </div>
  )
}

// Alternative single-button toggle component
export function DisplayModeToggleButton({
  className,
  size = 'md',
}: {
  className?: string
  size?: 'sm' | 'md' | 'lg'
}) {
  const { displayMode, toggleDisplayMode, getDisplayModeLabel } = useDisplayMode()
  const sizes = sizeClasses[size]

  const getModeIcon = (mode: DisplayMode) => {
    switch (mode) {
      case 'dollar':
        return DollarSign
      case 'r':
        return Target
      default:
        return DollarSign
    }
  }

  const getModeSymbol = (mode: DisplayMode) => {
    switch (mode) {
      case 'dollar':
        return '$'
      case 'r':
        return 'R'
      default:
        return '$'
    }
  }

  const Icon = getModeIcon(displayMode)

  return (
    <button
      onClick={toggleDisplayMode}
      className={cn(
        'flex items-center gap-2 bg-gray-800 hover:bg-gray-700 text-gray-200 font-medium rounded-lg transition-colors',
        sizes.button,
        className
      )}
      title={`Current: ${getDisplayModeLabel()} - Click to toggle`}
      aria-label={`Toggle display mode. Current: ${getDisplayModeLabel()}`}
    >
      <Icon className={sizes.icon} />
      <span>{getModeSymbol(displayMode)}</span>
    </button>
  )
}

// Dropdown variant for mobile or space-constrained layouts
export function DisplayModeDropdown({
  className,
  size = 'md',
}: {
  className?: string
  size?: 'sm' | 'md' | 'lg'
}) {
  const { displayMode, setDisplayMode, getDisplayModeLabel } = useDisplayMode()
  const sizes = sizeClasses[size]

  return (
    <select
      value={displayMode}
      onChange={(e) => setDisplayMode(e.target.value as DisplayMode)}
      className={cn(
        'bg-gray-800 text-gray-200 border border-gray-700 rounded-lg focus:ring-2 focus:ring-yellow-500 focus:border-yellow-500',
        sizes.button,
        className
      )}
      aria-label="Select display mode"
    >
      <option value="dollar">$ Dollar</option>
      <option value="r">R Risk Multiple</option>
    </select>
  )
}
'use client'

import { useState } from 'react'
import { cn } from '@/lib/utils'

export interface TabConfig {
  id: string
  label: string
  icon?: React.ComponentType<any>
  component: React.ComponentType<any>
  props?: any
}

interface TabbedWidgetProps {
  tabs: TabConfig[]
  defaultTab?: string
  className?: string
  variant?: 'default' | 'compact' | 'minimal'
}

export function TabbedWidget({
  tabs,
  defaultTab,
  className,
  variant = 'default'
}: TabbedWidgetProps) {
  const [activeTab, setActiveTab] = useState(defaultTab || tabs[0]?.id)

  const activeTabConfig = tabs.find(tab => tab.id === activeTab)
  const ActiveComponent = activeTabConfig?.component

  const getTabStyles = () => {
    switch (variant) {
      case 'compact':
        return {
          container: 'border-b border-gray-700 mb-4',
          tabList: 'flex space-x-1',
          tab: 'px-3 py-2 text-sm font-medium rounded-t transition-colors',
          activeTab: 'bg-[#B8860B] text-black',
          inactiveTab: 'text-gray-400 hover:text-white hover:bg-gray-800'
        }
      case 'minimal':
        return {
          container: 'mb-4',
          tabList: 'flex space-x-4',
          tab: 'text-sm font-medium transition-colors',
          activeTab: 'text-[#B8860B] border-b-2 border-[#B8860B] pb-1',
          inactiveTab: 'text-gray-400 hover:text-white'
        }
      default:
        return {
          container: 'border-b border-[#2a2a2a] mb-6',
          tabList: 'flex space-x-6',
          tab: 'px-4 py-3 text-sm font-medium transition-colors relative',
          activeTab: 'text-[#B8860B] border-b-2 border-[#B8860B]',
          inactiveTab: 'text-gray-400 hover:text-white'
        }
    }
  }

  const styles = getTabStyles()

  return (
    <div className={cn('w-full', className)}>
      {/* Tab Navigation */}
      <div className={styles.container}>
        <nav className={styles.tabList} aria-label="Widget tabs">
          {tabs.map((tab) => {
            const Icon = tab.icon
            const isActive = activeTab === tab.id

            return (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                className={cn(
                  styles.tab,
                  isActive ? styles.activeTab : styles.inactiveTab
                )}
                aria-selected={isActive}
                role="tab"
              >
                <div className="flex items-center space-x-2">
                  {Icon && <Icon className="h-4 w-4" />}
                  <span>{tab.label}</span>
                </div>
              </button>
            )
          })}
        </nav>
      </div>

      {/* Tab Content */}
      <div className="w-full">
        {ActiveComponent && (
          <ActiveComponent {...(activeTabConfig?.props || {})} />
        )}
      </div>
    </div>
  )
}

// Pre-configured widget variants for common use cases
export function CompactTabbedWidget(props: Omit<TabbedWidgetProps, 'variant'>) {
  return <TabbedWidget {...props} variant="compact" />
}

export function MinimalTabbedWidget(props: Omit<TabbedWidgetProps, 'variant'>) {
  return <TabbedWidget {...props} variant="minimal" />
}
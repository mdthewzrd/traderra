/**
 * Global type declarations for Traderra application
 * This file declares global window properties for AI agent context access
 */

import { DateRangeContextType } from '@/contexts/DateRangeContext'
import { DisplayModeContextType } from '@/contexts/DisplayModeContext'
import { PnLModeContextType } from '@/contexts/PnLModeContext'

declare global {
  interface Window {
    // Context objects exposed globally for AI agent access
    dateRangeContext?: DateRangeContextType
    displayModeContext?: DisplayModeContextType
    pnlModeContext?: PnLModeContextType
  }
}

export {}
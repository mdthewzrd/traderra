/**
 * PRECISION SELECTORS FOR BULLETPROOF UI INTERACTIONS
 * Eliminates button selector ambiguity for financial-grade reliability
 */

export const PRECISION_SELECTORS = {
  dateRange: {
    '7d': 'button[data-range-value="week"], button:has-text("7d"):not(:has-text("70")):not(:has-text("17"))',
    '30d': 'button[data-range-value="month"], button:has-text("30d"):not(:has-text("30")):not(:has-text("130"))',
    '90d': 'button[data-range-value="90day"], button:has-text("90d"):not(:has-text("90")):not(:has-text("190"))',
    'year': 'button[data-range-value="year"], button:has-text("This Year"):not(:has-text("Last Year")), button:has-text("YTD")',
    'All': 'button[data-range-value="all"], button:has-text("All"):not(:has-text("Call")):not(:has-text("Small"))'
  },
  displayMode: {
    '$': 'button[data-mode-value="dollar"], button[aria-label*="Dollar"], button[data-button-type="dollar"]',
    'R': 'button[data-mode-value="r"], button[aria-label*="Risk Multiple"], button[data-button-type="risk"]'
  },
  aiMode: {
    primary: 'select[data-ai-mode], select:has(option:is([value="Renata"], [value="Analyst"], [value="Coach"], [value="Mentor"]))',
    fallback: '[role="combobox"], select:first-of-type'
  }
};

export async function precisionClick(elementType: keyof typeof PRECISION_SELECTORS, value: string): Promise<boolean> {
  try {
    console.log(`🎯 PRECISION CLICK: ${elementType}:${value}`);

    // Special handling for ALL calendar dropdown date ranges
    if (elementType === 'dateRange' && value.startsWith('calendar_')) {
      console.log(`🗓️ PRECISION CLICK: Calendar dropdown handler for ${value}`);

      // Step 1: Click calendar button to open dropdown
      const calendarButtonSelectors = [
        'button:has(.lucide-calendar)',
        'button[data-range="custom"]',
        '.traderra-date-btn:has(.lucide-calendar)',
        'button.traderra-date-btn:has-text("📅")'
      ];

      let calendarOpened = false;
      for (const calendarSelector of calendarButtonSelectors) {
        const calendarButtons = document.querySelectorAll(calendarSelector);
        for (const button of calendarButtons) {
          if (button instanceof HTMLElement && button.offsetParent !== null) {
            console.log(`🗓️ Clicking calendar button: ${calendarSelector}`);
            button.click();
            calendarOpened = true;
            break;
          }
        }
        if (calendarOpened) break;
      }

      if (!calendarOpened) {
        console.error(`❌ Could not open calendar dropdown`);
        return false;
      }

      // Wait for dropdown to appear
      await new Promise(resolve => setTimeout(resolve, 500));

      // Step 2: Map calendar dropdown options
      const calendarOptionsMap: Record<string, string[]> = {
        'calendar_ytd': ['YTD', 'button:has-text("YTD")', '[data-testid="ytd"]'],
        'calendar_last_year': ['Last Year', 'button:has-text("Last Year")', '[data-testid="last-year"]'],
        'calendar_this_month': ['This Month', 'button:has-text("This Month")', '[data-testid="this-month"]'],
        'calendar_last_month': ['Last Month', 'button:has-text("Last Month")', '[data-testid="last-month"]'],
        'calendar_last_12_months': ['Last 12 Months', 'button:has-text("Last 12 Months")', '[data-testid="last-12-months"]']
      };

      const targetSelectors = calendarOptionsMap[value];
      if (!targetSelectors) {
        console.error(`❌ Unknown calendar dropdown option: ${value}`);
        return false;
      }

      // Step 3: Click the target option in Quick Selection
      for (const selector of targetSelectors) {
        try {
          const elements = document.querySelectorAll(selector);
          for (const element of elements) {
            if (element instanceof HTMLElement && element.offsetParent !== null) {
              console.log(`🗓️ Clicking calendar option "${targetSelectors[0]}": ${selector}`);
              element.click();
              return true;
            }
          }
        } catch (selectorError) {
          // Continue trying other selectors
          continue;
        }
      }

      console.error(`❌ Could not find calendar option "${targetSelectors[0]}" in dropdown`);
      return false;
    }

    // Legacy YTD support for backwards compatibility
    if (elementType === 'dateRange' && value === 'year') {
      console.log(`🗓️ PRECISION CLICK: Legacy YTD support - redirecting to calendar_ytd`);
      return await precisionClick('dateRange', 'calendar_ytd');
    }

    const selectors = PRECISION_SELECTORS[elementType];
    if (!selectors || typeof selectors !== 'object') {
      console.error(`No precision selectors found for elementType: ${elementType}`);
      return false;
    }

    const targetSelector = (selectors as any)[value];
    if (!targetSelector) {
      console.error(`No precision selector found for ${elementType}:${value}`);
      return false;
    }

    console.log(`🎯 Using precision selector: ${targetSelector}`);

    // Find the element using our precision selector
    const element = document.querySelector(targetSelector);
    if (!element) {
      console.error(`🎯 PRECISION CLICK FAILED: No element found for selector: ${targetSelector}`);
      return false;
    }

    // Perform the click
    (element as HTMLElement).click();
    console.log(`🎯 PRECISION CLICK SUCCESS: ${elementType}:${value} clicked successfully`);

    // Wait for state to update
    await new Promise(resolve => setTimeout(resolve, 300));

    return true;
  } catch (error) {
    console.error(`🎯 PRECISION CLICK ERROR: ${elementType}:${value}`, error);
    return false;
  }
}

export async function selectAIMode(mode: string): Promise<boolean> {
  try {
    console.log(`🎯 PRECISION AI MODE SELECTION: ${mode}`);

    // Try primary selector first
    let selector = document.querySelector(PRECISION_SELECTORS.aiMode.primary);
    if (!selector) {
      // Fallback to secondary selector
      selector = document.querySelector(PRECISION_SELECTORS.aiMode.fallback);
    }

    if (!selector) {
      console.error('🎯 AI MODE SELECTION FAILED: No AI mode selector found');
      return false;
    }

    // Handle select element
    if (selector.tagName === 'SELECT') {
      const selectElement = selector as HTMLSelectElement;
      selectElement.value = mode;
      selectElement.dispatchEvent(new Event('change', { bubbles: true }));
      console.log(`🎯 AI MODE SELECTION SUCCESS: ${mode} selected`);
      return true;
    }

    // Handle other interactive elements (buttons, combobox, etc.)
    if (selector.hasAttribute('role') && selector.getAttribute('role') === 'combobox') {
      (selector as HTMLElement).click();
      await new Promise(resolve => setTimeout(resolve, 200));

      // Look for option with matching text
      const option = document.querySelector(`[role="option"]:has-text("${mode}"), option[value="${mode}"]`);
      if (option) {
        (option as HTMLElement).click();
        console.log(`🎯 AI MODE SELECTION SUCCESS: ${mode} selected from combobox`);
        return true;
      }
    }

    console.error(`🎯 AI MODE SELECTION FAILED: Unable to handle selector type for ${mode}`);
    return false;
  } catch (error) {
    console.error(`🎯 AI MODE SELECTION ERROR: ${mode}`, error);
    return false;
  }
}

export function validateButtonAmbiguity(): { totalRButtons: number; precisionMatches: number; isResolved: boolean } {
  try {
    // Count all buttons containing "R"
    const allRButtons = document.querySelectorAll('button:has-text("R")').length;

    // Count precision selector matches
    const precisionSelector = PRECISION_SELECTORS.displayMode.R;
    const precisionMatches = document.querySelectorAll(precisionSelector).length;

    const isResolved = precisionMatches === 1;

    console.log(`🎯 BUTTON AMBIGUITY VALIDATION: Total R buttons: ${allRButtons}, Precision matches: ${precisionMatches}, Resolved: ${isResolved}`);

    return {
      totalRButtons: allRButtons,
      precisionMatches,
      isResolved
    };
  } catch (error) {
    console.error('🎯 BUTTON AMBIGUITY VALIDATION ERROR:', error);
    return { totalRButtons: 0, precisionMatches: 0, isResolved: false };
  }
}
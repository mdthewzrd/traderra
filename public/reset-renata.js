// Emergency Renata Reset Script
// Run this in browser console if Renata is stuck

function emergencyResetRenata() {
  console.log('🚨 EMERGENCY RENATA RESET STARTING...')

  // Clear all storage
  localStorage.clear()
  sessionStorage.clear()

  // Clear specific Traderra keys if they persist
  try {
    sessionStorage.removeItem('traderra-conversations')
    sessionStorage.removeItem('traderra-current-conversation')
    localStorage.removeItem('traderra-conversations')
    localStorage.removeItem('traderra-current-conversation')
  } catch (e) {
    console.log('Storage already cleared')
  }

  // Force reload the page
  console.log('🔄 Reloading page to clear all state...')
  window.location.reload(true)
}

// Auto-run if this script is loaded
if (typeof window !== 'undefined') {
  console.log('🛠️ Renata Emergency Reset Script Loaded')
  console.log('Run emergencyResetRenata() to clear all data and restart')

  // Auto-clear storage on load
  try {
    sessionStorage.removeItem('traderra-conversations')
    sessionStorage.removeItem('traderra-current-conversation')
    console.log('✅ Auto-cleared Traderra storage keys')
  } catch (e) {
    console.log('No storage to clear')
  }
}
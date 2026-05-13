/**
 * Toast notification — shows a temporary message at bottom-right.
 * Extracted from inline JS. Falls back to console if DOM not ready.
 */

let toastTimeout: ReturnType<typeof setTimeout> | null = null

export function showToast(message: string, isError = false) {
  let el = document.getElementById('toast')
  if (!el) {
    console.log('[toast]', message)
    return
  }

  el.textContent = message
  el.className = isError ? 'show err' : 'show'

  if (toastTimeout) clearTimeout(toastTimeout)
  toastTimeout = setTimeout(() => {
    el!.className = ''
  }, 3000)
}

// Expose as global for legacy scripts
;(window as any).toast = showToast

import { redirect } from 'next/navigation'

/**
 * Legacy charts route — redirects to the original static HTML.
 * Kept as fallback in case the React version has issues.
 */
export default function LegacyChartsPage() {
  redirect('/charts-terminal.html')
}

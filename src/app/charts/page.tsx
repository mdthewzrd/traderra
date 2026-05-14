import { getServerSession } from '@/lib/auth-server'
import { redirect } from 'next/navigation'

export const metadata = {
  title: 'Traderra Charts',
}

/**
 * Charts page — serves the static charts-terminal.html.
 * This is the working version that loads charts-engine.js directly.
 * Phase 5 React shell is at /charts-react for development.
 */
export default async function ChartsPage() {
  const session = await getServerSession()
  if (!session) {
    redirect('/sign-in?callbackUrl=/charts')
  }

  // Redirect to the static HTML file which works
  redirect('/charts-terminal.html')
}

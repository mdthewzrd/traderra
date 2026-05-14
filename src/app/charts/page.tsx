import { getServerSession } from '@/lib/auth-server'
import { redirect } from 'next/navigation'

export const metadata = {
  title: 'Traderra Charts',
}

export default async function ChartsPage() {
  const session = await getServerSession()
  if (!session) {
    redirect('/sign-in?callbackUrl=/charts')
  }

  // Inject session token into iframe via postMessage
  return (
    <iframe
      src={`/charts-terminal.html?userId=${session.user.id}&userName=${encodeURIComponent(session.user.name || '')}`}
      style={{ width: '100vw', height: '100vh', border: 'none', display: 'block' }}
      title="Traderra Charts"
    />
  )
}

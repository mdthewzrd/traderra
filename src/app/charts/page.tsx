import { getServerSession } from '@/lib/auth-server'
import { redirect } from 'next/navigation'
import ChartsTerminal from './ChartsTerminal'

export const metadata = {
  title: 'Traderra Charts',
}

export default async function ChartsPage() {
  const session = await getServerSession()
  if (!session) {
    redirect('/sign-in?callbackUrl=/charts')
  }

  return (
    <ChartsTerminal
      userId={session.user.id}
      userName={session.user.name || ''}
      userImage={session.user.image || ''}
    />
  )
}

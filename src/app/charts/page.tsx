import { getServerSession } from '@/lib/auth-server'
import { redirect } from 'next/navigation'
import ChartsClient from './ChartsClient'

export const metadata = {
  title: 'Traderra Charts',
}

export default async function ChartsPage() {
  const isLocal = process.env.NODE_ENV === 'development'
  const session = await getServerSession()
  if (!session && !isLocal) {
    redirect('/sign-in?callbackUrl=/charts')
  }

  return (
    <ChartsClient
      userId={session?.user?.id || 'local-dev-user'}
      userName={session?.user?.name || 'Mike (Local)'}
      userImage={session?.user?.image || ''}
    />
  )
}

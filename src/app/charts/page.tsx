import { getServerSession } from '@/lib/auth-server'
import { redirect } from 'next/navigation'
import ChartsClient from './ChartsClient'

export const metadata = {
  title: 'Traderra Charts',
}

export default async function ChartsPage() {
  const session = await getServerSession()
  // Auth bypassed for local/self-hosted — uncomment below to re-enable
  // if (!session) {
  //   redirect('/sign-in?callbackUrl=/charts')
  // }

  return (
    <ChartsClient
      userId={session?.user?.id || 'local-dev-user'}
      userName={session?.user?.name || 'Mike (Local)'}
      userImage={session?.user?.image || ''}
    />
  )
}

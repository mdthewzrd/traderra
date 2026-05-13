import { auth } from '@/lib/auth'
import { headers } from 'next/headers'

export async function getServerSession() {
  try {
    const h = await headers()
    const session = await auth.api.getSession({ headers: h })
    return session
  } catch {
    return null
  }
}

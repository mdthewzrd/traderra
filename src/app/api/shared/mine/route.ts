import { NextResponse } from 'next/server'
import { getAuthUserId } from '@/lib/auth-helpers'
import { prisma } from '@/lib/prisma'

// GET /api/shared/mine — list user's shared items (authenticated)
export async function GET(req: Request) {
  const userId = await getAuthUserId(req)
  if (!userId) return NextResponse.json({ error: 'unauthorized' }, { status: 401 })

  try {
    const items = await prisma.sharedItem.findMany({
      where: { userId },
      orderBy: { createdAt: 'desc' },
      select: {
        id: true,
        type: true,
        sourceId: true,
        slug: true,
        name: true,
        description: true,
        viewCount: true,
        likeCount: true,
        createdAt: true,
      },
    })

    return NextResponse.json({ items })
  } catch (error: any) {
    console.error('Shared mine GET error:', error)
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
}

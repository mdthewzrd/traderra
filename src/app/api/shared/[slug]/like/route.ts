import { NextRequest, NextResponse } from 'next/server'
import { getAuthUserId } from '@/lib/auth-helpers'
import { prisma } from '@/lib/prisma'

// POST /api/shared/[slug]/like — toggle like (authenticated)
export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ slug: string }> }
) {
  const userId = await getAuthUserId(req)
  if (!userId) return NextResponse.json({ error: 'unauthorized' }, { status: 401 })

  try {
    const { slug } = await params

    const item = await prisma.sharedItem.findUnique({ where: { slug } })
    if (!item) return NextResponse.json({ error: 'not found' }, { status: 404 })

    // Check if already liked
    const existing = await prisma.sharedItemLike.findUnique({
      where: { userId_sharedItemId: { userId, sharedItemId: item.id } },
    })

    if (existing) {
      // Unlike
      await prisma.sharedItemLike.delete({ where: { id: existing.id } })
      await prisma.sharedItem.update({
        where: { id: item.id },
        data: { likeCount: { decrement: 1 } },
      })
      return NextResponse.json({ ok: true, liked: false, likeCount: item.likeCount - 1 })
    } else {
      // Like
      await prisma.sharedItemLike.create({
        data: { userId, sharedItemId: item.id },
      })
      await prisma.sharedItem.update({
        where: { id: item.id },
        data: { likeCount: { increment: 1 } },
      })
      return NextResponse.json({ ok: true, liked: true, likeCount: item.likeCount + 1 })
    }
  } catch (error: any) {
    console.error('Shared like error:', error)
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
}

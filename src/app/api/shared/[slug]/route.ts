import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'

// GET /api/shared/[slug] — public, no auth required
export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ slug: string }> }
) {
  try {
    const { slug } = await params
    const item = await prisma.sharedItem.findUnique({
      where: { slug },
      include: {
        user: { select: { name: true, image: true } },
      },
    })

    if (!item) return NextResponse.json({ error: 'not found' }, { status: 404 })

    // Increment view count (fire and forget)
    prisma.sharedItem.update({
      where: { id: item.id },
      data: { viewCount: { increment: 1 } },
    }).catch(() => {})

    return NextResponse.json({
      type: item.type,
      name: item.name,
      description: item.description,
      data: JSON.parse(item.data),
      user: item.user,
      likeCount: item.likeCount,
      viewCount: item.viewCount + 1,
      createdAt: item.createdAt,
    })
  } catch (error: any) {
    console.error('Shared GET error:', error)
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
}

// DELETE /api/shared/[slug] — owner only
export async function DELETE(
  req: NextRequest,
  { params }: { params: Promise<{ slug: string }> }
) {
  const { getAuthUserId } = await import('@/lib/auth-helpers')
  const userId = await getAuthUserId(req)
  if (!userId) return NextResponse.json({ error: 'unauthorized' }, { status: 401 })

  try {
    const { slug } = await params

    const item = await prisma.sharedItem.findUnique({ where: { slug } })
    if (!item) return NextResponse.json({ error: 'not found' }, { status: 404 })
    if (item.userId !== userId) return NextResponse.json({ error: 'not owner' }, { status: 403 })

    await prisma.sharedItem.delete({ where: { id: item.id } })
    return NextResponse.json({ ok: true })
  } catch (error: any) {
    console.error('Shared DELETE error:', error)
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
}

import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'

// GET /api/shared/explore — public community feed, paginated
export async function GET(req: NextRequest) {
  try {
    const url = req.nextUrl
    const type = url.searchParams.get('type') // optional filter: template | scan | layout
    const sort = url.searchParams.get('sort') || 'newest' // newest | popular
    const page = Math.max(1, parseInt(url.searchParams.get('page') || '1'))
    const take = 20
    const skip = (page - 1) * take

    const where: any = {}
    if (type && ['template', 'scan', 'layout'].includes(type)) {
      where.type = type
    }

    const orderBy = sort === 'popular'
      ? { likeCount: 'desc' as const }
      : { createdAt: 'desc' as const }

    const [items, total] = await Promise.all([
      prisma.sharedItem.findMany({
        where,
        orderBy,
        skip,
        take,
        select: {
          slug: true,
          type: true,
          name: true,
          description: true,
          viewCount: true,
          likeCount: true,
          createdAt: true,
          user: { select: { name: true, image: true } },
        },
      }),
      prisma.sharedItem.count({ where }),
    ])

    return NextResponse.json({
      items,
      page,
      totalPages: Math.ceil(total / take),
      total,
    })
  } catch (error: any) {
    console.error('Shared explore error:', error)
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
}

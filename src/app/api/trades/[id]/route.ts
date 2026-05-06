import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@clerk/nextjs/server'
import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()

// DELETE /api/trades/[id] - Delete a specific trade
export async function DELETE(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const { userId } = auth()

    if (!userId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const tradeId = params.id

    // Verify the trade belongs to the user
    const trade = await prisma.trade.findFirst({
      where: {
        id: tradeId,
        userId
      }
    })

    if (!trade) {
      return NextResponse.json({ error: 'Trade not found' }, { status: 404 })
    }

    // Delete the trade
    await prisma.trade.delete({
      where: { id: tradeId }
    })

    return NextResponse.json({
      message: 'Trade deleted successfully',
      id: tradeId
    })
  } catch (error) {
    console.error('Error deleting trade:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

// PATCH /api/trades/[id] - Update a specific trade
export async function PATCH(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const { userId } = auth()

    if (!userId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const tradeId = params.id
    const body = await request.json()

    // Verify the trade belongs to the user
    const existingTrade = await prisma.trade.findFirst({
      where: {
        id: tradeId,
        userId
      }
    })

    if (!existingTrade) {
      return NextResponse.json({ error: 'Trade not found' }, { status: 404 })
    }

    // Update the trade
    const updatedTrade = await prisma.trade.update({
      where: { id: tradeId },
      data: body
    })

    return NextResponse.json({
      message: 'Trade updated successfully',
      trade: updatedTrade
    })
  } catch (error) {
    console.error('Error updating trade:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

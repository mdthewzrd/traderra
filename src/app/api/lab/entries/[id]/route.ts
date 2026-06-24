import { NextRequest } from 'next/server'
import { PATCH_entry, DELETE_entry } from '../../crud'

// PATCH /api/lab/entries/[id] — update entry
// DELETE /api/lab/entries/[id] — delete entry
export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  return PATCH_entry(req, id)
}

export async function DELETE(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  return DELETE_entry(req, id)
}

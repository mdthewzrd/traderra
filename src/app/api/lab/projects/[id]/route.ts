import { NextRequest } from 'next/server'
import { PATCH_project, DELETE_project } from '../../crud'

// PATCH /api/lab/projects/[id] — update project
// DELETE /api/lab/projects/[id] — delete project
export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  return PATCH_project(req, id)
}

export async function DELETE(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  return DELETE_project(req, id)
}

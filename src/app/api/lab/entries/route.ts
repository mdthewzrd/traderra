import { NextRequest } from 'next/server'
import { GET_entries, POST_entry } from '../crud'

// GET /api/lab/entries?projectId=...&phaseId=... — list entries
// POST /api/lab/entries — create entry
export async function GET(req: NextRequest) {
  return GET_entries(req)
}

export async function POST(req: NextRequest) {
  return POST_entry(req)
}

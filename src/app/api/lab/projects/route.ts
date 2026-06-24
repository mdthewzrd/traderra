import { NextRequest, NextResponse } from 'next/server'
import {
  GET_projects, POST_project,
  PATCH_project, DELETE_project,
  GET_entries, POST_entry,
  PATCH_entry, DELETE_entry,
} from '../crud'

// GET /api/lab/projects — list projects
// POST /api/lab/projects — create project
export async function GET(req: NextRequest) {
  return GET_projects(req)
}

export async function POST(req: NextRequest) {
  return POST_project(req)
}

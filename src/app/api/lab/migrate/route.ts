import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { getAuthUserId } from '@/lib/auth-helpers'

// POST /api/lab/migrate — one-time push of localStorage data to DB
// Body: { projects: LocalProject[], entries: LocalEntry[] }
// Returns: { projects: ServerProject[], entries: ServerEntry[] }

export async function POST(req: NextRequest) {
  const userId = await getAuthUserId(req)
  if (!userId) {
    return NextResponse.json({ error: 'Not authenticated' }, { status: 401 })
  }

  let body: any
  try {
    body = await req.json()
  } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 })
  }

  const { projects: localProjects = [], entries: localEntries = [] } = body

  if (!Array.isArray(localProjects) || !Array.isArray(localEntries)) {
    return NextResponse.json({ error: 'Expected { projects: [], entries: [] }' }, { status: 400 })
  }

  // Map local IDs → server IDs for foreign key resolution
  const idMap = new Map<string, string>() // localId → serverId
  const phaseIdMap = new Map<string, string>() // localPhaseId → serverPhaseId

  const serverProjects: any[] = []
  const serverEntries: any[] = []

  // ── Upsert projects + phases ──
  for (const lp of localProjects) {
    try {
      // Check if project already exists (by name + userId to avoid dupes)
      const existing = await prisma.strategyProject.findFirst({
        where: { userId, name: lp.name },
        include: { phases: true },
      })

      if (existing) {
        // Already migrated — map IDs and skip
        idMap.set(lp.id, existing.id)
        for (const ph of existing.phases) {
          phaseIdMap.set(`${lp.id}_${ph.phase}`, ph.id)
        }
        serverProjects.push(existing)
        continue
      }

      // Create project
      const proj = await prisma.strategyProject.create({
        data: {
          userId,
          name: lp.name,
          description: lp.description || '',
          type: lp.type || 'setup',
          status: lp.status || 'idea',
          tags: lp.tags || '[]',
          linkedScanId: lp.linkedScanId || null,
          createdAt: lp.createdAt ? new Date(lp.createdAt) : undefined,
          updatedAt: lp.updatedAt ? new Date(lp.updatedAt) : undefined,
        },
      })
      idMap.set(lp.id, proj.id)

      // Create phases
      const phaseDefs = [
        { phase: 'scan', label: 'Scan', order: 0 },
        { phase: 'setup', label: 'Setup', order: 1 },
        { phase: 'entry', label: 'Entry', order: 2 },
        { phase: 'exit', label: 'Exit', order: 3 },
        { phase: 'backtest', label: 'Backtest', order: 4 },
      ]

      for (const def of phaseDefs) {
        const phase = await prisma.projectPhase.create({
          data: {
            projectId: proj.id,
            phase: def.phase,
            label: def.label,
            order: def.order,
          },
        })
        // Map both the local synthetic ID and the standard pattern
        phaseIdMap.set(`${lp.id}_${def.phase}`, phase.id)
      }

      serverProjects.push(proj)
    } catch (err) {
      console.error('Lab migrate: failed to create project', lp.name, err)
    }
  }

  // ── Upsert entries ──
  for (const le of localEntries) {
    const serverProjectId = idMap.get(le.projectId)
    if (!serverProjectId) continue // orphan entry, skip

    const serverPhaseId = phaseIdMap.get(le.phaseId) || null

    try {
      // Check for duplicate by project + title + createdAt proximity
      const existing = await prisma.projectEntry.findFirst({
        where: {
          projectId: serverProjectId,
          title: le.title || 'Note',
          createdAt: le.createdAt ? new Date(le.createdAt) : undefined,
        },
      })

      if (existing) {
        serverEntries.push(existing)
        continue
      }

      const entry = await prisma.projectEntry.create({
        data: {
          projectId: serverProjectId,
          phaseId: serverPhaseId,
          parentId: le.parentId || null,
          type: le.type || 'note',
          title: le.title || 'Note',
          body: le.content || '',
          imageData: le.imageData || null,
          createdAt: le.createdAt ? new Date(le.createdAt) : undefined,
          updatedAt: le.updatedAt ? new Date(le.updatedAt) : undefined,
        },
      })
      serverEntries.push(entry)
    } catch (err) {
      console.error('Lab migrate: failed to create entry', le.id, err)
    }
  }

  return NextResponse.json({
    migrated: true,
    projects: serverProjects.length,
    entries: serverEntries.length,
    idMap: Object.fromEntries(idMap),
    phaseIdMap: Object.fromEntries(phaseIdMap),
  })
}

'use client'

import { useEffect, useRef } from 'react'
import { useAuth } from '@/lib/auth-client'

const PROJECTS_KEY = 'traderra-lab-projects'
const ENTRIES_KEY = 'traderra-lab-entries'
const MIGRATED_KEY = 'traderra-lab-migrated'

/**
 * useLabSync — watches auth state and migrates localStorage Lab data
 * to the server DB on first sign-in. Runs once per session.
 *
 * After migration:
 *  - localStorage data is kept as offline cache
 *  - A flag in sessionStorage prevents re-migration
 *  - The API becomes source of truth (TabLab can be upgraded to
 *    fetch from API when isSignedIn, falling back to localStorage)
 */
export function useLabSync() {
  const { isSignedIn, isLoaded, userId } = useAuth()
  const migrated = useRef(false)

  useEffect(() => {
    if (!isLoaded || !isSignedIn || !userId || migrated.current) return

    // Check if already migrated this browser session
    if (sessionStorage.getItem(`${MIGRATED_KEY}:${userId}`)) return

    migrated.current = true

    // Read local data
    let localProjects: any[] = []
    let localEntries: any[] = []
    try {
      localProjects = JSON.parse(localStorage.getItem(PROJECTS_KEY) || '[]')
      localEntries = JSON.parse(localStorage.getItem(ENTRIES_KEY) || '[]')
    } catch {
      return
    }

    // Nothing to migrate
    if (localProjects.length === 0 && localEntries.length === 0) {
      sessionStorage.setItem(`${MIGRATED_KEY}:${userId}`, 'empty')
      return
    }

    console.log(`[LabSync] Migrating ${localProjects.length} projects, ${localEntries.length} entries for user ${userId}`)

    fetch('/api/lab/migrate', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ projects: localProjects, entries: localEntries }),
    })
      .then(res => res.json())
      .then(data => {
        if (data.migrated) {
          console.log(`[LabSync] Migration complete: ${data.projects} projects, ${data.entries} entries`)
          sessionStorage.setItem(`${MIGRATED_KEY}:${userId}`, new Date().toISOString())

          // Optional: clear local data after successful migration
          // Uncomment when ready to fully switch to API mode:
          // localStorage.removeItem(PROJECTS_KEY)
          // localStorage.removeItem(ENTRIES_KEY)
        } else {
          console.warn('[LabSync] Migration response:', data)
        }
      })
      .catch(err => {
        console.error('[LabSync] Migration failed:', err)
        migrated.current = false // allow retry
      })
  }, [isLoaded, isSignedIn, userId])
}

import DatabaseClient from './DatabaseClient'

// Force dynamic rendering — this page is fully client-rendered and has a
// circular init ("Cannot access 'E' before initialization") that breaks
// static export/prerender at build time. Route segment config must live in a
// server component (no 'use client'), hence this thin wrapper.
export const dynamic = 'force-dynamic'

export default function DatabasePage() {
  return <DatabaseClient />
}

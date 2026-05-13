/**
 * Community Sharing — API client for sharing templates, scans, and layouts.
 * Extracted from inline JS. Uses fetch + toast (global for now).
 */

const BASE_URL = 'https://traderra-lime.vercel.app'

import { showToast as toast } from './toast'

export async function shareTemplate(templateId: string, templateName: string) {
  toast('Creating share link...')
  try {
    const res = await fetch('/api/shared', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ type: 'template', sourceId: templateId, name: templateName }),
    })
    const data = await res.json()
    if (data.error) { toast('Share failed: ' + data.error); return }
    const url = `${BASE_URL}/shared/${data.slug}`
    try { await navigator.clipboard.writeText(url) } catch { /* fallback */ }
    toast('Link copied! ' + url)
    return data.slug
  } catch (e: any) {
    toast('Share failed: ' + e.message)
  }
}

export async function shareScan(scanId: string, scanName: string) {
  toast('Creating share link...')
  try {
    const res = await fetch('/api/shared', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ type: 'scan', sourceId: scanId, name: scanName }),
    })
    const data = await res.json()
    if (data.error) { toast('Share failed: ' + data.error); return }
    const url = `${BASE_URL}/shared/${data.slug}`
    try { await navigator.clipboard.writeText(url) } catch { /* fallback */ }
    toast('Link copied! ' + url)
    return data.slug
  } catch (e: any) {
    toast('Share failed: ' + e.message)
  }
}

export async function importSharedItem(slug: string) {
  try {
    const res = await fetch(`/api/shared/${slug}`)
    const d = await res.json()
    if (d.error) { toast('Import failed: ' + d.error); return }

    if (d.type === 'template') {
      const p = (window as any).panels?.[0]
      if (!p) { toast('No chart panel'); return }
      if (d.data?.tools) {
        p.tools = JSON.parse(JSON.stringify(d.data.tools))
        p.inds = (window as any).deriveInds?.(p.tools)
      }
      ;(window as any).buildIndicatorRow?.(0)
      ;(window as any).renderIndButtons?.()
      ;(window as any).renderHotButtons?.()
      ;(window as any).renderAll?.()
      toast('Imported template: ' + d.name)
    } else if (d.type === 'scan') {
      const scanData = {
        name: 'Imported: ' + d.name,
        type: d.data?.type || 'imported',
        strategy: d.data?.strategy || 'custom',
        code: d.data?.code || null,
        dateRange: d.data?.dateRange ? JSON.stringify(d.data.dateRange) : null,
        filterMode: d.data?.filterMode || '3',
        tags: d.data?.tags ? JSON.stringify(d.data.tags) : '[]',
        results: '[]',
      }
      const scanRes = await fetch('/api/scans', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(scanData),
      })
      const scanResult = await scanRes.json()
      if (scanResult.scan) {
        ;(window as any).ScanManager?.load?.()
        toast('Imported scan: ' + d.name)
      } else {
        toast('Import scan failed')
      }
    } else {
      toast('Unknown shared type: ' + d.type)
    }

    // Clean URL
    if (history.replaceState) history.replaceState(null, '', location.pathname)
  } catch (e: any) {
    toast('Import failed: ' + e.message)
  }
}

/**
 * Check URL for ?importShared=slug and auto-import on page load.
 */
export function checkAutoImport() {
  const m = location.search.match(/[?&]importShared=([a-zA-Z0-9_-]+)/)
  if (m) setTimeout(() => importSharedItem(m[1]), 1500)
}

import { NextRequest } from 'next/server'

/**
 * GET /api/scans/stream — SSE stream for real-time scan push notifications.
 * SCAN tab connects here and receives pushed scans instantly.
 */

export const dynamic = 'force-dynamic'

export async function GET(req: NextRequest) {
  const encoder = new TextEncoder()

  const stream = new ReadableStream({
    start(controller) {
      // Send initial heartbeat
      controller.enqueue(encoder.encode(': connected\n\n'))

      // Listener for pushed scans
      const handler = (scan: any) => {
        const data = JSON.stringify(scan)
        controller.enqueue(encoder.encode(`event: scan\ndata: ${data}\n\n`))
      }

      // Import the shared listeners set
      import('../push/route').then(({ listeners }) => {
        listeners.add(handler)

        // Cleanup on close
        req.signal.addEventListener('abort', () => {
          listeners.delete(handler)
          try { controller.close() } catch {}
        })
      })

      // Heartbeat every 30s to keep connection alive
      const hb = setInterval(() => {
        try {
          controller.enqueue(encoder.encode(': heartbeat\n\n'))
        } catch {
          clearInterval(hb)
        }
      }, 30000)

      req.signal.addEventListener('abort', () => clearInterval(hb))
    },
  })

  return new Response(stream, {
    headers: {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache, no-transform',
      'Connection': 'keep-alive',
      'X-Accel-Buffering': 'no',
    },
  })
}

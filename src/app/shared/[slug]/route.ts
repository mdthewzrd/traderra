import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ slug: string }> }
) {
  const { slug } = await params
  const item = await prisma.sharedItem.findUnique({
    where: { slug },
    include: { user: { select: { name: true, image: true } } },
  })
  if (!item) return new Response('Not found', { status: 404 })

  // Increment view count
  prisma.sharedItem.update({
    where: { id: item.id },
    data: { viewCount: { increment: 1 } },
  }).catch(() => {})

  const data = JSON.parse(item.data)
  const userName = item.user?.name || 'Anonymous'

  // Build HTML page
  const html = `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>${esc(item.name)} — Traderra Community</title>
<style>
  * { margin:0; padding:0; box-sizing:border-box; }
  body { font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif; background:#0a0a0f; color:#e2e8f0; min-height:100vh; display:flex; align-items:center; justify-content:center; }
  .card { background:#12121a; border:1px solid #1e1e2e; border-radius:16px; padding:40px; max-width:560px; width:90%; }
  .badge { display:inline-block; background:#1e3a5f; color:#60a5fa; font-size:12px; padding:3px 10px; border-radius:20px; text-transform:uppercase; letter-spacing:0.5px; }
  h1 { font-size:24px; margin:16px 0 8px; font-weight:600; }
  .meta { color:#64748b; font-size:14px; margin-bottom:16px; }
  .desc { color:#94a3b8; font-size:14px; line-height:1.6; margin-bottom:24px; }
  .stats { display:flex; gap:24px; margin-bottom:28px; }
  .stat { text-align:center; }
  .stat-val { font-size:20px; font-weight:600; }
  .stat-label { font-size:12px; color:#64748b; }
  .btn { display:inline-block; background:#3b82f6; color:#fff; padding:12px 32px; border-radius:10px; text-decoration:none; font-weight:500; font-size:15px; transition:background .2s; }
  .btn:hover { background:#2563eb; }
  .btn-secondary { background:transparent; border:1px solid #334155; color:#94a3b8; margin-left:12px; }
  .btn-secondary:hover { border-color:#3b82f6; color:#3b82f6; }
  .preview { background:#0a0a12; border:1px solid #1e1e2e; border-radius:10px; padding:16px; margin-bottom:24px; font-family:monospace; font-size:13px; max-height:240px; overflow:auto; white-space:pre-wrap; color:#94a3b8; }
  .footer { margin-top:24px; text-align:center; font-size:12px; color:#475569; }
</style>
</head>
<body>
<div class="card">
  <span class="badge">${esc(item.type)}</span>
  <h1>${esc(item.name)}</h1>
  <div class="meta">Shared by <strong>${esc(userName)}</strong> · ${new Date(item.createdAt).toLocaleDateString()}</div>
  ${item.description ? `<div class="desc">${esc(item.description)}</div>` : ''}
  <div class="stats">
    <div class="stat"><div class="stat-val">${item.viewCount + 1}</div><div class="stat-label">views</div></div>
    <div class="stat"><div class="stat-val">${item.likeCount}</div><div class="stat-label">likes</div></div>
  </div>
  <div class="preview">${esc(JSON.stringify(data, null, 2))}</div>
  <a class="btn" href="https://traderra-lime.vercel.app/charts?importShared=${esc(slug)}">Open in Charts</a>
  <a class="btn btn-secondary" href="https://traderra-lime.vercel.app/charts">Go to Traderra</a>
  <div class="footer">Traderra Community · Shared Charts & Scans</div>
</div>
<script>
  // Auto-import flow: if logged in and importShared param exists on target
  // The charts app handles the importShared param on load
</script>
</body>
</html>`
  return new Response(html, {
    headers: { 'Content-Type': 'text/html; charset=utf-8' },
  })
}

function esc(s: string) {
  return s.replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;')
}

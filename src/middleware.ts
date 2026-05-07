import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'

// Public routes that don't require authentication
const publicRoutes = [
  '/',
  '/sign-in(.*)',
  '/sign-up(.*)',
  '/api/auth(.*)',
  '/api/chart-data(.*)',
  '/api/webhook(.*)',
  '/api/health(.*)',
  '/api/test(.*)',
  '/api/chart-settings(.*)',
  '/api/market-data(.*)',
  '/api/indicators(.*)',
  '/api/scanner(.*)',
  '/api/research(.*)',
  '/api/renata(.*)',
  '/api/copilotkit(.*)',
  '/api/agui(.*)',
  '/api/agui-chat(.*)',
  '/api/agents(.*)',
  '/api/trades(.*)',
  '/api/debug(.*)',
  '/api/fix-user-id(.*)',
  '/api/get-current-user-id(.*)',
  '/api/openrouter-key(.*)',
  '/api/admin(.*)',
  '/api/ai(.*)',
  '/api/risk-management(.*)',
  '/api/settings(.*)',
  '/api/workflows(.*)',
  '/api/trading-agents(.*)',
  // Pages
  '/charts(.*)',
  '/scanner(.*)',
  '/backtest(.*)',
  '/research(.*)',
  '/dashboard(.*)',
  '/journal(.*)',
  '/statistics(.*)',
  '/analytics(.*)',
  '/calendar(.*)',
  '/trades(.*)',
  '/settings(.*)',
  '/daily-summary(.*)',
]

function isPublic(pathname: string): boolean {
  return publicRoutes.some(pattern => {
    if (pattern.includes('(.*)')) {
      const prefix = pattern.replace('(.*)', '')
      return pathname.startsWith(prefix)
    }
    return pathname === pattern
  })
}

export function middleware(request: NextRequest) {
  // All routes are public for now — auth is optional
  return NextResponse.next()
}

export const config = {
  matcher: [
    '/((?!_next|[^?]*\\.(?:html?|css|js(?!on)|jpe?g|webp|png|gif|svg|ttf|woff2?|ico|csv|docx?|xlsx?|zip|webmanifest)).*)',
    '/(api|trpc)(.*)',
  ],
}

import { chromium } from 'playwright'
import crypto from 'crypto'
import fs from 'fs'

const BASE = 'http://localhost:6565'
const TOKEN = 'nNIHGcUHMk1eiATQF23qkd0Mc0KXtoGM'
const SECRET = fs.readFileSync('.env','utf8').match(/^BETTER_AUTH_SECRET=(.+)$/m)[1].trim()
const sig = crypto.createHmac('sha256', SECRET).update(TOKEN).digest().toString('base64').replace(/\+/g,'-').replace(/\//g,'_').replace(/=+$/,'')

const browser = await chromium.launch()
const ctx = await browser.newContext()
await ctx.addCookies([{ name:'better-auth.session_token', value:`${TOKEN}.${sig}`, domain:'localhost', path:'/', httpOnly:false, secure:false, sameSite:'Lax' }])
const page = await ctx.newPage()

// Capture FULL console errors with location
page.on('console', async m => {
  if (m.type()==='error') {
    const loc = m.location()
    console.log('=== CONSOLE ERROR ===')
    console.log(m.text())
    console.log('  at', loc.url, 'line', loc.lineNumber)
  }
})
// Capture unhandled page errors (have stack traces)
page.on('pageerror', e => { console.log('=== PAGEERROR ===\n', e.stack) })

console.log('== goto /calendar')
await page.goto(`${BASE}/calendar`, { waitUntil:'domcontentloaded' })
await page.waitForTimeout(3000)
console.log('== done waiting; load errors above')
await browser.close()

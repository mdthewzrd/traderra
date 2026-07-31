import { chromium } from 'playwright'

const BASE = 'http://localhost:6565'
const TOKEN = 'nNIHGcUHMk1eiATQF23qkd0Mc0KXtoGM'
import crypto from 'crypto'
import fs from 'fs'
const SECRET = fs.readFileSync('.env','utf8').match(/^BETTER_AUTH_SECRET=(.+)$/m)[1].trim()
const sig = crypto.createHmac('sha256', SECRET).update(TOKEN).digest().toString('base64').replace(/\+/g,'-').replace(/\//g,'_').replace(/=+$/,'')

const browser = await chromium.launch()
const ctx = await browser.newContext()
// Set BOTH signed cookie (for client useSession) and note custom API accepts it too
await ctx.addCookies([
  { name:'better-auth.session_token', value:`${TOKEN}.${sig}`, domain:'localhost', path:'/', httpOnly:false, secure:false, sameSite:'Lax' },
])
const page = await ctx.newPage()
const nav = []
page.on('framenavigated', f => { if (f===page.mainFrame()) nav.push(f.url()) })
page.on('console', m => { if (m.type()==='error') console.log('  [err]', m.text().slice(0,160)) })
const apiCalls = []
page.on('request', r => { if (r.url().includes('/api/') && r.method()!=='OPTIONS') { apiCalls.push(`${r.method()} ${r.url().replace(BASE,'')}`); console.log('  [req]', r.method(), r.url().replace(BASE,'')) } })

console.log('== goto /calendar')
await page.goto(`${BASE}/calendar`, { waitUntil:'networkidle' })

// Click current month (July) to enter month view. Month cards are buttons with month name.
console.log('== click July month card')
await page.locator('button', { hasText: 'July' }).first().click()
await page.waitForTimeout(500)

// In month view, find today's cell (28) with a review and click the open-review (+/FileText) button.
// Easier: click the day cell with text "28", then use "Open Review" button in day view.
console.log('== click day 28')
await page.locator('div:has-text("28")').filter({ has: page.locator('button[title]') }).first().click()
await page.waitForTimeout(400)

// Day view: click "Open Review"
console.log('== click Open Review')
const openBtn = page.locator('button', { hasText: 'Open Review' }).or(page.locator('button', { hasText: 'Add Review' }))
await openBtn.first().click()
await page.waitForTimeout(800)

const titleSel = 'input[placeholder="Review title…"]'
const taSel = 'textarea[placeholder^="Write here"]'
try { await page.waitForSelector(titleSel, { timeout: 12000 }) }
catch {
  console.log('TITLE NOT FOUND. body:', (await page.locator('body').innerText()).slice(0,300))
  await page.screenshot({ path:'_repro_cal.png' }); await browser.close(); process.exit(1)
}

console.log('== TITLE type XYZ (with 1500ms gaps to catch async resets)')
const title = page.locator(titleSel).first()
const beforeTitle = await title.inputValue()
console.log('  title before:', JSON.stringify(beforeTitle))
await title.click()
await title.fill('')
for (const ch of 'XYZ') {
  await title.press(ch)
  console.log(`  typed ${ch}, value now: "${await title.inputValue()}"`)
  await page.waitForTimeout(1500) // long gap to let debounce+save+refetch fire
  console.log(`     after 1.5s: "${await title.inputValue()}"`)
}

console.log('== SECTION textarea type abc')
await page.waitForSelector(taSel, { timeout:10000 })
const ta = page.locator(taSel).first()
await ta.click()
await ta.fill('')
for (const ch of 'abc') {
  await ta.press(ch)
  console.log(`  typed ${ch}, value now: "${await ta.inputValue()}"`)
  await page.waitForTimeout(1500)
  console.log(`     after 1.5s: "${await ta.inputValue()}"`)
}

console.log('== nav count:', nav.length, nav.slice(0,4))
console.log('== api calls:', apiCalls.length)
await page.screenshot({ path:'_repro_cal.png' })
await browser.close()
console.log('== DONE')

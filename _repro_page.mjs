import { chromium } from 'playwright'
import crypto from 'crypto'; import fs from 'fs'
const BASE='http://localhost:6565'; const TOKEN='nNIHGcUHMk1eiATQF23qkd0Mc0KXtoGM'
const SECRET=fs.readFileSync('.env','utf8').match(/^BETTER_AUTH_SECRET=(.+)$/m)[1].trim()
const sig=crypto.createHmac('sha256',SECRET).update(TOKEN).digest().toString('base64').replace(/\+/g,'-').replace(/\//g,'_').replace(/=+$/,'')
const b=await chromium.launch(); const ctx=await b.newContext()
await ctx.addCookies([{name:'better-auth.session_token',value:`${TOKEN}.${sig}`,domain:'localhost',path:'/',httpOnly:false,secure:false,sameSite:'Lax'}])
for (const p of ['/sign-in','/journal','/trades','/statistics']) {
  const page=await ctx.newPage()
  let loop=false
  page.on('console',m=>{ if(m.type()==='error'&&m.text().includes('Maximum update depth')) loop=true })
  try { await page.goto(BASE+p,{waitUntil:'domcontentloaded',timeout:15000}); await page.waitForTimeout(2500) } catch(e){ console.log(p,'NAV ERR',e.message.slice(0,80)) }
  console.log(p, loop? '❌ INFINITE LOOP':'✅ ok')
  await page.close()
}
await b.close()

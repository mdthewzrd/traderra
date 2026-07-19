require("dotenv").config({path:".env.local"});const {PrismaClient}=require("@prisma/client");const p=new PrismaClient();
const KEY="d95jSGsXx6ZoqYG1_GXaqnmP6y64ZO_r";
const sleep=ms=>new Promise(r=>setTimeout(r,ms));
(async()=>{
  const rows=await p.$queryRawUnsafe('SELECT DISTINCT symbol FROM "Trade" ORDER BY symbol');
  console.log("Total distinct symbols:",rows.length);
  const issues=[];
  for(const {symbol} of rows){
    if(!symbol||!/^[A-Z]+$/.test(symbol)) continue;
    // 1) ticker detail active?
    let detail=null;try{const r=await fetch(`https://api.polygon.io/v3/reference/tickers/${symbol}?apikey=${KEY}`);detail=await r.json();}catch(e){}
    const found=detail&&detail.results;
    // 2) has any daily candle in last 30 days?
    let recent=null;try{const to=new Date().toISOString().slice(0,10);const from=new Date(Date.now()-30*864e5).toISOString().slice(0,10);const r=await fetch(`https://api.polygon.io/v2/aggs/ticker/${symbol}/range/1/day/${from}/${to}?limit=1&apikey=${KEY}`);recent=await r.json();}catch(e){}
    const hasRecent=recent&&Array.isArray(recent.results)&&recent.results.length>0;
    if(!found||!found.active||!hasRecent){
      issues.push({symbol, found:!!found, active:found&&found.active, hasRecent, name:found&&found.name});
      console.log(`  ⚠ ${symbol} | detail:${found?'yes':'NO'} active:${found&&found.active||'-'} recent30d:${hasRecent?'yes':'NO'}`);
    }
    await sleep(120); // rate-limit friendly
  }
  console.log("\nTotal flagged:",issues.length);
  await p.$disconnect();
})();

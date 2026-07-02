// Diagnose the 45% gap: are empty tickers never-synced (needsSync) or
// actually broken (data in DB but not surfacing)?
const SAMPLE = ['AAPL','NVDA','MSFT','TSLA','AMD','GOOGL','META','AMZN','SOUN','MULN','FFIE','IBRX','CEI','WATT','PROG','SOLO','KITT','AUID','JEM','ATOS','VEEA','JAGX','NGNE','ADTX','MOBX','SDOT','INPX','PHUN','GNUS','VTNR','GBR','JOB','UAVS','MXC','SIF','VNRX','SUNE','PLUG','BBAI','NNDM','ZOM','BTBT','RIOT','MARA','ENPH'];
const BASE = 'http://localhost:6565';
async function probe(t) {
  try {
    const r = await fetch(`${BASE}/api/dilution/snapshot?ticker=${t}`, { signal: AbortSignal.timeout(15000) });
    const j = await r.json();
    if (!j.snapshot) return { t, state: j.needsSync ? 'NEEDS_SYNC' : 'NO_SNAP' };
    const s = j.snapshot;
    return {
      t, state: 'OK',
      shares: s.sharesHistory?.length ?? 0,
      needsSync: j.needsSync ? 'Y' : 'N',
      fromCache: s.fromCache ? 'Y' : 'N',
    };
  } catch (e) { return { t, state: 'ERR:'+e.message.slice(0,30) }; }
}
(async () => {
  const res = await Promise.all(SAMPLE.map(probe));
  const empty = res.filter(r => r.state === 'OK' && r.shares === 0);
  const needs = res.filter(r => r.state === 'NEEDS_SYNC');
  const err = res.filter(r => r.state.startsWith('ERR') || r.state === 'NO_SNAP');
  console.log(`=== EMPTY shares (OK snapshot but 0 history): ${empty.length} ===`);
  for (const r of empty) console.log(`  ${r.t}  cache:${r.fromCache} sync:${r.needsSync}`);
  console.log(`\n=== NEEDS_SYNC (never synced): ${needs.length} ===`);
  needs.forEach(r => console.log(`  ${r.t}`));
  console.log(`\n=== ERROR/NO_SNAP: ${err.length} ===`);
  err.forEach(r => console.log(`  ${r.t}: ${r.state}`));
})();

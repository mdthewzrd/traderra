// Stress test: snapshot API across a broad ticker sample. Reports field
// coverage, pricing anomalies, empty sections, and failures.
const SAMPLE = [
  // mega/large caps (should be clean)
  'AAPL','NVDA','MSFT','TSLA','AMD','GOOGL','META','AMZN',
  // small/micro caps (dilution target)
  'SOUN','MULN','FFIE','IBRX','CEI','WATT','PROG','SOLO','KITT','AUID',
  // the tickers we validated this session
  'JEM','ATOS','VEEA','JAGX','NGNE','ADTX',
  // reverse-split names (Gap 4 coverage)
  'MOBX','SDOT','INPX','PHUN','GNUS','VTNR','MCOM','CYTH',
  // OTC / shell-ish
  'GBR','JOB','UAVS','MXC','SIF','VNRX','SUNE','BSIN',
  // random broader sample
  'PLUG','BBAI','INPX','NNDM','ZOM','BTBT','RIOT','MARA','ENPH',
];
const uniq = [...new Set(SAMPLE)];
const BASE = 'http://localhost:6565';

async function probe(ticker) {
  const t0 = Date.now();
  try {
    const res = await fetch(`${BASE}/api/dilution/snapshot?ticker=${ticker}`, { signal: AbortSignal.timeout(20000) });
    const j = await res.json();
    const ms = Date.now() - t0;
    if (!j.snapshot) return { ticker, ok: false, ms, err: 'no snapshot', needsSync: j.needsSync };
    const s = j.snapshot;
    const ov = s.overhang ?? {};
    // pricing anomalies: any program pricing > $1000 or suspicious
    const pricingBad = (s.programs ?? []).filter(p => {
      const m = (p.pricing ?? '').match(/\$([\d,.]+)/);
      const v = m ? parseFloat(m[1].replace(/,/g, '')) : null;
      return v != null && (v > 1000 || (v < 0.01 && p.pricing));
    }).map(p => p.pricing);
    return {
      ticker, ok: true, ms, fromCache: s.fromCache,
      // field presence
      shares: s.sharesHistory?.length ?? 0,
      floatCover: s.publicFloat ? 'sec' : (s.computedFloat ? 'comp' : 'none'),
      overhang: ov.warrant ? `${(ov.warrant.shares/1e6).toFixed(1)}M@${ov.warrant.strike != null ? '$'+ov.warrant.strike.toFixed(2) : 'null'}` : 'none',
      splitNote: ov.splitNote ? 'split' : '',
      compliance: s.compliance ? `${s.compliance.failures}fail` : 'none',
      programs: s.programs?.length ?? 0,
      eqLines: s.warrantNotes?.equityLines?.length ?? 0,
      form4: s.form4Txns?.length ?? 0,
      draws: s.draws?.length ?? 0,
      price: s.inTheMoney?.price ?? null,
      pricingBad,
    };
  } catch (e) {
    return { ticker, ok: false, ms, err: e.message.slice(0, 50) };
  }
}

(async () => {
  console.log(`Stress testing ${uniq.length} tickers against ${BASE}...\n`);
  const results = [];
  // run in small batches to avoid overwhelming
  for (let i = 0; i < uniq.length; i += 5) {
    const batch = uniq.slice(i, i + 5);
    const out = await Promise.all(batch.map(probe));
    results.push(...out);
    process.stdout.write('.');
  }
  console.log('\n');

  // failures
  const fails = results.filter(r => !r.ok);
  const oks = results.filter(r => r.ok);
  console.log(`=== SUMMARY: ${oks.length}/${results.length} ok, ${fails.length} failed ===\n`);

  if (fails.length) {
    console.log('FAILURES:');
    for (const f of fails) console.log(`  ${f.ticker}: ${f.err} (${f.ms}ms)`);
    console.log('');
  }

  // field coverage across ok results
  const cov = (pred) => oks.filter(pred).length;
  console.log('FIELD COVERAGE (of ok results):');
  console.log(`  sharesHistory>0:      ${cov(r => r.shares > 0)}/${oks.length} (${(100*cov(r=>r.shares>0)/oks.length).toFixed(0)}%)`);
  console.log(`  float (sec or comp):  ${cov(r => r.floatCover !== 'none')}/${oks.length} (${(100*cov(r=>r.floatCover!=='none')/oks.length).toFixed(0)}%)`);
  console.log(`  overhang warrant:     ${cov(r => r.overhang !== 'none')}/${oks.length} (${(100*cov(r=>r.overhang!=='none')/oks.length).toFixed(0)}%)`);
  console.log(`  compliance:           ${cov(r => r.compliance !== 'none')}/${oks.length} (${(100*cov(r=>r.compliance!=='none')/oks.length).toFixed(0)}%)`);
  console.log(`  programs>0:           ${cov(r => r.programs > 0)}/${oks.length} (${(100*cov(r=>r.programs>0)/oks.length).toFixed(0)}%)`);
  console.log(`  form4>0:              ${cov(r => r.form4 > 0)}/${oks.length} (${(100*cov(r=>r.form4>0)/oks.length).toFixed(0)}%)`);
  console.log(`  price present:        ${cov(r => r.price != null)}/${oks.length} (${(100*cov(r=>r.price!=null)/oks.length).toFixed(0)}%)`);

  // pricing anomalies
  const anomalies = oks.filter(r => r.pricingBad.length > 0);
  console.log(`\n=== PRICING ANOMALIES: ${anomalies.length} tickers ===`);
  for (const r of anomalies.slice(0, 20)) console.log(`  ${r.ticker}: ${r.pricingBad.join('; ')}`);

  // null strikes (warrant overhang with null strike)
  const nullStrikes = oks.filter(r => r.overhang.includes('@null'));
  console.log(`\n=== NULL WARRANT STRIKES: ${nullStrikes.length} tickers ===`);
  for (const r of nullStrikes.slice(0, 15)) console.log(`  ${r.ticker}: ${r.overhang}`);

  // avg latency
  const avgMs = Math.round(oks.reduce((a, r) => a + r.ms, 0) / oks.length);
  console.log(`\nAvg latency: ${avgMs}ms (cached faster)`);
})();

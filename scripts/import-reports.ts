/**
 * Import normalized reports JSONL → DilutionReport (idempotent upsert).
 * Run after askedgar-export-reports.py.
 *   npx tsx scripts/import-reports.ts
 */
import { PrismaClient } from '@prisma/client';
import * as fs from 'fs';

const prisma = new PrismaClient();

async function main() {
  const lines = fs.readFileSync('/tmp/ae_reports.jsonl', 'utf8').split('\n').filter(Boolean);
  const data = [];
  let skipped = 0;
  for (const line of lines) {
    const r = JSON.parse(line);
    const reportDate = new Date(r.reportDate);
    if (isNaN(reportDate.getTime()) || !r.ticker) { skipped++; continue; }
    data.push({
      id: r.id,
      ticker: r.ticker,
      reportDate,
      source: r.source,
      sourceRef: r.sourceRef ?? null,
      price: r.price ?? null,
      marketCap: r.marketCap ?? null,
      floatShares: r.floatShares != null && Number.isInteger(r.floatShares) ? BigInt(r.floatShares) : null,
      outstandingShares: r.outstandingShares != null && Number.isInteger(r.outstandingShares) ? BigInt(r.outstandingShares) : null,
      gainPercent: r.gainPercent ?? null,
      industry: r.industry ?? null,
      cashBurnRisk: r.cashBurnRisk ?? null,
      dilutionRisk: r.dilutionRisk ?? null,
      offeringRisk: r.offeringRisk ?? null,
      scamRisk: r.scamRisk ?? null,
      rawText: r.rawText,
      parsedJson: r.parsedJson,
    });
  }
  // createMany + skipDuplicates = O(1) batch insert; idempotent by id.
  const res = await prisma.dilutionReport.createMany({ data, skipDuplicates: true });
  console.log(`inserted ${res.count} (skipped ${skipped} bad-date) of ${lines.length} rows`);
  await prisma.$disconnect();
}
main().catch((e) => { console.error(e); process.exit(1); });

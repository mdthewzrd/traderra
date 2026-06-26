import { prisma } from '@/lib/prisma';
async function main() {
  const [t, c, f, fa] = await Promise.all([
    prisma.secTickerCik.count(),
    prisma.dilutionCompany.count(),
    prisma.dilutionFiling.count(),
    prisma.dilutionFact.count(),
  ]);
  console.log(JSON.stringify({ tickerMap: t, companies: c, filings: f, facts: fa }));
  await prisma.$disconnect();
}
main().catch((e) => { console.error('FAIL', e); process.exit(1); });

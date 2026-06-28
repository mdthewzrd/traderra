/**
 * Form 4 (insider transaction) parser → DilutionForm4Txn rows.
 *
 * Form 4 is structured XML — the easiest of the three extraction targets. We
 * query already-synced Form 4 filings, fetch + parse each primary doc, upsert
 * rows (idempotent by reporter+date+code+securities). Dilutive signal: txnCode
 * A=award / M=exercise on Common Stock (Acquired).
 *
 * Schema VERIFIED on MULN filing 0001104659-25-099809:
 *   ownershipDocument → reportingOwner.{reportingOwnerId.{rptOwnerName,rptOwnerCik},
 *     reportingOwnerRelationship.{isOfficer,officerTitle}},
 *   nonDerivativeTable.nonDerivativeTransaction.{securityTitle.val, transactionDate.val,
 *     transactionCoding.transactionCode, transactionAmounts.{transactionShares.val,
 *     transactionPricePerShare.val}, transactionAcquiredDisposedCode.val,
 *     postTransactionAmounts.sharesOwnedFollowingTransaction.val}
 */
import { prisma } from '@/lib/prisma';
import { secFetchResponse } from '@/lib/sec/client';

const FORM4_WINDOW = 60; // parse the N most-recent Form 4 filings per sync

function filingUrl(cik: string, accessionNo: string, primaryDoc: string | null): string {
  const stripped = accessionNo.replace(/-/g, '');
  return `https://www.sec.gov/Archives/edgar/data/${Number(cik)}/${stripped}/${primaryDoc ?? ''}`;
}

/** Pull text for an element after a marker. Handles both
 *  <tag><value>x</value></tag> (SEC Form 4 standard) and <tag>x</tag> (direct). */
function textOf(xml: string, afterMarker: string, tag: string): string | null {
  const idx = xml.indexOf(afterMarker);
  if (idx < 0) return null;
  const rest = xml.slice(idx);
  const m = rest.match(new RegExp(`<${tag}>\\s*(?:<value>)?\\s*([^<]+?)\\s*(?:<\/value>)?\\s*<\/${tag}>`, 'i'));
  return m ? m[1].trim() : null;
}

export interface ParsedForm4Txn {
  reporter: string;
  reporterCik: string | null;
  isOfficer: boolean;
  txnCode: string;
  securities: number;
  price: number | null;
  afterShares: number | null;
  txnDate: Date | null;
}

export function parseForm4Xml(xml: string): ParsedForm4Txn[] {
  if (!xml.includes('<ownershipDocument')) return [];
  const reporter = textOf(xml, '<reportingOwner>', 'rptOwnerName') ?? 'Unknown';
  const reporterCik = textOf(xml, '<reportingOwnerId>', 'rptOwnerCik');
  const isOfficer = /<isOfficer>\s*(?:<value>)?1(?:<\/value>)?\s*<\/isOfficer>/i.test(xml);

  const out: ParsedForm4Txn[] = [];
  const blocks = xml.split(/<nonDerivativeTransaction>/i).slice(1);
  for (const block of blocks) {
    const closeIdx = block.indexOf('</nonDerivativeTransaction>');
    const seg = closeIdx >= 0 ? block.slice(0, closeIdx) : block;
    const code = textOf(seg, '<transactionCoding>', 'transactionCode');
    const sharesStr = textOf(seg, '<transactionAmounts>', 'transactionShares');
    const priceStr = textOf(seg, '<transactionAmounts>', 'transactionPricePerShare');
    const afterStr = textOf(seg, '<postTransactionAmounts>', 'sharesOwnedFollowingTransaction');
    const dateStr =
      (seg.match(/<transactionDate>\s*(?:<value>)?\s*([^<]+?)\s*(?:<\/value>)?\s*<\/transactionDate>/i) || [])[1]?.trim() ?? null;
    if (!code) continue;
    const securities = sharesStr ? parseFloat(sharesStr.replace(/,/g, '')) : 0;
    if (isNaN(securities)) continue;
    out.push({
      reporter,
      reporterCik,
      isOfficer,
      txnCode: code,
      securities,
      price: priceStr ? parseFloat(priceStr.replace(/,/g, '')) : null,
      afterShares: afterStr ? parseFloat(afterStr.replace(/,/g, '')) : null,
      txnDate: dateStr ? new Date(dateStr) : null,
    });
  }
  return out;
}

export interface SyncForm4Result {
  status: 'success' | 'error';
  parsed: number;
  inserted: number;
  error?: string;
}

/** Query recent Form 4 filings, fetch + parse each, persist txns. Idempotent. */
export async function syncForm4Txns(cik: string): Promise<SyncForm4Result> {
  try {
    const filings = await prisma.dilutionFiling.findMany({
      where: { cik, formType: '4' },
      orderBy: { filingDate: 'desc' },
      take: FORM4_WINDOW,
      select: { accessionNo: true, primaryDoc: true },
    });

    let inserted = 0;
    let parsed = 0;
    for (const f of filings) {
      if (!f.primaryDoc) continue;
      let xml = '';
      // Form 4 primaryDocument points to the XSL-rendered view (xslF345X05/name.xml);
      // the raw ownershipDocument XML lives at the accession root, same basename.
      const candidates = [
        f.primaryDoc,
        f.primaryDoc.replace(/^[^/]*\/([^/]+\.(?:xml|txt))$/, '$1'),
      ];
      for (const doc of candidates) {
        try {
          const res = await secFetchResponse(filingUrl(cik, f.accessionNo, doc), 'application/xml');
          if (!res.ok) continue;
          const body = await res.text();
          if (body.includes('<ownershipDocument')) { xml = body; break; }
          if (!xml) xml = body;
        } catch {
          // try next candidate
        }
      }
      if (!xml) continue;
      const txns = parseForm4Xml(xml);
      parsed += txns.length;
      for (const t of txns) {
        if (!t.txnDate) continue;
        // idempotent: skip if an identical row already exists
        const exists = await prisma.dilutionForm4Txn.findFirst({
          where: {
            cik,
            reporter: t.reporter,
            txnDate: t.txnDate,
            txnCode: t.txnCode,
            securities: t.securities,
          },
          select: { id: true },
        });
        if (exists) continue;
        await prisma.dilutionForm4Txn.create({
          data: {
            cik,
            reporter: t.reporter,
            reporterCik: t.reporterCik,
            isOfficer: t.isOfficer,
            txnCode: t.txnCode,
            securities: t.securities,
            price: t.price,
            afterShares: t.afterShares,
            txnDate: t.txnDate,
          },
        });
        inserted++;
      }
    }
    return { status: 'success', parsed, inserted };
  } catch (err) {
    return { status: 'error', parsed: 0, inserted: 0, error: err instanceof Error ? err.message : 'form4 sync failed' };
  }
}

/** Dilutive txn codes: award (A) + exercise (M) create/dilute shares. */
export const DILUTIVE_TXN_CODES = new Set(['A', 'M']);

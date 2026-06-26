/**
 * Dilution classification — maps a filing to zero or more `dilutionTags`.
 * Spec: edge-dev assets/dilution/SPEC.md §6.
 *
 * Loop-2 scope: METADATA-ONLY. Derives tags from formType + 8-K items +
 * primaryDocDescription keywords — all present in submissions.json without
 * fetching the document body. Deeper body-level detection (efts full-text
 * across ALL filers) lands in Loop 3.
 *
 * Honest about confidence: a tag here means "the metadata pattern matched",
 * not "we read the agreement." The full-text scanner (Loop 3) raises confidence.
 */
export type DilutionTag =
  | 'shelf'
  | 'shelf-effective'
  | 'offering'
  | 'atm'
  | 'equity-line'
  | 'convertible'
  | 'warrant'
  | 'reverse-split'
  | 'delisting-risk';

const SHELF_FORMS = new Set([
  'S-1', 'S-1/A', 'S-3', 'S-3/A', 'F-1', 'F-1/A', 'F-3', 'F-3/A',
]);
const OFFERING_FORMS = new Set([
  '424B1', '424B3', '424B4', '424B5', '424B7', '424B8',
]);

export interface ClassifyInput {
  formType: string;
  items?: string[] | null;
  primaryDesc?: string | null;
}

const has = (s: string | null | undefined, needle: string): boolean =>
  !!s && s.toLowerCase().includes(needle.toLowerCase());

export function classifyFiling(input: ClassifyInput): DilutionTag[] {
  const tags = new Set<DilutionTag>();
  const form = (input.formType ?? '').toUpperCase();
  const items = (input.items ?? []).map((i) => i.trim());
  const hasItem = (n: string) => items.some((i) => i === n || i.startsWith(n));
  const desc = input.primaryDesc ?? '';

  if (SHELF_FORMS.has(form)) tags.add('shelf');
  if (form === '424B5') tags.add('shelf-effective');
  if (OFFERING_FORMS.has(form)) {
    tags.add('offering');
    if (has(desc, 'warrant')) tags.add('warrant');
  }

  // 8-K item-based signals (no body fetch needed)
  if (form === '8-K') {
    if (hasItem('1.01')) {
      if (has(desc, 'at the market') || has(desc, 'atm') || has(desc, 'sales agreement'))
        tags.add('atm');
      if (has(desc, 'standby equity') || has(desc, 'sepa') || has(desc, 'equity purchase'))
        tags.add('equity-line');
      if (has(desc, 'convertible') || has(desc, 'conversion')) tags.add('convertible');
    }
    if (hasItem('3.03') && (has(desc, 'convertible') || has(desc, 'conversion')))
      tags.add('convertible');
    if (hasItem('5.03') || has(desc, 'reverse stock split') || has(desc, '1-for-'))
      tags.add('reverse-split');
    if (hasItem('3.01') || has(desc, 'deficiency') || has(desc, 'minimum bid') || has(desc, 'delisting'))
      tags.add('delisting-risk');
  }

  return [...tags];
}

export const DILUTION_TAG_META: Record<
  DilutionTag,
  { label: string; color: string; tooltip: string }
> = {
  shelf: { label: 'Shelf', color: 'amber', tooltip: 'Registration statement (S-1/S-3/F-1/F-3)' },
  'shelf-effective': { label: 'Shelf Draw', color: 'orange', tooltip: '424B5 prospectus supplement — shelf actively being drawn' },
  offering: { label: 'Offering', color: 'blue', tooltip: 'Prospectus supplement (424Bx) — securities offered' },
  atm: { label: 'ATM', color: 'red', tooltip: 'At-The-Market sales agreement' },
  'equity-line': { label: 'Equity Line', color: 'red', tooltip: 'Standby Equity Purchase Agreement (SEPA) — potentially toxic' },
  convertible: { label: 'Convertible', color: 'purple', tooltip: 'Convertible note/debt' },
  warrant: { label: 'Warrant', color: 'cyan', tooltip: 'Warrants attached to offering' },
  'reverse-split': { label: 'R/S', color: 'red', tooltip: 'Reverse stock split (8-K item 5.03)' },
  'delisting-risk': { label: 'Delist Risk', color: 'rose', tooltip: 'Exchange deficiency / delisting notice (8-K item 3.01)' },
};

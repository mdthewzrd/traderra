/**
 * SEC EDGAR HTTP client — rate-limited, retrying fetcher.
 *
 * Ported from Nexus-Terminal lib/sec/client.ts (the DB-free transport layer).
 * SEC fair-access policy: declare identity in User-Agent, max 10 req/s.
 * We serialize every request through a 100ms gap so concurrent callers stay
 * well under the ceiling, and retry 429/503 with exponential backoff.
 */

// SEC requires a contact. Override via .env SEC_USER_AGENT if it changes.
const SEC_USER_AGENT =
  process.env.SEC_USER_AGENT ?? 'traderra-research mikedurante13@gmail.com';

const MIN_REQUEST_GAP_MS = 100; // SEC limit is 10 req/s; 100ms is the safe floor
const REQUEST_GAP_BUFFER_MS = 5; // account for timer + promise handoff jitter
const REQUEST_TIMEOUT_MS = 15_000;
const MAX_RETRIES = 3;

let nextRequestAt = 0;
let pacingPromise: Promise<void> = Promise.resolve();

export class SecHttpError extends Error {
  constructor(public readonly status: number, message: string) {
    super(message);
    this.name = 'SecHttpError';
  }
}

// Serialize the rate-limit gap so concurrent callers respect the 100ms floor.
function paceRequest(): Promise<void> {
  pacingPromise = pacingPromise.then(async () => {
    const scheduledAt = Math.max(Date.now(), nextRequestAt);
    while (Date.now() < scheduledAt) {
      await new Promise((resolve) => setTimeout(resolve, scheduledAt - Date.now()));
    }
    nextRequestAt = Date.now() + MIN_REQUEST_GAP_MS + REQUEST_GAP_BUFFER_MS;
  });
  return pacingPromise;
}

async function delay(ms: number): Promise<void> {
  await new Promise((r) => setTimeout(r, ms));
}

/**
 * Core SEC fetch with retry + rate limiting.
 * Retries 429 (rate limit) and 503 (transient). Other 4xx fail fast.
 */
export async function secFetchResponse(
  url: string,
  accept = 'application/json',
): Promise<Response> {
  let lastError: unknown = null;

  for (let attempt = 0; attempt < MAX_RETRIES; attempt++) {
    await paceRequest();

    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);

    try {
      const response = await fetch(url, {
        method: 'GET',
        headers: { 'User-Agent': SEC_USER_AGENT, Accept: accept },
        signal: controller.signal,
        cache: 'no-store',
      });

      clearTimeout(timeoutId);

      if (response.status === 429 || response.status === 503) {
        lastError = new SecHttpError(
          response.status,
          `SEC ${response.status} on attempt ${attempt + 1}`,
        );
        await delay(Math.pow(2, attempt) * 1000); // 1s, 2s, 4s
        continue;
      }

      if (!response.ok) {
        throw new SecHttpError(
          response.status,
          `SEC request failed: ${response.status} ${response.statusText}`,
        );
      }

      return response;
    } catch (error) {
      clearTimeout(timeoutId);

      // Non-retryable 4xx (except 429) — fail fast.
      if (
        error instanceof SecHttpError &&
        error.status >= 400 &&
        error.status < 500 &&
        error.status !== 429
      ) {
        throw error;
      }

      lastError = error;

      if (attempt < MAX_RETRIES - 1) {
        await delay(Math.pow(2, attempt) * 1000);
      }
    }
  }

  if (lastError instanceof SecHttpError) throw lastError;
  throw new Error('SEC request failed after exhausting retries');
}

/** Fetch + parse JSON from SEC, with rate limiting and retries. */
export async function secFetchJson<T>(url: string): Promise<T> {
  const response = await secFetchResponse(url, 'application/json');
  return (await response.json()) as T;
}

// ─────────────────────────────────────────────────────────────────────────
// Filing-body fetch helpers.
// Consolidated here so every parser shares ONE url builder + ONE fallback
// path (previously filingUrl was copy-pasted into 7 files, and only
// warrant-notes had the .txt fallback — the others silently parsed a cover
// page and found nothing for inline-XBRL split filings).
// ─────────────────────────────────────────────────────────────────────────

/** URL for a filing's primary document on EDGAR. */
export function filingUrl(cik: string, accessionNo: string, primaryDoc: string | null): string {
  const stripped = accessionNo.replace(/-/g, '');
  return `https://www.sec.gov/Archives/edgar/data/${Number(cik)}/${stripped}/${primaryDoc ?? ''}`;
}

/** URL for a filing's complete submission .txt (contains EVERY document in
 *  the filing — cover, financial statements, exhibits). */
export function filingTxtUrl(cik: string, accessionNo: string): string {
  const stripped = accessionNo.replace(/-/g, '');
  return `https://www.sec.gov/Archives/edgar/data/${Number(cik)}/${stripped}/${accessionNo}.txt`;
}

/** Fetch + parse a filing, falling back to the complete-submission .txt when
 *  the primary document yields no structured data.
 *
 *  Solves the systemic 'missing warrants/dilution data' bug: inline-XBRL
 *  filers split a 10-K so primaryDoc is a cover page (e.g. CLRO: 4.8KB cover)
 *  while the warrant notes live in R*.htm. A parser reading only primaryDoc
 *  sees the cover and finds zero. The .txt always contains every document.
 *
 *  `isEmpty` lets each parser define what 'found nothing' means for its domain
 *  (0 warrants, no offering amount, etc.). */
export async function fetchAndParseFiling<T>(
  cik: string,
  accessionNo: string,
  primaryDoc: string | null,
  parse: (text: string) => T,
  isEmpty: (result: T) => boolean,
): Promise<T | null> {
  // 1. Primary document.
  try {
    const res = await secFetchResponse(filingUrl(cik, accessionNo, primaryDoc), 'text/html');
    if (res.ok) {
      const primary = parse(await res.text());
      if (!isEmpty(primary)) return primary;
    }
  } catch {
    /* fall through to .txt fallback */
  }

  // 2. Complete submission .txt — always contains every document in the filing.
  try {
    const res = await secFetchResponse(filingTxtUrl(cik, accessionNo), 'text/plain');
    if (res.ok) return parse(await res.text());
  } catch {
    /* give up */
  }
  return null;
}

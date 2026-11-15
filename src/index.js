// Client for the prizepicksapi.com REST API (https://prizepicksapi.com/docs). Zero dependencies; Node 18+ fetch.
// Independent service operated by Stunning Couches LLC; not affiliated with PrizePicks.

export const DEFAULT_BASE_URL = 'https://prizepicksapi.com';
const USER_AGENT = 'prizepicksapi-js/0.1.0';

export class PrizePicksAPIError extends Error {
  constructor(status, code, message, {retryAfter = null, body = null} = {}) {
    super(`${status} ${code}: ${message}`);
    this.name = 'PrizePicksAPIError';
    this.status = status;
    this.code = code;
    this.retryAfter = retryAfter;
    this.body = body;
  }
}

export class RateLimitError extends PrizePicksAPIError {
  constructor(...args) { super(...args); this.name = 'RateLimitError'; }
}

const env = (name) => (typeof process !== 'undefined' && process.env ? process.env[name] : undefined);

function query(params = {}) {
  const q = new URLSearchParams();
  for (const [k, v] of Object.entries(params)) {
    if (v === undefined || v === null) continue;
    q.set(k, Array.isArray(v) ? v.join(',') : String(v));
  }
  const s = q.toString();
  return s ? `?${s}` : '';
}

export class PrizePicksAPI {
  /**
   * @param {object} [opts]
   * @param {string} [opts.apiKey] defaults to process.env.PRIZEPICKS_API_KEY
   * @param {string} [opts.baseUrl]
   * @param {string} [opts.userRequest] optional X-User-Request: one sentence about the task, no personal data
   * @param {number} [opts.timeoutMs]
   * @param {number} [opts.maxRetries] retries for per-minute 429s and 503s
   * @param {typeof fetch} [opts.fetch]
   * @param {(ms:number)=>Promise<void>} [opts.sleep]
   */
  constructor(opts = {}) {
    this.apiKey = opts.apiKey ?? env('PRIZEPICKS_API_KEY');
    this.baseUrl = (opts.baseUrl ?? DEFAULT_BASE_URL).replace(/\/$/, '');
    this.userRequest = opts.userRequest;
    this.timeoutMs = opts.timeoutMs ?? 30000;
    this.maxRetries = opts.maxRetries ?? 2;
    this._fetch = opts.fetch ?? globalThis.fetch;
    this._sleep = opts.sleep ?? ((ms) => new Promise((r) => setTimeout(r, ms)));
  }

  async request(path, params = {}, {auth = true, raw = false} = {}) {
    const url = `${this.baseUrl}${path}${query(params)}`;
    const headers = {Accept: raw ? 'text/csv' : 'application/json', 'User-Agent': USER_AGENT};
    if (auth) {
      if (!this.apiKey) throw new PrizePicksAPIError(401, 'INVALID_API_KEY', 'Set PRIZEPICKS_API_KEY or pass apiKey. Free keys: https://prizepicksapi.com/sign-up. The demo* methods need no key.');
      headers.Authorization = `Bearer ${this.apiKey}`;
      if (this.userRequest) headers['X-User-Request'] = encodeURI(this.userRequest);
    }
    for (let attempt = 0; ; attempt++) {
      const res = await this._fetch(url, {headers, signal: AbortSignal.timeout(this.timeoutMs)});
      if (res.ok || res.status === 304) {
        if (raw) return res.text();
        const text = await res.text();
        return text ? JSON.parse(text) : null;
      }
      const err = await toError(res);
      const retryable = (err instanceof RateLimitError && err.code !== 'MONTHLY_QUOTA_EXCEEDED') || res.status === 503;
      if (retryable && attempt < this.maxRetries) {
        await this._sleep(Math.min(err.retryAfter ?? 2 ** (attempt + 1), 60) * 1000);
        continue;
      }
      throw err;
    }
  }

  /** Yield every row across pages by following meta.next_cursor. */
  async *paginate(path, params = {}, {auth = true, maxPages = Infinity} = {}) {
    const p = {...params};
    for (let pages = 0; pages < maxPages; pages++) {
      const page = await this.request(path, p, {auth});
      yield* page?.data ?? [];
      const cursor = page?.meta?.next_cursor;
      if (!cursor) return;
      p.cursor = cursor;
    }
  }

  // keyless demo (fictional rows, live schema)
  demoProjections(params) { return this.request('/api/v1/demo/projections', params, {auth: false}); }
  demoHistory(id, params) { return this.request(`/api/v1/demo/projections/${encodeURIComponent(id)}/history`, params, {auth: false}); }
  demoChanges(params) { return this.request('/api/v1/demo/changes', params, {auth: false}); }
  demoPayouts() { return this.request('/api/v1/demo/payouts', {}, {auth: false}); }
  demoCoverage() { return this.request('/api/v1/demo/coverage', {}, {auth: false}); }
  demoExportCsv(params) { return this.request('/api/v1/demo/export', params, {auth: false, raw: true}); }
  creditCost(path) { return this.request('/api/v1/credit-costs', {path}, {auth: false}); }

  // live (API key)
  projections(params) { return this.request('/api/v1/projections', params); }
  iterProjections(params, opts) { return this.paginate('/api/v1/projections', params, opts); }
  history(id, params) { return this.request(`/api/v1/projections/${encodeURIComponent(id)}/history`, params); }
  trending(params) { return this.request('/api/v1/projections/trending', params); }
  changes(params) { return this.request('/api/v1/changes', params); }
  board(asOf, params = {}) { return this.request('/api/v1/board', {as_of: asOf, ...params}); }
  results(params) { return this.request('/api/v1/results', params); }
  hitRates(params) { return this.request('/api/v1/hit-rates', params); }
  gameLogs(params) { return this.request('/api/v1/game-logs', params); }
  trainingSet(params) { return this.request('/api/v1/training-set', params); }
  coverage() { return this.request('/api/v1/coverage'); }
  payouts() { return this.request('/api/v1/payouts'); }
  compare(params) { return this.request('/api/v1/compare', params); }
  players(params) { return this.request('/api/v1/players', params); }
  fixtures(params) { return this.request('/api/v1/fixtures', params); }
  exportCsv(params) { return this.request('/api/v1/export', params, {raw: true}); }
}

async function toError(res) {
  let code = 'HTTP_ERROR', message = `HTTP ${res.status}`, body = null;
  try {
    body = JSON.parse(await res.text());
    code = body?.error?.code ?? code;
    message = body?.error?.message ?? message;
  } catch { /* non-JSON body */ }
  const ra = Number(res.headers.get('retry-after'));
  const retryAfter = Number.isFinite(ra) && res.headers.get('retry-after') !== null ? ra : null;
  const Cls = res.status === 429 ? RateLimitError : PrizePicksAPIError;
  return new Cls(res.status, code, message, {retryAfter, body});
}

export default PrizePicksAPI;

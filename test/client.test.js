import {test} from 'node:test';
import assert from 'node:assert/strict';
import {PrizePicksAPI, PrizePicksAPIError, RateLimitError} from '../src/index.js';

function fakeFetch(responses) {
  const calls = [];
  const fn = async (url, init) => {
    calls.push({url: new URL(url), headers: init.headers});
    const [status, body, headers = {}] = responses.shift();
    return new Response(typeof body === 'string' ? body : JSON.stringify(body), {status, headers});
  };
  fn.calls = calls;
  return fn;
}
const page = (data, cursor = null) => ({data, meta: {next_cursor: cursor}});

test('demo calls need no key', async () => {
  const f = fakeFetch([[200, page([{id: 'demo_nba_001'}])]]);
  const out = await new PrizePicksAPI({apiKey: '', fetch: f}).demoProjections({league: 'NBA', limit: 2});
  assert.equal(out.data[0].id, 'demo_nba_001');
  assert.equal(f.calls[0].url.pathname, '/api/v1/demo/projections');
  assert.equal(f.calls[0].headers.Authorization, undefined);
});

test('live calls send bearer, X-User-Request and joined arrays', async () => {
  const f = fakeFetch([[200, page([])]]);
  await new PrizePicksAPI({apiKey: 'k', userRequest: 'NBA dashboard check', fetch: f}).projections({league: ['NBA', 'NFL'], tier: undefined});
  assert.equal(f.calls[0].headers.Authorization, 'Bearer k');
  assert.equal(f.calls[0].headers['X-User-Request'], 'NBA%20dashboard%20check');
  assert.equal(f.calls[0].url.search, '?league=NBA%2CNFL');
});

test('missing key throws before any request', async () => {
  const f = fakeFetch([]);
  await assert.rejects(new PrizePicksAPI({apiKey: '', fetch: f}).coverage(), (e) => e.code === 'INVALID_API_KEY');
  assert.equal(f.calls.length, 0);
});

test('paginate follows next_cursor', async () => {
  const f = fakeFetch([[200, page([{id: 1}, {id: 2}], 'c1')], [200, page([{id: 3}])]]);
  const ids = [];
  for await (const p of new PrizePicksAPI({apiKey: 'k', fetch: f}).iterProjections({league: 'NBA'})) ids.push(p.id);
  assert.deepEqual(ids, [1, 2, 3]);
  assert.equal(f.calls[1].url.searchParams.get('cursor'), 'c1');
  assert.equal(f.calls[1].url.searchParams.get('league'), 'NBA');
});

test('error carries the API code', async () => {
  const f = fakeFetch([[401, {error: {code: 'INVALID_API_KEY', message: 'bad key'}}]]);
  await assert.rejects(new PrizePicksAPI({apiKey: 'x', fetch: f}).payouts(), (e) => e instanceof PrizePicksAPIError && e.status === 401 && e.code === 'INVALID_API_KEY');
});

test('per-minute 429 retries after Retry-After; monthly quota does not', async () => {
  const slept = [];
  const sleep = async (ms) => { slept.push(ms); };
  const f = fakeFetch([[429, {error: {code: 'RATE_LIMIT_EXCEEDED', message: 'x'}}, {'Retry-After': '7'}], [200, page([])]]);
  await new PrizePicksAPI({apiKey: 'k', fetch: f, sleep}).changes({league: 'NBA'});
  assert.deepEqual(slept, [7000]);
  const g = fakeFetch([[429, {error: {code: 'MONTHLY_QUOTA_EXCEEDED', message: 'x'}}, {'Retry-After': '60'}]]);
  await assert.rejects(new PrizePicksAPI({apiKey: 'k', fetch: g, sleep}).projections(), RateLimitError);
  assert.equal(g.calls.length, 1);
});

test('csv export returns text', async () => {
  const f = fakeFetch([[200, 'id,player\n1,A\n']]);
  const csv = await new PrizePicksAPI({apiKey: '', fetch: f}).demoExportCsv({league: 'NBA'});
  assert.ok(csv.startsWith('id,player'));
});

test('live keyless demo', {skip: !process.env.PRIZEPICKS_LIVE_TEST}, async () => {
  const out = await new PrizePicksAPI({apiKey: ''}).demoProjections({league: 'NBA', limit: 2});
  assert.equal(out.meta.is_demo, true);
  assert.equal(out.data.length, 2);
});

# PrizePicks API for JavaScript and TypeScript: prizepicksapi

The PrizePicks API client for Node.js, TypeScript, Deno and Bun. `npm install prizepicksapi` and read live PrizePicks projections (player-prop lines), goblin and demon tiers, line history and graded results with typed responses.

[Website](https://prizepicksapi.com/?utm_source=github&utm_medium=readme&utm_campaign=prizepicksapi-js) | [Docs](https://prizepicksapi.com/docs?utm_source=github&utm_medium=readme&utm_campaign=prizepicksapi-js) | [Free API key](https://prizepicksapi.com/sign-up?utm_source=github&utm_medium=readme&utm_campaign=prizepicksapi-js) | [Pricing](https://prizepicksapi.com/pricing?utm_source=github&utm_medium=readme&utm_campaign=prizepicksapi-js) | [All SDKs](https://prizepicksapi.com/sdks?utm_source=github&utm_medium=readme&utm_campaign=prizepicksapi-js)

Also for prizepicksapi.com: [Python: `pip install prizepicksapi`](https://github.com/prizepicksapi/prizepicksapi-python) | [MCP server: `npx -y prizepicksapi-mcp`](https://github.com/prizepicksapi/prizepicksapi-mcp)

Client for [prizepicksapi.com](https://prizepicksapi.com/?utm_source=github&utm_medium=readme&utm_campaign=prizepicksapi-js): live PrizePicks player-prop lines, goblin and demon tiers per selection, recorded line history, the change feed, graded results and game logs. Zero dependencies, ESM, TypeScript types included, Node 18+ (also Deno and Bun).

prizepicksapi.com is an independent service operated by Stunning Couches LLC. It is not affiliated with or endorsed by PrizePicks.

```bash
npm install prizepicksapi
```

## Try it with no key

`demo*` methods call the keyless demo endpoints: fictional rows (`is_demo: true`) with the live schema.

```js
import {PrizePicksAPI} from 'prizepicksapi';

const api = new PrizePicksAPI({apiKey: ''});
const {data} = await api.demoProjections({league: 'NBA', limit: 3});
for (const p of data) console.log(p.player.name, p.market.stat, p.line, p.selections.map((s) => s.tier).join('/'));

const coverage = await api.demoCoverage();
console.log(coverage.data.map((l) => `${l.league}:${l.projection_count}`).join(' '));
```

Output on 15 Nov 2026:

```
Jordan Ellis Points 27.5 standard/standard
Marcus Cole Rebounds 8.5 standard/standard
Devin Brooks Assists 6.5 standard/standard
NBA:8 NFL:2 NHL:2
```

## Live data

Get a free key (100 credits a month, no card) at https://prizepicksapi.com/sign-up?utm_source=github&utm_medium=readme&utm_campaign=prizepicksapi-js. Keep it on your server; never ship it to a browser.

```js
import {PrizePicksAPI, RateLimitError} from 'prizepicksapi';

const api = new PrizePicksAPI({
  apiKey: process.env.PRIZEPICKS_API_KEY,
  userRequest: 'PrizePicks optimizer: refresh NBA board', // optional X-User-Request header
});

// Every current NBA line, following cursors
for await (const p of api.iterProjections({league: 'NBA', limit: 200})) {
  console.log(p.player.name, p.market.stat, p.line);
}

// Goblins only, compact rows
const goblins = await api.projections({league: 'NBA', tier: 'goblin', view: 'compact', limit: 1000});

// Recorded moves for one projection, and the change feed
const history = await api.history(goblins.data[0].id);
const feed = await api.changes({league: 'NBA', limit: 200}); // persist feed.meta.next_cursor

// Graded results, the board at a past moment, sportsbook comparison, CSV
const graded = await api.results({league: 'NBA', date: '2026-11-14'});
const past = await api.board('2026-11-10T23:00:00Z', {league: 'NBA'});
const priced = await api.compare({league: 'NBA', view: 'compact', priced_only: true, limit: 100});
const csv = await api.exportCsv({league: 'NBA', limit: 200});

try {
  await api.projections({league: 'NBA'});
} catch (e) {
  if (e instanceof RateLimitError) console.log('limited', e.code, e.retryAfter);
  else throw e;
}
```

Errors are `PrizePicksAPIError` with `status`, the API's stable `code` and `retryAfter`. Per-minute 429s (`RATE_LIMIT_EXCEEDED`) and 503s retry up to `maxRetries` times using `Retry-After`; `MONTHLY_QUOTA_EXCEEDED` throws at once.

Reference: https://prizepicksapi.com/docs?utm_source=github&utm_medium=readme&utm_campaign=prizepicksapi-js, https://prizepicksapi.com/openapi.json. Plans: https://prizepicksapi.com/pricing?utm_source=github&utm_medium=readme&utm_campaign=prizepicksapi-js.

## Tests

```bash
npm test                          # mocked fetch
PRIZEPICKS_LIVE_TEST=1 npm test   # also calls the keyless demo endpoint
```

## License

MIT.

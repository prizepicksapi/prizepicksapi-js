export declare const DEFAULT_BASE_URL: string;

export type Params = Record<string, string | number | boolean | Array<string | number> | null | undefined>;

export interface Selection { side: 'more' | 'less'; available: boolean | null; tier: 'standard' | 'goblin' | 'demon' | null; payout_multiplier: number | null }
export interface Projection {
  id: string;
  source_projection_id: string;
  player: { id: string; name: string; team: string | null; position: string | null };
  league: string;
  event: { id: string; opponent: string | null; starts_at: string | null };
  market: { id: string; stat: string; period: string };
  line: number;
  selections: Selection[];
  status: string;
  observed_at: string;
  line_context?: { opening_line: number | null; previous_line: number | null; line_moves: number; last_moved_at: string | null; closing_line: number | null; closed_at: string | null };
  is_demo?: boolean;
  [key: string]: unknown;
}
export interface Page<T = Record<string, unknown>> { data: T[]; meta: { next_cursor?: string | null; [key: string]: unknown } }

export interface ClientOptions {
  apiKey?: string;
  baseUrl?: string;
  /** Optional X-User-Request header: one sentence about the task, no personal data. */
  userRequest?: string;
  timeoutMs?: number;
  maxRetries?: number;
  fetch?: typeof fetch;
  sleep?: (ms: number) => Promise<void>;
}

export declare class PrizePicksAPIError extends Error {
  status: number; code: string; retryAfter: number | null; body: unknown;
  constructor(status: number, code: string, message: string, extra?: { retryAfter?: number | null; body?: unknown });
}
export declare class RateLimitError extends PrizePicksAPIError {}

export declare class PrizePicksAPI {
  constructor(opts?: ClientOptions);
  apiKey?: string; baseUrl: string; userRequest?: string;
  request<T = any>(path: string, params?: Params, opts?: { auth?: boolean; raw?: boolean }): Promise<T>;
  paginate<T = any>(path: string, params?: Params, opts?: { auth?: boolean; maxPages?: number }): AsyncGenerator<T>;
  demoProjections(params?: Params): Promise<Page<Projection>>;
  demoHistory(id: string, params?: Params): Promise<Page>;
  demoChanges(params?: Params): Promise<Page>;
  demoPayouts(): Promise<Page>;
  demoCoverage(): Promise<Page>;
  demoExportCsv(params?: Params): Promise<string>;
  creditCost(path: string): Promise<{ quoted_credits: number; [key: string]: unknown }>;
  projections(params?: Params): Promise<Page<Projection>>;
  iterProjections(params?: Params, opts?: { maxPages?: number }): AsyncGenerator<Projection>;
  history(id: string, params?: Params): Promise<Page>;
  trending(params?: Params): Promise<Page>;
  changes(params?: Params): Promise<Page>;
  board(asOf: string, params?: Params): Promise<Page<Projection>>;
  results(params?: Params): Promise<Page>;
  hitRates(params?: Params): Promise<Page>;
  gameLogs(params?: Params): Promise<Page>;
  trainingSet(params?: Params): Promise<Page>;
  coverage(): Promise<Page>;
  payouts(): Promise<Page>;
  compare(params?: Params): Promise<Page>;
  players(params?: Params): Promise<Page>;
  fixtures(params?: Params): Promise<Page>;
  exportCsv(params?: Params): Promise<string>;
}
export default PrizePicksAPI;

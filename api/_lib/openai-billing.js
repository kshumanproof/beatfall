// Accounting only. No prompts, customer credits, or provider requests change.
// Rates: https://developers.openai.com/api/docs/models/gpt-6.1-sol
import { OPENAI_PRICE_IN, OPENAI_PRICE_OUT, OPENAI_PRICE_CACHED,
  OPENAI_PRICE_CACHE_WRITE } from './core.js';
export function openAICost(usage, tier = 'default') {
  const valid = n => Number.isSafeInteger(n) && n >= 0;
  const tin = valid(usage?.input_tokens) ? usage.input_tokens : 0;
  const tout = valid(usage?.output_tokens) ? usage.output_tokens : 0;
  const d = usage?.input_tokens_details;
  const cached = d?.cached_tokens, written = d?.cache_write_tokens;
  const complete = valid(usage?.input_tokens) && valid(usage?.output_tokens) && valid(cached) && valid(written)
    && cached + written <= tin && !d?.cache_write_12h_tokens
    && ['default', 'standard', 'auto'].includes(tier);
  // Missing/unsupported details must not break a completed story request.
  // Preserve a labelled list-price estimate rather than pretending it is exact.
  if (!complete) return {
    costMicros: Math.round(tin * OPENAI_PRICE_IN + tout * OPENAI_PRICE_OUT),
    costDetails: { basis: 'list_price_fallback', tier, version: '2026-10-09',
      cached_tokens: valid(cached) ? cached : null,
      cache_write_tokens: valid(written) ? written : null }
  };
  const inputMultiplier = tin > 272000 ? 2 : 1;
  const outputMultiplier = tin > 272000 ? 1.5 : 1;
  return {
    costMicros: Math.round(((tin - cached - written) * OPENAI_PRICE_IN + cached * OPENAI_PRICE_CACHED
      + written * OPENAI_PRICE_CACHE_WRITE) * inputMultiplier + tout * OPENAI_PRICE_OUT * outputMultiplier),
    costDetails: { basis: 'usage_breakdown', tier, version: '2026-10-09',
      ordinary_tokens: tin - cached - written, cached_tokens: cached,
      cache_write_tokens: written, reasoning_tokens: usage.output_tokens_details?.reasoning_tokens || 0,
      input_multiplier: inputMultiplier, output_multiplier: outputMultiplier,
      rates_per_million: { input: OPENAI_PRICE_IN, cached: OPENAI_PRICE_CACHED,
        cache_write: OPENAI_PRICE_CACHE_WRITE, output: OPENAI_PRICE_OUT } }
  };
}

const DAY = 86400000;
export const utcDay = ms => new Date(Math.floor(ms / DAY) * DAY).toISOString().slice(0, 10);
const missingSettings = () => ['OPENAI_ADMIN_KEY', 'OPENAI_PROJECT_ID']
  .filter(k => !process.env[k]?.trim());

// Refresh the last seven complete UTC days, so late billing updates replace
// earlier reports. Upsert changes ONLY reported daily totals, never usage.
export async function syncOpenAICosts(db, now = Date.now()) {
  const missing = missingSettings();
  if (missing.length) return { ok: false, state: 'not_configured', missing };
  const project = process.env.OPENAI_PROJECT_ID.trim();
  const end = Math.floor(now / DAY) * DAY, start = end - 7 * DAY;
  const checked = new Date(now).toISOString();
  let result;
  try {
    const byDay = new Map(), cursors = new Set();
    let page = null;
    // One shared timeout bounds the whole pagination operation.
    const signal = AbortSignal.timeout(12000);
    for (let i = 0; ; i++) {
      if (i >= 10) throw new Error('pagination_limit');
      const url = new URL('https://api.openai.com/v1/organization/costs');
      url.searchParams.set('start_time', String(start / 1000));
      url.searchParams.set('end_time', String(end / 1000));
      url.searchParams.set('bucket_width', '1d');
      url.searchParams.set('limit', '7');
      url.searchParams.append('project_ids', project);
      url.searchParams.append('group_by', 'project_id');
      if (page) url.searchParams.set('page', page);
      const response = await fetch(url, { signal,
        headers: { authorization: 'Bearer ' + process.env.OPENAI_ADMIN_KEY } });
      // Never store or display a provider error body: it can contain credentials.
      if (!response.ok) throw new Error('http_' + response.status);
      const payload = await response.json();
      if (!Array.isArray(payload.data) || typeof payload.has_more !== 'boolean')
        throw new Error('invalid_report');
      for (const bucket of payload.data) {
        const ms = bucket.start_time * 1000;
        if (!Number.isSafeInteger(ms) || ms < start || ms >= end || ms % DAY
          || bucket.end_time * 1000 !== ms + DAY || !Array.isArray(bucket.results))
          throw new Error('invalid_bucket');
        const day = utcDay(ms);
        if (byDay.has(day)) throw new Error('duplicate_day');
        let amount = 0;
        for (const row of bucket.results) {
          if (row.object !== 'organization.costs.result' || row.project_id !== project
            || row.amount?.currency !== 'usd' || typeof row.amount.value !== 'number'
            || !Number.isFinite(row.amount.value)) throw new Error('invalid_amount_or_scope');
          amount += row.amount.value;
        }
        // An explicitly returned empty bucket means no reported charges yet.
        // Omitted days remain unavailable, never invented as zero.
        byDay.set(day, { day, project_id: project, amount_usd: amount,
          fetched_at: checked });
      }
      if (!payload.has_more) break;
      page = payload.next_page;
      if (typeof page !== 'string' || !page || cursors.has(page)) throw new Error('invalid_cursor');
      cursors.add(page);
    }
    if (!byDay.size) throw new Error('empty_report');
    const { error } = await db.from('provider_daily_costs')
      .upsert([...byDay.values()], { onConflict: 'project_id,day' });
    if (error) throw new Error('save_failed');
    result = { ok: true, state: 'updated', days: byDay.size, checked_at: checked };
  } catch (e) {
    const safe = /^(http_\d+|pagination_limit|invalid_\w+|duplicate_day|empty_report|save_failed)$/.test(e?.message || '');
    result = { ok: false, state: 'failed', reason: safe ? e.message : 'report_unavailable', checked_at: checked };
  }
  try {
    const { error } = await db.from('operator_meta').upsert({ key: 'openai_cost_sync',
      value: JSON.stringify(result) }, { onConflict: 'key' });
    if (error) return { ...result, ok: false, state: 'failed', reason: 'status_save_failed' };
  } catch { return { ...result, ok: false, state: 'failed', reason: 'status_save_failed' }; }
  return result;
}

export async function billingComparison(db, since, now = Date.now()) {
  const missing = missingSettings();
  if (missing.length) return { state: 'not_configured', missing, days: [] };
  const project = process.env.OPENAI_PROJECT_ID.trim();
  // Drop the partial first day and today's unfinished day from comparison.
  const first = utcDay(Math.ceil(Date.parse(since) / DAY) * DAY), last = utcDay(now);
  try {
    const reports = await db.from('provider_daily_costs').select('day,amount_usd,fetched_at')
      .eq('project_id', project).gte('day', first).lt('day', last).order('day', { ascending: false });
    const status = await db.from('operator_meta').select('value').eq('key', 'openai_cost_sync').maybeSingle();
    if (reports.error || status.error) return { state: 'unavailable', days: [] };
    let sync = null;
    try { sync = JSON.parse(status.data?.value || 'null'); } catch { /* malformed status */ }
    const totals = new Map();
    for (let from = 0; ; from += 1000) {
      const page = await db.from('usage')
        .select('id,provider,model,cost_micros,cost_details,status,created_at')
        .gte('created_at', first + 'T00:00:00.000Z').lt('created_at', last + 'T00:00:00.000Z')
        .order('id', { ascending: true }).range(from, from + 999);
      if (page.error) return { state: 'unavailable', days: [] };
      for (const row of page.data || []) {
        if (row.provider !== 'openai' && !(row.provider == null && row.model?.startsWith('gpt-'))) continue;
        const day = row.created_at.slice(0, 10);
        const t = totals.get(day) || { micros: 0, calls: 0, legacy: 0, unknown: 0 };
        t.micros += Number(row.cost_micros || 0); t.calls++;
        if (row.cost_details?.basis !== 'usage_breakdown') t.legacy++;
        if (row.status === 'unknown') t.unknown++;
        totals.set(day, t);
      }
      if ((page.data || []).length < 1000) break;
      if (from >= 99000) return { state: 'unavailable', days: [] };
    }
    const days = (reports.data || []).map(r => {
      const t = totals.get(r.day) || { micros: 0, calls: 0, legacy: 0, unknown: 0 };
      return { day: r.day, reported_usd: Number(r.amount_usd), calculated_usd: t.micros / 1e6,
        difference_usd: Number(r.amount_usd) - t.micros / 1e6,
        calls: t.calls, legacy_calls: t.legacy, unknown_calls: t.unknown, fetched_at: r.fetched_at };
    });
    const newest = days[0];
    return { state: !newest ? 'waiting' : sync?.ok === false ? 'failed'
      : newest.day !== utcDay(now - DAY) || Date.parse(newest.fetched_at) < now - 36 * 3600000 ? 'stale' : 'ready',
      sync, days, project_id: project };
  } catch { return { state: 'unavailable', days: [] }; }
}

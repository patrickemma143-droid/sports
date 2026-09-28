import { json, safeProviderError } from './shared.mjs';

function cleanMarkets(rows, sport) {
  const result = [];
  for (const row of rows || []) {
    const bookmakers = Array.isArray(row.bookmakers) ? row.bookmakers : [];
    for (const bookmaker of bookmakers) {
      for (const bet of bookmaker.bets || []) {
        const label = String(bet.name || `Market ${bet.id || ''}`).trim();
        const keyName = label.toLowerCase();
        const isUseful = /winner|money.?line|match result|1x2|over.?under|total|both teams to score|btts|handicap|spread/.test(keyName);
        if (!isUseful) continue;
        const odds = (bet.values || []).map(value => ({ name: String(value.value || value.name || ''), price: Number(value.odd || value.price), point: value.handicap == null ? null : Number(value.handicap) })).filter(value => value.name && Number.isFinite(value.price) && value.price > 1);
        if (odds.length < 2) continue;
        const key = /both teams to score|btts/.test(keyName) ? 'btts' : /over.?under|total/.test(keyName) ? 'totals' : /handicap|spread/.test(keyName) ? 'spread' : 'h2h';
        result.push({ key: `${key}-${sport}-${bet.id || result.length}`, type: key, label, bookmaker: bookmaker.name || 'API-Sports bookmaker', updatedAt: bookmaker.update || bookmaker.updated_at || null, odds });
      }
    }
  }
  return result;
}

export default async function handler(request) {
  if (request.method !== 'GET') return json({ error: 'Only GET requests are supported.' }, 405);
  const url = new URL(request.url);
  const sport = url.searchParams.get('sport') || '';
  const providerId = url.searchParams.get('game') || '';
  const phase = url.searchParams.get('phase') || 'upcoming';
  if (!['football', 'basketball'].includes(sport) || !/^\d{1,12}$/.test(providerId) || !['live', 'upcoming'].includes(phase)) {
    return json({ error: 'Choose a provider-listed football or basketball game to check its published odds.' }, 400);
  }
  if (sport === 'basketball' && phase === 'live') return json({ error: 'The connected basketball odds endpoint only provides pre-game odds.' }, 200, 'no-store');
  const key = process.env.API_SPORTS_KEY;
  if (!key) return json({ error: 'API-Sports is not configured for this deployment.' }, 503);
  const base = sport === 'football' ? 'https://v3.football.api-sports.io' : 'https://v1.basketball.api-sports.io';
  const path = sport === 'football' && phase === 'live' ? '/odds/live' : '/odds';
  const parameter = sport === 'football' ? 'fixture' : 'game';
  const endpoint = new URL(`${base}${path}`);
  endpoint.search = new URLSearchParams({ [parameter]: providerId, page: '1' }).toString();
  try {
    const response = await fetch(endpoint, { headers: { 'x-apisports-key': key, Accept: 'application/json' }, signal: AbortSignal.timeout(12000) });
    const payload = await response.json().catch(() => ({}));
    const hasErrors = payload?.errors && (Array.isArray(payload.errors) ? payload.errors.length : Object.keys(payload.errors).length);
    if (!response.ok || hasErrors) return json({ error: safeProviderError(payload, key, `API-Sports odds returned HTTP ${response.status}.`), requestsRemaining: response.headers.get('x-ratelimit-requests-remaining') }, response.status === 429 ? 429 : 502);
    const markets = cleanMarkets(Array.isArray(payload.response) ? payload.response : [], sport);
    return json({ sport, providerId, phase, source: 'API-Sports', updatedAt: new Date().toISOString(), requestsRemaining: response.headers.get('x-ratelimit-requests-remaining'), markets }, 200, 'public, max-age=0, s-maxage=600, stale-while-revalidate=600');
  } catch {
    return json({ error: 'Could not reach the sports data provider. Try again shortly.' }, 502);
  }
}

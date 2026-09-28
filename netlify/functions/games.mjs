import { json, kampalaDate, normalizeGame, safeProviderError } from './shared.mjs';

export default async function handler(request) {
  if (request.method !== 'GET') return json({ error: 'Only GET requests are supported.' }, 405);
  const url = new URL(request.url);
  const sport = url.searchParams.get('sport') || '';
  const phase = url.searchParams.get('phase') || 'upcoming';
  const date = url.searchParams.get('date') || kampalaDate();
  if (!['football', 'basketball'].includes(sport) || !['live', 'upcoming'].includes(phase) || !/^\d{4}-\d{2}-\d{2}$/.test(date)) {
    return json({ error: 'Use sport=football|basketball, phase=live|upcoming, and an optional YYYY-MM-DD date.' }, 400);
  }
  const key = process.env.API_SPORTS_KEY;
  if (!key) return json({ error: 'API-Sports is not configured for this deployment.' }, 503);

  if (phase === 'upcoming') {
    const today = kampalaDate();
    const latest = new Date(`${today}T00:00:00+03:00`); latest.setDate(latest.getDate() + 30);
    const latestDate = kampalaDate(latest);
    if (date < today || date > latestDate) return json({ error: `Upcoming dates are limited to today through ${latestDate}.` }, 400);
  }

  const host = sport === 'football' ? 'https://v3.football.api-sports.io' : 'https://v1.basketball.api-sports.io';
  // API-Basketball v1 has no `live` query parameter. Fetch today's games and
  // filter by the returned game status; API-Football supports live=all.
  const params = phase === 'live' && sport === 'football' ? { live: 'all', timezone: 'Africa/Kampala' } : { date, timezone: 'Africa/Kampala' };
  const endpoint = new URL(`${host}/${sport === 'football' ? 'fixtures' : 'games'}`);
  endpoint.search = new URLSearchParams(params).toString();
  try {
    const response = await fetch(endpoint, { headers: { 'x-apisports-key': key, 'Accept': 'application/json' }, signal: AbortSignal.timeout(12000) });
    const payload = await response.json().catch(() => ({}));
    const providerError = payload?.errors && (Array.isArray(payload.errors) ? payload.errors.length : Object.keys(payload.errors).length);
    if (!response.ok || providerError) {
      const status = response.status === 429 ? 429 : 502;
      return json({ error: safeProviderError(payload, key, `Sports data provider returned HTTP ${response.status}.`), requestsRemaining: response.headers.get('x-ratelimit-requests-remaining') }, status);
    }
    const events = (Array.isArray(payload.response) ? payload.response : []).map(row => normalizeGame(row, sport)).filter(game => game && game.phase === phase);
    const updatedAt = new Date().toISOString();
    const cache = phase === 'live' ? 'public, max-age=0, s-maxage=15, stale-while-revalidate=15' : 'public, max-age=0, s-maxage=300, stale-while-revalidate=300';
    return json({ sport, phase, date, source: 'API-Sports', updatedAt, requestsRemaining: response.headers.get('x-ratelimit-requests-remaining'), events }, 200, cache);
  } catch {
    return json({ error: 'Could not reach the sports data provider. Try again shortly.' }, 502);
  }
}

import { json, safeProviderError } from './shared.mjs';

const allowed = new Set(['soccer_epl', 'soccer_germany_bundesliga', 'soccer_france_ligue_one', 'soccer_uefa_champs_league', 'soccer_uefa_nations_league', 'basketball_nba', 'basketball_euroleague']);
const marketLabels = { h2h: 'Match result', totals: 'Total goals/points', btts: 'Both teams to score' };

function shapeEvent(event, sport, regions) {
  const markets = Object.keys(marketLabels).flatMap(key => {
    const book = (event.bookmakers || []).find(item => item.markets?.some(market => market.key === key));
    const market = book?.markets?.find(item => item.key === key);
    if (!market) return [];
    return [{ key, label: marketLabels[key], bookmaker: book.title, updatedAt: market.last_update || book.last_update || null, odds: (market.outcomes || []).map(outcome => ({ name: outcome.name, price: outcome.price, point: outcome.point ?? null })) }];
  });
  const result = markets.find(market => market.key === 'h2h');
  return { id: `odds-${event.id}`, oddsEventId: event.id, sportKey: sport, live: false, sport: sport.startsWith('basketball') ? 'basketball' : 'football', league: event.sport_title, time: event.commence_time, home: event.home_team, away: event.away_team, homeBadge: event.home_team?.slice(0, 1) || '?', awayBadge: event.away_team?.slice(0, 1) || '?', bookmaker: result?.bookmaker || null, region: regions, odds: result?.odds || [], markets, updatedAt: result?.updatedAt || null };
}

export default async function handler(request) {
  if (request.method !== 'GET') return json({ error: 'Only GET requests are supported.' }, 405);
  const key = process.env.THE_ODDS_API_KEY;
  if (!key) return json({ error: 'The odds reference provider is not configured for this deployment.' }, 503);
  const url = new URL(request.url);
  const sport = url.searchParams.get('sport') || '';
  if (!allowed.has(sport)) return json({ error: 'This competition is not in the current odds-provider allowlist.' }, 400);

  const regions = (process.env.ODDS_REGIONS || 'eu').split(',').map(value => value.trim()).filter(value => ['us', 'us2', 'uk', 'eu', 'au'].includes(value)).join(',') || 'eu';
  const eventId = url.searchParams.get('eventId');
  if (eventId && (!/^[a-zA-Z0-9-]{1,100}$/.test(eventId) || sport.startsWith('basketball'))) return json({ error: 'BTTS event prices are only supported for a valid soccer event.' }, 400);
  const endpoint = eventId
    ? new URL(`https://api.the-odds-api.com/v4/sports/${sport}/events/${eventId}/odds`)
    : new URL(`https://api.the-odds-api.com/v4/sports/${sport}/odds`);
  endpoint.search = new URLSearchParams({ apiKey: key, regions, markets: eventId ? 'btts' : 'h2h,totals', oddsFormat: 'decimal', dateFormat: 'iso' }).toString();
  try {
    const response = await fetch(endpoint, { headers: { Accept: 'application/json' }, signal: AbortSignal.timeout(12000) });
    const payload = await response.json().catch(() => ({}));
    if (!response.ok) return json({ error: safeProviderError(payload, key, `Odds provider returned HTTP ${response.status}.`), remaining: response.headers.get('x-requests-remaining') }, response.status >= 500 ? 502 : response.status);
    const sourceEvents = eventId ? (payload && typeof payload === 'object' ? [payload] : []) : (Array.isArray(payload) ? payload : []);
    const events = sourceEvents.map(event => shapeEvent(event, sport, regions));
    return json({ sport, regions, events, remaining: response.headers.get('x-requests-remaining') }, 200, 'public, max-age=0, s-maxage=60, stale-while-revalidate=60', { 'X-Odds-Requests-Remaining': response.headers.get('x-requests-remaining') || 'unknown' });
  } catch {
    return json({ error: 'Could not reach the odds provider. Try again shortly.' }, 502);
  }
}

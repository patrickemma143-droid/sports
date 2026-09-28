import { createServer } from 'node:http';
import { readFile, stat } from 'node:fs/promises';
import { extname, join, normalize, sep } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = fileURLToPath(new URL('.', import.meta.url));
const types = { '.html': 'text/html; charset=utf-8', '.css': 'text/css; charset=utf-8', '.js': 'text/javascript; charset=utf-8', '.json': 'application/json; charset=utf-8', '.md': 'text/markdown; charset=utf-8' };
const apiCache = new Map();
try {
  const envText = await readFile(join(root, '.env'), 'utf8');
  for (const line of envText.split(/\r?\n/)) {
    const match = line.match(/^\s*([A-Z][A-Z0-9_]*)\s*=\s*(.*?)\s*$/);
    if (match && !process.env[match[1]]) process.env[match[1]] = match[2].replace(/^(['"])(.*)\1$/, '$2');
  }
} catch {}

const server = createServer(async (req, res) => {
  try {
    const pathname = decodeURIComponent(new URL(req.url, 'http://localhost').pathname);
    if (pathname === '/api/status') {
      res.writeHead(200, { 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-store' });
      res.end(JSON.stringify({ apiSports: Boolean(process.env.API_SPORTS_KEY), oddsApi: Boolean(process.env.THE_ODDS_API_KEY), teamStats: false, socialFeeds: false, betPawa: false }));
      return;
    }
    if (pathname === '/api/games') {
      const query = new URL(req.url, 'http://localhost').searchParams;
      const sport = query.get('sport') || '';
      const phase = query.get('phase') || 'upcoming';
      const date = query.get('date') || kampalaDate();
      if (!['football', 'basketball'].includes(sport) || !['live', 'upcoming'].includes(phase) || !/^\d{4}-\d{2}-\d{2}$/.test(date)) {
        res.writeHead(400, { 'Content-Type': 'application/json; charset=utf-8' });
        res.end(JSON.stringify({ error: 'Use sport=football|basketball, phase=live|upcoming, and an optional YYYY-MM-DD date.' }));
        return;
      }
      if (!process.env.API_SPORTS_KEY) {
        res.writeHead(503, { 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-store' });
        res.end(JSON.stringify({ error: 'API-Sports is not connected yet. Add API_SPORTS_KEY to the local .env file, then restart the app.' }));
        return;
      }
      const host = sport === 'football' ? 'https://v3.football.api-sports.io' : 'https://v1.basketball.api-sports.io';
      const params = phase === 'live' && sport === 'football' ? { live: 'all', timezone: 'Africa/Kampala' } : { date, timezone: 'Africa/Kampala' };
      const endpoint = new URL(`${host}/${sport === 'football' ? 'fixtures' : 'games'}`);
      endpoint.search = new URLSearchParams(params).toString();
      const cacheKey = endpoint.toString();
      const ttl = phase === 'live' ? 15000 : 10 * 60 * 1000;
      let cached = apiCache.get(cacheKey);
      if (!cached || Date.now() - cached.at >= ttl) {
        const response = await fetch(endpoint, { headers: { 'x-apisports-key': process.env.API_SPORTS_KEY, 'Accept': 'application/json' }, signal: AbortSignal.timeout(12000) });
        const payload = await response.json().catch(() => ({}));
        if (!response.ok || (Array.isArray(payload.errors) && payload.errors.length)) {
          const message = Array.isArray(payload.errors) ? Object.values(payload.errors).join('; ') : `Sports data provider returned HTTP ${response.status}.`;
          res.writeHead(response.status === 429 ? 429 : 502, { 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-store' });
          res.end(JSON.stringify({ error: message || 'Sports data provider rejected the request.', requestsRemaining: response.headers.get('x-ratelimit-requests-remaining') }));
          return;
        }
        const rows = Array.isArray(payload.response) ? payload.response : [];
        const games = rows.map(row => normalizeGame(row, sport)).filter(game => game && game.phase === phase);
        cached = { at: Date.now(), games, requestsRemaining: response.headers.get('x-ratelimit-requests-remaining') };
        apiCache.set(cacheKey, cached);
      }
      res.writeHead(200, { 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-store', 'X-Provider-Requests-Remaining': cached.requestsRemaining || 'unknown' });
      res.end(JSON.stringify({ sport, phase, date, source: 'API-Sports', updatedAt: new Date(cached.at).toISOString(), requestsRemaining: cached.requestsRemaining, events: cached.games }));
      return;
    }
    if (pathname === '/api/odds') {
      if (!process.env.THE_ODDS_API_KEY) {
        res.writeHead(503, { 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-store' });
        res.end(JSON.stringify({ error: 'Odds feed is not configured. Follow SETUP.md to add a server-side API key.' }));
        return;
      }
      const query = new URL(req.url, 'http://localhost').searchParams;
      const sport = query.get('sport') || '';
      const allowed = new Set(['soccer_epl', 'soccer_germany_bundesliga', 'soccer_france_ligue_one', 'soccer_uefa_champs_league', 'soccer_uefa_nations_league', 'basketball_nba', 'basketball_nba_preseason', 'basketball_nba_all_stars', 'basketball_nba_summer_league', 'basketball_wnba', 'basketball_ncaab', 'basketball_wncaab', 'basketball_nbl', 'basketball_euroleague']);
      if (!allowed.has(sport)) {
        res.writeHead(400, { 'Content-Type': 'application/json; charset=utf-8' });
        res.end(JSON.stringify({ error: 'Choose a supported sport key from SETUP.md.' }));
        return;
      }
      const regions = (process.env.ODDS_REGIONS || 'eu').split(',').map(x => x.trim()).filter(x => ['us', 'us2', 'uk', 'eu', 'au'].includes(x)).join(',') || 'eu';
      const eventId = query.get('eventId');
      if (eventId && (!/^[a-zA-Z0-9-]{1,100}$/.test(eventId) || sport.startsWith('basketball'))) {
        res.writeHead(400, { 'Content-Type': 'application/json; charset=utf-8' }); res.end(JSON.stringify({ error: 'BTTS event prices are only supported for a valid soccer event.' })); return;
      }
      const endpoint = eventId ? new URL(`https://api.the-odds-api.com/v4/sports/${sport}/events/${eventId}/odds`) : new URL(`https://api.the-odds-api.com/v4/sports/${sport}/odds`);
      endpoint.search = new URLSearchParams({ apiKey: process.env.THE_ODDS_API_KEY, regions, markets: eventId ? 'btts' : 'h2h,totals', oddsFormat: 'decimal', dateFormat: 'iso' }).toString();
      const response = await fetch(endpoint, { headers: { 'Accept': 'application/json' }, signal: AbortSignal.timeout(12000) });
      const payload = await response.json().catch(() => ({}));
      if (!response.ok) {
        res.writeHead(response.status >= 500 ? 502 : response.status, { 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-store' });
        const safeMessage = String(payload.message || `Odds provider returned HTTP ${response.status}.`).replaceAll(process.env.THE_ODDS_API_KEY, '[redacted]');
        res.end(JSON.stringify({ error: safeMessage, remaining: response.headers.get('x-requests-remaining') }));
        return;
      }
      const sourceEvents = eventId ? (payload && typeof payload === 'object' ? [payload] : []) : (Array.isArray(payload) ? payload : []);
      const events = sourceEvents.map(event => {
        const markets = ['h2h', 'totals', 'btts'].flatMap(key => {
          const book = (event.bookmakers || []).find(b => b.markets?.some(m => m.key === key)); const market = book?.markets?.find(m => m.key === key);
          return market ? [{ key, label: ({ h2h: 'Match result', totals: 'Total goals/points', btts: 'Both teams to score' })[key], bookmaker: book.title, updatedAt: market.last_update || book.last_update || null, odds: (market.outcomes || []).map(o => ({ name: o.name, price: o.price, point: o.point ?? null })) }] : [];
        });
        const result = markets.find(m => m.key === 'h2h');
        return { id: `odds-${event.id}`, oddsEventId: event.id, sportKey: sport, live: false, sport: sport.startsWith('basketball') ? 'basketball' : 'football', league: event.sport_title, time: event.commence_time, home: event.home_team, away: event.away_team, homeBadge: event.home_team?.slice(0, 1) || '?', awayBadge: event.away_team?.slice(0, 1) || '?', bookmaker: result?.bookmaker || null, region: regions, odds: result?.odds || [], markets, updatedAt: result?.updatedAt || null };
      });
      res.writeHead(200, { 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-store', 'X-Odds-Requests-Remaining': response.headers.get('x-requests-remaining') || 'unknown' });
      res.end(JSON.stringify({ sport, regions, events }));
      return;
    }
    const requested = pathname === '/' ? 'index.html' : pathname.replace(/^\/+/, '');
    const file = normalize(join(root, requested));
    if (file !== root && !file.startsWith(root + sep)) throw new Error('Not found');
    const info = await stat(file);
    if (!info.isFile()) throw new Error('Not found');
    const body = await readFile(file);
    res.writeHead(200, { 'Content-Type': types[extname(file)] ?? 'application/octet-stream', 'X-Content-Type-Options': 'nosniff', 'Referrer-Policy': 'no-referrer' });
    res.end(body);
  } catch {
    res.writeHead(404, { 'Content-Type': 'text/plain; charset=utf-8' });
    res.end('Not found');
  }
});

function kampalaDate() {
  return new Intl.DateTimeFormat('en-CA', { timeZone: 'Africa/Kampala', year: 'numeric', month: '2-digit', day: '2-digit' }).format(new Date());
}

function normalizeGame(row, sport) {
  if (sport === 'football') {
    const status = row.fixture?.status?.short || 'UNK';
    const live = ['1H', 'HT', '2H', 'ET', 'BT', 'P', 'LIVE'].includes(status);
    const finished = ['FT', 'AET', 'PEN', 'CANC', 'ABD', 'AWD', 'WO'].includes(status);
    return { id: `football-${row.fixture?.id}`, sport, phase: live ? 'live' : finished ? 'finished' : 'upcoming', status, clock: row.fixture?.status?.elapsed == null ? null : `${row.fixture.status.elapsed}'`, time: row.fixture?.date, league: row.league?.name || 'Competition unavailable', country: row.league?.country || '', home: row.teams?.home?.name || 'Home team', away: row.teams?.away?.name || 'Away team', homeBadge: row.teams?.home?.name?.slice(0, 1) || '?', awayBadge: row.teams?.away?.name?.slice(0, 1) || '?', score: { home: row.goals?.home, away: row.goals?.away }, venue: row.fixture?.venue?.name || null };
  }
  const status = String(row.status?.short || 'UNK').toUpperCase();
  const live = ['Q1', 'Q2', 'Q3', 'Q4', 'OT', 'BT', 'HT', 'LIVE', 'IN PROGRESS', '1', '2'].includes(status);
  const finished = ['FT', 'AOT', 'CANC', 'POST', 'ABD', 'AWD', 'FINISHED', '3'].includes(status);
  return { id: `basketball-${row.id}`, sport, phase: live ? 'live' : finished ? 'finished' : 'upcoming', status, clock: row.status?.timer || null, time: row.date?.start || row.date || null, league: row.league?.name || 'Competition unavailable', country: row.country?.name || '', home: row.teams?.home?.name || 'Home team', away: row.teams?.away?.name || 'Away team', homeBadge: row.teams?.home?.name?.slice(0, 1) || '?', awayBadge: row.teams?.away?.name?.slice(0, 1) || '?', score: { home: row.scores?.home?.total ?? row.scores?.home ?? null, away: row.scores?.away?.total ?? row.scores?.away ?? null }, venue: row.venue?.name || null };
}

const port = Number(process.env.PORT || 4173);
server.listen(port, '127.0.0.1', () => console.log(`Match Intelligence OS is running at http://127.0.0.1:${port}`));

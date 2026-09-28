export function json(body, status = 200, cache = 'no-store', extraHeaders = {}) {
  return new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': cache, ...extraHeaders } });
}

export function kampalaDate(date = new Date()) {
  return new Intl.DateTimeFormat('en-CA', { timeZone: 'Africa/Kampala', year: 'numeric', month: '2-digit', day: '2-digit' }).format(date);
}

export function normalizeGame(row, sport) {
  if (sport === 'football') {
    const status = row.fixture?.status?.short || 'UNK';
    const live = ['1H', 'HT', '2H', 'ET', 'BT', 'P', 'LIVE'].includes(status);
    const finished = ['FT', 'AET', 'PEN', 'CANC', 'ABD', 'AWD', 'WO'].includes(status);
    return { id: `football-${row.fixture?.id}`, sport, phase: live ? 'live' : finished ? 'finished' : 'upcoming', status, clock: row.fixture?.status?.elapsed == null ? null : `${row.fixture.status.elapsed}'`, time: row.fixture?.date, league: row.league?.name || 'Competition unavailable', country: row.league?.country || '', home: row.teams?.home?.name || 'Home team', away: row.teams?.away?.name || 'Away team', homeBadge: row.teams?.home?.name?.slice(0, 1) || '?', awayBadge: row.teams?.away?.name?.slice(0, 1) || '?', score: { home: row.goals?.home, away: row.goals?.away }, venue: row.fixture?.venue?.name || null };
  }
  const status = row.status?.short || 'UNK';
  const live = ['Q1', 'Q2', 'Q3', 'Q4', 'OT', 'BT', 'HT'].includes(status);
  const finished = ['FT', 'AOT', 'CANC', 'POST', 'ABD', 'AWD'].includes(status);
  return { id: `basketball-${row.id}`, sport, phase: live ? 'live' : finished ? 'finished' : 'upcoming', status, clock: row.status?.timer || null, time: row.date?.start || row.date || null, league: row.league?.name || 'Competition unavailable', country: row.country?.name || '', home: row.teams?.home?.name || 'Home team', away: row.teams?.away?.name || 'Away team', homeBadge: row.teams?.home?.name?.slice(0, 1) || '?', awayBadge: row.teams?.away?.name?.slice(0, 1) || '?', score: { home: row.scores?.home?.total ?? null, away: row.scores?.away?.total ?? null }, venue: row.venue?.name || null };
}

export function safeProviderError(payload, secret, fallback) {
  const errors = payload?.errors;
  let message = fallback;
  if (Array.isArray(errors) && errors.length) message = errors.join('; ');
  else if (errors && typeof errors === 'object' && Object.keys(errors).length) message = Object.values(errors).join('; ');
  else if (typeof errors === 'string' && errors) message = errors;
  else if (payload?.message) message = payload.message;
  return String(message).replaceAll(secret || '\u0000', '[redacted]').slice(0, 500);
}

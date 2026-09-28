const sourceCards = [
  { mark: 'AS', name: 'API-Sports', type: 'SOCCER · BASKETBALL DATA', detail: 'Server-side live and fixture feed connector is ready. Add your private API key locally. Competition coverage and available fields vary by league; free-tier calls are cached to conserve quota.', status: 'KEY REQUIRED · FREE TIER', url: 'https://api-sports.io/' },
  { mark: 'OD', name: 'The Odds API', type: 'MARKET REFERENCE ODDS', detail: 'The connector requests match-result and totals prices for supported competitions, with optional per-game BTTS prices for soccer. Coverage varies by region/bookmaker; the documented feed does not list soccer corners or cards markets. BetPawa prices are not verified.', status: 'REFERENCE ONLY · COVERAGE VARIES', url: 'https://the-odds-api.com/sports-odds-data/bookmaker-apis.html' },
  { mark: 'BP', name: 'BetPawa', type: 'MANUAL SLIP HANDOFF', detail: 'This app does not need your BetPawa password, PIN, balance, or session. Confirm every selection directly on your local BetPawa site.', status: 'MANUAL ONLY', url: 'https://www.betpawa.com/' },
  { mark: 'X', name: 'X public posts', type: 'OPTIONAL PUBLIC CONTEXT', detail: 'Recommended first social source for timestamped public team, federation, league and reporter updates. Use the official API and a curated source list. Posts remain linked context for human review, not automatic model inputs.', status: 'DEVELOPER ACCESS CHECK NEEDED', url: 'https://developer.x.com/' },
  { mark: 'DB', name: 'Hosting and secure storage', type: 'DEPLOYMENT', detail: 'This build currently runs locally. Public launch needs a selected host, secrets configured there, access control, and a persistence plan.', status: 'NOT DEPLOYED', url: 'SETUP.md' }
];
const savedFinance = (() => { try { return JSON.parse(localStorage.getItem('fieldnote-finance-v1') || '{}'); } catch { return {}; } })();
const savedSlip = (() => { try { const value = JSON.parse(localStorage.getItem('fieldnote-slip-v1') || '[]'); return Array.isArray(value) ? value : []; } catch { return []; } })();
const state = { fixtureId: null, filter: 'all', phase: 'upcoming', slip: savedSlip, watch: [], liveFixtures: [], monthlyLimit: Number(savedFinance.monthlyLimit) || 0, ledger: Array.isArray(savedFinance.ledger) ? savedFinance.ledger : [] };
const $ = (q, root = document) => root.querySelector(q);
const $$ = (q, root = document) => [...root.querySelectorAll(q)];
const allFixtures = () => state.liveFixtures;
const fixture = () => allFixtures().find(f => f.id === state.fixtureId) || null;
const escapeHTML = value => String(value ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
function percent(n) { return `${(n * 100).toFixed(1)}%`; }
function oddsSportKey(f) {
  const league = `${f.league} ${f.country || ''}`.toLowerCase();
  if (f.sport === 'football') {
    if (league.includes('premier league') && league.includes('england')) return 'soccer_epl';
    if (league.includes('bundesliga') && league.includes('germany')) return 'soccer_germany_bundesliga';
    if (league.includes('ligue 1') && league.includes('france')) return 'soccer_france_ligue_one';
    if (league.includes('champions league') && league.includes('uefa')) return 'soccer_uefa_champs_league';
    if (league.includes('nations league') && league.includes('uefa')) return 'soccer_uefa_nations_league';
  }
  if (f.sport === 'basketball') {
    if (league.includes('wnba')) return 'basketball_wnba';
    if ((league.includes('ncaa') || league.includes('college')) && (league.includes('women') || league.includes('women\'s'))) return 'basketball_wncaab';
    if (league.includes('ncaa') || league.includes('college basketball')) return 'basketball_ncaab';
    if (league.includes('summer league')) return 'basketball_nba_summer_league';
    if (league.includes('all star')) return 'basketball_nba_all_stars';
    if (league.includes('preseason') && league.includes('nba')) return 'basketball_nba_preseason';
    if (league.includes('nba')) return 'basketball_nba';
    if (league.includes('euroleague')) return 'basketball_euroleague';
    if (league.includes('nbl') && (league.includes('australia') || league.includes('australian'))) return 'basketball_nbl';
  }
  return null;
}
function normalizeTeam(name) { return String(name || '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase().replace(/\b(fc|cf|afc|sc|basketball club)\b/g, '').replace(/[^a-z0-9]/g, ''); }
function matchMarket(game, markets) {
  const home = normalizeTeam(game.home); const away = normalizeTeam(game.away); const time = Date.parse(game.time);
  return markets.find(m => {
    const sameTeams = normalizeTeam(m.home) === home && normalizeTeam(m.away) === away;
    const marketTime = Date.parse(m.time);
    return sameTeams && (!Number.isFinite(time) || !Number.isFinite(marketTime) || Math.abs(time - marketTime) < 8 * 60 * 60 * 1000);
  }) || null;
}
function availableMarkets(game) {
  const markets = game?.marketReference?.markets || [];
  if (markets.length) return markets;
  return game?.marketReference?.odds?.length ? [{ key: 'h2h', label: 'Match result', bookmaker: game.marketReference.bookmaker, odds: game.marketReference.odds }] : [];
}
function selectedMarket() { return availableMarkets(fixture()).find(m => m.key === $('#selectionMarket').value) || null; }
function updateAddPickAvailability() {
  const market = selectedMarket(); const options = (market?.odds || []).filter(item => item.price > 1); const outcome = options[Number($('#selectionOutcome').value)];
  const priceReady = Number.isFinite(Number($('#actualOdds').value)) && Number($('#actualOdds').value) > 1;
  const manualReady = !$('#manualSelectionWrap').hidden && $('#manualSelection').value.trim().length > 0 && priceReady;
  $('#addToSlip').disabled = !(priceReady && outcome) && !manualReady;
}
function renderMarketOutcomes() {
  const market = selectedMarket(); const outcomes = (market?.odds || []).filter(item => item.price > 1);
  $('#selectionOutcome').innerHTML = outcomes.length ? outcomes.map((item, i) => `<option value="${i}">${escapeHTML(item.name)}${item.point != null ? ` ${item.point}` : ''} · ${Number(item.price).toFixed(2)}</option>`).join('') : '<option value="">No prices for this market</option>';
  $('#selectionOutcome').disabled = !outcomes.length;
  updateSelectionEstimate(); updateAddPickAvailability();
}
async function loadBtts() {
  const f = fixture(); const button = $('#loadBtts');
  if (!f?.marketReference?.oddsEventId || !oddsSportKey(f)) return;
  button.disabled = true; button.textContent = 'Loading BTTS…';
  try {
    const params = new URLSearchParams({ sport: oddsSportKey(f), eventId: f.marketReference.oddsEventId });
    const response = await fetch(`/api/odds?${params}`, { cache: 'no-store' }); const data = await response.json();
    if (!response.ok) throw new Error(data.error || 'BTTS prices are unavailable for this event.');
    const event = data.events?.[0]; const btts = event?.markets?.find(market => market.key === 'btts');
    if (!btts) throw new Error('No BTTS prices are published for this game in the configured bookmaker region.');
    f.marketReference.markets = [...availableMarkets(f).filter(market => market.key !== 'btts'), btts];
    const select = $('#selectionMarket'); select.innerHTML = f.marketReference.markets.map(m => `<option value="${escapeHTML(m.key)}">${escapeHTML(m.label || m.key)} · ${escapeHTML(m.bookmaker || 'bookmaker')}</option>`).join(''); select.value = 'btts';
    $('#loadBtts').hidden = true; renderMarketOutcomes(); toast('Loaded published BTTS reference prices. These are not a prediction.');
  } catch (error) { toast(error.message); }
  finally { button.disabled = false; button.textContent = 'Load BTTS prices'; }
}
function kampalaMonth(date = new Date()) { return new Intl.DateTimeFormat('en-CA', { timeZone: 'Africa/Kampala', year: 'numeric', month: '2-digit' }).format(date); }
function ugx(amount) { return `UGX ${Math.round(Number(amount) || 0).toLocaleString('en-US')}`; }
function saveFinance() { try { localStorage.setItem('fieldnote-finance-v1', JSON.stringify({ monthlyLimit: state.monthlyLimit, ledger: state.ledger })); } catch { toast('This browser could not save the finance tracker.'); } }
function saveSlip() { try { localStorage.setItem('fieldnote-slip-v1', JSON.stringify(state.slip)); } catch { toast('This browser could not save the slip.'); } }
function renderFinance() {
  const month = kampalaMonth(); const entries = state.ledger.filter(b => kampalaMonth(new Date(b.createdAt)) === month);
  const staked = entries.reduce((sum, b) => sum + Number(b.stake || 0), 0);
  const wins = entries.filter(b => b.result === 'won').length; const losses = entries.filter(b => b.result === 'lost').length;
  const pending = entries.filter(b => b.result === 'pending').length;
  const net = entries.reduce((sum, b) => sum + (b.result === 'won' ? Number(b.stake) * (Number(b.odds) - 1) : b.result === 'lost' ? -Number(b.stake) : 0), 0);
  $('#monthlyBudget').value = state.monthlyLimit || '';
  $('#financeStaked').textContent = ugx(staked);
  $('#financeRemaining').textContent = state.monthlyLimit ? ugx(state.monthlyLimit - staked) : 'UGX —';
  $('#financeBudgetStatus').textContent = state.monthlyLimit ? `${((staked / state.monthlyLimit) * 100).toFixed(0)}% of your limit recorded` : 'Set a monthly limit';
  $('#financeNet').textContent = `${net > 0 ? '+' : ''}${ugx(net)}`;
  $('#financeRecord').textContent = `${wins} / ${losses}`; $('#financePending').textContent = `${pending} pending`;
  $('#financeLedger').innerHTML = state.ledger.length ? [...state.ledger].sort((a,b) => b.createdAt.localeCompare(a.createdAt)).map(b => `<article class="ledger-row"><div class="ledger-game"><b>${escapeHTML(b.fixture)}</b><small>${escapeHTML(b.sport.toUpperCase())} · ${new Date(b.createdAt).toLocaleDateString('en-UG')}</small></div><div><b>${escapeHTML(b.selection)}</b><small>BetPawa price entered: @ ${Number(b.odds).toFixed(2)} · stake ${ugx(b.stake)}${b.marketOdds ? ` · external ref @ ${Number(b.marketOdds).toFixed(2)}` : ''}</small></div><div class="ledger-result"><b>${b.result === 'won' ? `+${ugx(Number(b.stake) * (Number(b.odds) - 1))}` : b.result === 'lost' ? `−${ugx(b.stake)}` : b.result === 'void' ? 'Void' : 'Pending'}</b><select data-result="${escapeHTML(b.id)}" aria-label="Update result for ${escapeHTML(b.fixture)}"><option value="pending" ${b.result === 'pending' ? 'selected' : ''}>Pending</option><option value="won" ${b.result === 'won' ? 'selected' : ''}>Won</option><option value="lost" ${b.result === 'lost' ? 'selected' : ''}>Lost</option><option value="void" ${b.result === 'void' ? 'selected' : ''}>Void</option></select></div></article>`).join('') : '<div class="slip-empty">No stakes recorded yet. Set a monthly limit, then track a selection from a fixture with matched odds.</div>';
}
function updateSelectionEstimate() {
  const outcome = $('#selectionOutcome');
  const market = selectedMarket(); const options = (market?.odds || []).filter(x => x.price > 1); const pick = options[Number(outcome.value)]; const actualOdds = Number($('#actualOdds').value);
  if (pick) {
    const total = options.reduce((sum, x) => sum + 1 / x.price, 0); const probability = total ? (1 / pick.price) / total : 0;
    $('#selectionReason').textContent = `${market.bookmaker || 'External bookmaker'} lists ${market.label || market.key} at this price. ${pick.name}${pick.point != null ? ` ${pick.point}` : ''} has an estimated ${percent(probability)} market-implied share after removing the margin across these outcomes. This is bookmaker consensus context, not a validated AI pick or BetPawa price.`;
  }
  $('#selectionEstimate').textContent = pick ? `Reference price ${Number(pick.price).toFixed(2)} at ${market.bookmaker || 'external bookmaker'}. Add this leg at the current BetPawa price you enter; combined odds and any stake estimate appear on the slip. No wager is placed by this app.` : 'Choose a market with published reference prices. No price or forecast will be invented.';
}
function renderWatchlist() {
  $('#watchlist').innerHTML = state.watch.map(id => allFixtures().find(f => f.id === id)).filter(Boolean).map(f => `<button class="watch-item" data-select="${escapeHTML(f.id)}"><i class="watch-mark"></i><span>${escapeHTML(f.home)} <small>${escapeHTML(f.time)} · ${escapeHTML(f.sport)}</small></span></button>`).join('') || '<div class="watch-item">No games pinned</div>';
}
function renderFixtures() {
  const visible = allFixtures().filter(f => state.filter === 'all' || f.sport === state.filter);
  $('#fixtureList').innerHTML = visible.map(f => { const markets = availableMarkets(f); const h2h = markets.find(m => m.key === 'h2h'); const prices = h2h?.odds || []; return `<button class="fixture-row ${f.id === state.fixtureId ? 'selected' : ''}" data-select="${escapeHTML(f.id)}"><span class="fixture-time">${f.phase === 'live' ? `${f.score?.home ?? '—'}–${f.score?.away ?? '—'}` : new Date(f.time).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', timeZone: 'Africa/Kampala' })}</span><span><span class="fixture-sport ${escapeHTML(f.sport)}">${escapeHTML(f.sport.toUpperCase())} · ${escapeHTML((f.status || f.phase).toUpperCase())}</span><span class="fixture-teams"><strong>${escapeHTML(f.home)}</strong> <span style="color:#718391">vs</span> <strong>${escapeHTML(f.away)}</strong></span><span class="fixture-meta">${escapeHTML(f.league)}${f.clock ? ` · ${escapeHTML(f.clock)}` : ''}</span></span><span class="fixture-price"><span class="row-tag">${prices.length ? prices.map(o => `${o.name}: ${Number(o.price).toFixed(2)}`).join(' · ') : f.phase === 'live' ? 'LIVE SCORE' : 'NO ODDS'}</span><small>${prices.length ? `${escapeHTML(h2h.bookmaker || 'Reference odds')} · ${markets.length} markets` : 'Odds source'}</small></span></button>`; }).join('') || `<div class="slip-empty">No ${state.phase} games loaded. Connect API-Sports, then choose “Load ${state.phase} games.” No sample matches are shown.</div>`;
  $$('#fixtureList [data-select]').forEach(b => b.addEventListener('click', () => selectFixture(b.dataset.select)));
  $('#gamesTracked').textContent = String(visible.length).padStart(2, '0');
  $('.count-badge', $('.fixtures-panel .panel-header'))?.replaceChildren(document.createTextNode(String(visible.length).padStart(2, '0')));
}
function renderEmptyAnalysis() {
  $('#matchTitle').innerHTML = 'No game selected';
  $('#leagueName').textContent = 'Load games from the connected feed';
  $('#kickoffTime').textContent = '—';
  $('#homeName').textContent = 'Home team'; $('#awayName').textContent = 'Away team';
  $('#homeBadge').textContent = '—'; $('#awayBadge').textContent = '—';
  $('#analysisPanel .callout-warning span:last-of-type').innerHTML = '<b>No forecast available</b> · Connect live data and a validated sport-specific model before showing predictions.';
  $('#probabilityBars').innerHTML = '<div class="field-note">Live fixtures and market prices have not been loaded.</div>';
  $('#scoreLines').innerHTML = '<div class="field-note">No forecast is available. The app will not substitute sample scores.</div>';
  $('#scoreLines').previousElementSibling.querySelector('span').textContent = 'NO VALIDATED FORECAST';
  $('.probability-legend', $('.probability-section'))?.remove();
  $('#analysisPanel .subhead').firstElementChild.textContent = 'LIVE DATA REQUIRED';
  $('#analysisPanel .signal-row p').textContent = 'No public social sources or team data are connected.';
  $('#selectionMarket').innerHTML = '<option value="">No markets loaded</option>'; $('#selectionMarket').disabled = true;
  $('#selectionOutcome').innerHTML = '<option value="">Select a game with matched odds</option>'; $('#selectionOutcome').disabled = true;
  $('#manualSelectionWrap').hidden = true; $('#manualSelection').value = '';
  $('#loadBtts').hidden = true;
  $('#addToSlip').disabled = true; $('#showModel').disabled = true;
}
function selectFixture(id) {
  const f = allFixtures().find(item => item.id === id);
  if (!f) { state.fixtureId = null; renderEmptyAnalysis(); renderFixtures(); renderWatchlist(); return; }
  state.fixtureId = id;
  $('#matchTitle').innerHTML = `${escapeHTML(f.home)} <span>vs</span> ${escapeHTML(f.away)}`;
  $('#leagueName').textContent = f.league;
  $('#kickoffTime').textContent = `${new Date(f.time).toLocaleString([], { dateStyle: 'medium', timeStyle: 'short', timeZone: 'UTC' })} UTC`;
  $('#homeName').textContent = f.home; $('#awayName').textContent = f.away;
  $('#homeBadge').textContent = f.homeBadge; $('#awayBadge').textContent = f.awayBadge;
  $('.teams-score .versus').textContent = f.phase === 'live' ? `${f.score?.home ?? '—'} – ${f.score?.away ?? '—'}` : 'VS';
  const marketSelect = $('#selectionMarket'); const allMarkets = availableMarkets(f);
  marketSelect.innerHTML = allMarkets.length ? allMarkets.map(m => `<option value="${escapeHTML(m.key)}">${escapeHTML(m.label || m.key)} · ${escapeHTML(m.bookmaker || 'bookmaker')}</option>`).join('') : '<option value="">No markets loaded</option>';
  marketSelect.disabled = !allMarkets.length;
  $('#loadBtts').hidden = f.sport !== 'football' || allMarkets.some(m => m.key === 'btts') || !f.marketReference?.oddsEventId;
  const outcomeSelect = $('#selectionOutcome');
  const marketOutcomes = (allMarkets[0]?.odds || []).filter(x => x.price > 1);
  outcomeSelect.innerHTML = marketOutcomes.length ? marketOutcomes.map((x, i) => `<option value="${i}">${escapeHTML(x.name)} · ${Number(x.price).toFixed(2)}</option>`).join('') : '<option value="">No matched bookmaker odds</option>';
  outcomeSelect.disabled = !marketOutcomes.length;
  outcomeSelect.dataset.marketKey = allMarkets[0]?.key || '';
  $('#manualSelectionWrap').hidden = marketOutcomes.length > 0;
  $('#manualSelection').value = '';
  $('#actualOdds').value = '';
  $('#addToSlip').disabled = !marketOutcomes.length;
  $('#selectionReason').textContent = marketOutcomes.length ? 'Reference markets are available below. Choose one, then enter the current price you see on BetPawa; its price may differ.' : 'No external odds matched this game. You can still build your slip: type the market and outcome exactly as BetPawa shows, then enter its current odds. This is your manual selection, not an app prediction.';
  updateSelectionEstimate(); updateAddPickAvailability();
  $('#analysisPanel .callout-warning span:last-of-type').innerHTML = `<b>${f.phase === 'live' ? 'Live score from API-Sports' : 'Fixture details from API-Sports'}</b> · status ${escapeHTML(f.status || 'unknown')}${f.updatedAt ? ` · retrieved ${escapeHTML(new Date(f.updatedAt).toLocaleString())}` : ''}. This is not a forecast.`;
  const h2hOutcomes = (allMarkets.find(m => m.key === 'h2h')?.odds || []).filter(x => x.price > 1);
  const impliedTotal = h2hOutcomes.reduce((sum, x) => sum + 1 / x.price, 0);
  $('#probabilityBars').innerHTML = h2hOutcomes.length ? h2hOutcomes.map(x => { const p = (1 / x.price) / impliedTotal; return `<div class="prob-row"><span>${escapeHTML(x.name)}</span><div class="prob-track"><div class="prob-fill" style="width:${(p * 100).toFixed(1)}%"></div></div><b class="prob-value">${percent(p)}</b></div>`; }).join('') : '<div class="field-note">No bookmaker reference odds matched this game. Live scores stay separate from predicted probabilities.</div>';
  $('#scoreLines').innerHTML = '<div class="field-note">No independent score forecast yet. Historical team and player data plus time-ordered model validation are still required.</div>';
  $('.probability-legend', $('.probability-section'))?.remove();
  const legend = document.createElement('div'); legend.className = 'probability-legend'; legend.innerHTML = `<span class="method-label">${f.marketReference ? `EXTERNAL MARKET REFERENCE · ${escapeHTML(f.marketReference.bookmaker || 'BOOKMAKER') } · NOT BETPAWA OR A MODEL` : 'NO MATCHED BOOKMAKER ODDS'}</span>`; $('.probability-section').appendChild(legend);
  $('#scoreLines').previousElementSibling.querySelector('span').textContent = 'FORECAST NOT AVAILABLE';
  $('#analysisPanel .subhead').firstElementChild.textContent = 'GAME DATA · NOT A PREDICTION';
  $('#analysisPanel .signal-row p').textContent = 'No authorized social, lineup, weather, bookmaker or independent forecast source is connected.';
  $('#showModel').disabled = true;
  $('#actualOdds').value = '';
  renderFixtures(); renderWatchlist();
}
function renderSources() {
  $('#sourceGrid').innerHTML = sourceCards.map(s => `<article class="source-card"><div class="source-card-top"><div class="source-logo">${s.mark}</div><div><h3>${s.name}</h3><span class="source-type">${s.type}</span></div></div><p>${s.detail}</p><div class="source-card-foot"><span class="source-status">${s.status}</span><a href="${s.url}" ${s.url.startsWith('http') ? 'target="_blank" rel="noreferrer"' : ''}>Open setup ↗</a></div></article>`).join('');
}
function renderSlip() {
  $('#slipCount').textContent = String(state.slip.length).padStart(2, '0');
  const combined = state.slip.length && state.slip.every(item => Number(item.odds) > 1) ? state.slip.reduce((product, item) => product * Number(item.odds), 1) : null;
  $('#combinedOdds').textContent = `Combined BetPawa odds: ${combined ? combined.toFixed(2) : '—'} · calculated from prices entered by you; verify every live price on BetPawa.`;
  $('#slipEmpty').style.display = state.slip.length ? 'none' : 'flex';
  $('#slipSummary').hidden = !state.slip.length;
  $('#copySlip').disabled = !state.slip.length;
  $('#slipItems').innerHTML = state.slip.map((s, i) => `<div class="slip-item"><span class="slip-sport">${escapeHTML(s.sport.toUpperCase())}</span><span class="slip-leg"><b>${escapeHTML(s.fixture)}</b><small>${escapeHTML(s.league || '')} · ${escapeHTML(s.market)}</small><small>${escapeHTML(s.reason || 'Market reference not available')}</small></span><b class="slip-odds">@ ${Number(s.odds).toFixed(2)}</b><button class="remove-slip" data-remove="${i}" aria-label="Remove ${escapeHTML(s.fixture)}">×</button></div>`).join('');
  if (combined) {
    const chance = 1 / combined; const risk = chance >= .5 ? ['LOW', 'Lower odds exposure', 0] : chance >= .2 ? ['MODERATE', 'Moderate odds exposure', 1] : chance >= .05 ? ['HIGH', 'High odds exposure', 2] : ['EXTREME', 'Extreme odds exposure', 3];
    $('#riskLabel').textContent = risk[1]; $('#riskLabel').dataset.band = risk[0].toLowerCase(); $('#impliedChance').textContent = `${percent(chance)} odds-implied chance`;
    $('#riskMarker').style.left = `${12.5 + risk[2] * 25}%`;
    const meter = $('.risk-track'); meter.setAttribute('aria-valuenow', String(risk[2])); meter.setAttribute('aria-valuetext', `${risk[1]}; ${percent(chance)} odds-implied chance`);
  } else { $('#riskLabel').textContent = 'Risk —'; $('#impliedChance').textContent = 'Odds-implied chance —'; $('#riskMarker').style.left = '0%'; }
  updateSlipReturn();
  $$('[data-remove]').forEach(b => b.addEventListener('click', () => { state.slip.splice(Number(b.dataset.remove), 1); saveSlip(); renderSlip(); }));
}
function addSelection() {
  const f = fixture(); if (!f) return;
  const market = selectedMarket(); const options = (market?.odds || []).filter(x => x.price > 1); const pick = options[Number($('#selectionOutcome').value)];
  const actualOdds = Number($('#actualOdds').value);
  const manualPick = $('#manualSelection').value.trim();
  if ((!pick && !manualPick) || !Number.isFinite(actualOdds) || actualOdds <= 1) { toast('Choose a market outcome or type the BetPawa market and pick, then enter its decimal odds.'); return; }
  const selection = pick ? `${market.label || market.key}: ${pick.name}${pick.point != null ? ` ${pick.point}` : ''}` : manualPick;
  const total = options.reduce((sum, item) => sum + 1 / item.price, 0); const probability = pick && total ? (1 / pick.price) / total : null;
  state.slip.push({ fixture: `${f.home} vs ${f.away}`, league: f.league, sport: f.sport, market: selection, odds: actualOdds.toFixed(2), referenceOdds: pick ? Number(pick.price) : null, referenceBookmaker: pick ? (market.bookmaker || 'external bookmaker') : null, reason: probability == null ? 'Entered from BetPawa by you. No matching external odds or independent forecast is available for this pick.' : `${market.bookmaker || 'External market'} reference ${Number(pick.price).toFixed(2)}; margin-removed market share ${percent(probability)}. This is market context, not an independent prediction.` });
  saveSlip(); renderSlip(); $('#actualOdds').value = ''; $('#manualSelection').value = ''; updateSelectionEstimate(); updateAddPickAvailability(); $('#slipPanel').scrollIntoView({ behavior: 'smooth', block: 'nearest' }); toast('Added to your slip. Review the combined odds and confirm the price on BetPawa.');
}
function updateSlipReturn() {
  const combined = state.slip.length && state.slip.every(item => Number(item.odds) > 1) ? state.slip.reduce((product, item) => product * Number(item.odds), 1) : 0;
  const stake = Number($('#slipStake').value);
  $('#slipReturn').textContent = stake > 0 && combined > 1 ? `Possible gross return: ${ugx(stake * combined)} · possible profit: ${ugx(stake * (combined - 1))}. Estimate only; BetPawa may calculate a different total.` : 'Enter a stake to see an estimated return and profit; this does not predict a win.';
  $('#recordSlip').disabled = !Number.isFinite(stake) || stake <= 0 || !combined;
}
function recordSlip() {
  const stake = Number($('#slipStake').value); const combined = state.slip.length ? state.slip.reduce((product, item) => product * Number(item.odds), 1) : 0;
  if (!state.slip.length || !Number.isFinite(stake) || stake <= 0 || combined <= 1) { toast('Add priced picks and enter the stake for this complete slip.'); return; }
  if (!state.monthlyLimit) { toast('Set your monthly limit in Finances before recording this stake.'); setView('finance'); $('#monthlyBudget').focus(); return; }
  const used = state.ledger.filter(b => kampalaMonth(new Date(b.createdAt)) === kampalaMonth()).reduce((sum, b) => sum + Number(b.stake || 0), 0);
  if (used + stake > state.monthlyLimit) { toast(`This exceeds your remaining monthly limit of ${ugx(state.monthlyLimit - used)}.`); return; }
  const sports = [...new Set(state.slip.map(item => item.sport))];
  state.ledger.push({ id: crypto.randomUUID(), createdAt: new Date().toISOString(), fixture: `${state.slip.length}-pick slip`, sport: sports.length === 1 ? sports[0] : 'mixed', selection: state.slip.map(item => `${item.fixture} — ${item.market} @ ${item.odds}`).join(' | '), odds: combined, stake, result: 'pending', bookmaker: 'BetPawa (entered by you)' });
  saveFinance(); renderFinance(); state.slip = []; $('#slipStake').value = ''; saveSlip(); renderSlip(); toast('Recorded one stake for the combined slip in your private tracker.');
}
function toast(message) { const el = $('#toast'); el.textContent = message; el.classList.add('show'); clearTimeout(toast.timer); toast.timer = setTimeout(() => el.classList.remove('show'), 3000); }
function setView(name) {
  $$('.page-view').forEach(v => v.classList.toggle('hidden', v.id !== `view-${name}`));
  $$('.nav-item').forEach(b => b.classList.toggle('active', b.dataset.view === name));
  $('#breadcrumbTitle').textContent = name === 'board' ? 'Match board' : name === 'lab' ? 'Model status' : name === 'finance' ? 'Finances' : 'Data sources';
  window.scrollTo({ top: 0, behavior: matchMedia('(prefers-reduced-motion: reduce)').matches ? 'instant' : 'smooth' });
}
async function loadLiveGames() {
  const button = $('#loadLiveGames');
  const sports = state.filter === 'football' ? ['football'] : state.filter === 'basketball' ? ['basketball'] : ['football', 'basketball'];
  button.disabled = true; button.textContent = 'Loading…';
  try {
    const results = await Promise.all(sports.map(async sport => {
      try {
        const response = await fetch(`/api/games?sport=${encodeURIComponent(sport)}&phase=${encodeURIComponent(state.phase)}`, { cache: 'no-store' });
        const data = await response.json();
        if (!response.ok) throw new Error(data.error || `Could not load ${sport}.`);
        return { sport, data, error: null };
      } catch (error) { return { sport, data: null, error: error.message || `Could not load ${sport}.` }; }
    }));
    const successful = results.filter(result => result.data);
    const failures = results.filter(result => result.error);
    if (!successful.length) throw new Error(failures.map(result => `${result.sport}: ${result.error}`).join(' · ') || 'No sports feeds responded.');
    state.liveFixtures = successful.flatMap(result => (result.data.events || []).map(event => ({ ...event, updatedAt: result.data.updatedAt })));
    const apiStatus = await fetch(`/api/status?refresh=${Date.now()}`, { cache: 'no-store' }).then(r => r.json()).catch(() => ({}));
    if (apiStatus.oddsApi) {
      const marketKeys = [...new Set(state.liveFixtures.map(oddsSportKey).filter(Boolean))];
      const marketResponses = await Promise.all(marketKeys.map(async sport => {
        try {
          const response = await fetch(`/api/odds?sport=${encodeURIComponent(sport)}`, { cache: 'no-store' });
          if (!response.ok) return [];
          const data = await response.json();
          return (data.events || []).map(event => ({ ...event, region: data.regions }));
        } catch { return []; }
      }));
      const markets = marketResponses.flat();
      state.liveFixtures = state.liveFixtures.map(game => ({ ...game, marketReference: matchMarket(game, markets) }));
    }
    state.fixtureId = state.liveFixtures[0]?.id || null;
    renderFixtures(); renderWatchlist();
    state.fixtureId ? selectFixture(state.fixtureId) : renderEmptyAnalysis();
    const stamp = successful.map(result => result.data.updatedAt).filter(Boolean).sort().at(-1);
    const feedStatus = $('#fixtureFeedStatus');
    if (feedStatus) feedStatus.textContent = stamp ? `${state.phase === 'live' ? 'Live scores snapshot' : 'Fixture snapshot'} · updated ${new Date(stamp).toLocaleTimeString([], { timeZone: 'Africa/Kampala', hour: '2-digit', minute: '2-digit' })} Kampala time · refresh manually` : 'Provider snapshot · refresh manually';
    const partial = failures.length ? ` ${failures.map(result => `${result.sport}: ${result.error}`).join(' · ')}` : '';
    toast(state.liveFixtures.length ? `Loaded ${state.liveFixtures.length} ${state.phase} games.${partial} Odds are separate references; no model forecast is active.` : `No ${state.phase} games were returned for this date.${partial}`);
  } catch (error) {
    state.liveFixtures = []; state.fixtureId = null; renderFixtures(); renderWatchlist(); renderEmptyAnalysis();
    toast(error.message.includes('API-Sports is not connected') ? 'Add your API-Sports key to the local .env file and restart the app.' : error.message);
  } finally { button.disabled = false; button.textContent = `↻ Load ${state.phase} games`; }
}
function init() {
  renderSources(); renderFixtures(); renderWatchlist(); renderEmptyAnalysis(); renderSlip();
  renderFinance();
  $('#gamesTracked').textContent = '00';
  $$('.nav-item').forEach(b => b.addEventListener('click', () => setView(b.dataset.view)));
  $$('[data-go]').forEach(b => b.addEventListener('click', () => setView(b.dataset.go)));
  $$('.filter-button').forEach(b => b.addEventListener('click', () => {
    if (b.dataset.phase) {
      state.phase = b.dataset.phase;
      $$('.phase-button').forEach(x => x.classList.toggle('selected', x === b));
      $('#fixturePhaseLabel').textContent = `${state.phase.toUpperCase()} GAMES`;
      $('#loadLiveGames').textContent = `↻ Load ${state.phase} games`;
      loadLiveGames();
      return;
    }
    state.filter = b.dataset.filter;
    $$('[data-filter]').forEach(x => x.classList.toggle('selected', x === b));
    const visible = allFixtures().filter(f => state.filter === 'all' || f.sport === state.filter);
    if (!visible.some(f => f.id === state.fixtureId)) {
      state.fixtureId = visible[0]?.id || null;
      state.fixtureId ? selectFixture(state.fixtureId) : renderEmptyAnalysis();
    }
    renderFixtures();
  }));
  $('#addToSlip').addEventListener('click', addSelection);
  $('#selectionOutcome').addEventListener('change', updateSelectionEstimate);
  $('#selectionMarket').addEventListener('change', renderMarketOutcomes);
  $('#loadBtts').addEventListener('click', loadBtts);
  $('#actualOdds').addEventListener('input', updateSelectionEstimate);
  $('#actualOdds').addEventListener('input', updateAddPickAvailability);
  $('#manualSelection').addEventListener('input', updateAddPickAvailability);
  $('#slipStake').addEventListener('input', updateSlipReturn);
  $('#recordSlip').addEventListener('click', recordSlip);
  $('#budgetForm').addEventListener('submit', e => {
    e.preventDefault(); const budget = Number($('#monthlyBudget').value);
    if (!Number.isFinite(budget) || budget <= 0) { toast('Enter a monthly limit greater than zero.'); return; }
    state.monthlyLimit = Math.round(budget); saveFinance(); renderFinance(); toast('Your monthly tracking limit has been saved in this browser.');
  });
  $('#financeLedger').addEventListener('change', e => {
    const id = e.target.dataset.result; if (!id) return;
    const item = state.ledger.find(b => b.id === id); if (!item) return;
    item.result = e.target.value; saveFinance(); renderFinance();
  });
  $('#copySlip').addEventListener('click', async () => {
    const combined = state.slip.length && state.slip.every(item => Number(item.odds) > 1) ? state.slip.reduce((product, item) => product * Number(item.odds), 1) : null;
    const chance = combined ? 1 / combined : null;
    const text = ['MANUAL BETPAWA SLIP (not a booking code)', ...state.slip.map((s, i) => `${i + 1}. ${s.sport.toUpperCase()} — ${s.fixture} — ${s.market} @ ${Number(s.odds).toFixed(2)}\n   Market context: ${s.reason}`), ...(combined ? [`Combined decimal odds: ${combined.toFixed(2)}`, `Odds-implied chance: ${percent(chance)} (not an independent prediction)`] : []), '', 'Verify each selection and price directly on BetPawa; prices and availability can change.'];
    try { await navigator.clipboard.writeText(text.join('\n')); toast('Selection details copied. BetPawa booking codes must be created on BetPawa.'); } catch { toast('Clipboard access unavailable. Copy the listed selections manually.'); }
  });
  $('#starButton').addEventListener('click', () => { const id = state.fixtureId; if (!id) return; state.watch = state.watch.includes(id) ? state.watch.filter(x => x !== id) : [...state.watch, id]; renderWatchlist(); });
  $('#addWatch').addEventListener('click', () => toast(state.fixtureId ? 'Use the star beside the selected live fixture.' : 'Load a live feed before pinning a game.'));
  $('#showModel').addEventListener('click', () => toast('Forecasting is unavailable until historical data is connected and a sport-specific model passes time-ordered validation.'));
  $('#dismissWarning').addEventListener('click', () => $('#dismissWarning').closest('.callout-warning').style.display = 'none');
  $('#helpButton').addEventListener('click', () => setView('sources'));
  $('#dateFilter').addEventListener('click', () => toast('Fixture date selection requires a schedule feed; none is connected.'));
  $('#accountShortcut').addEventListener('click', () => setView('sources'));
  $('#loadLiveGames').addEventListener('click', loadLiveGames);
  document.addEventListener('click', e => { const b = e.target.closest('[data-select]'); if (b && !b.closest('#fixtureList')) selectFixture(b.dataset.select); });
}
init();

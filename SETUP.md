# Setup for the Uganda launch

## Current project state

The fixture board is intended to start empty; it must never make up matches or display sample forecasts. The existing live connector only reads odds from The Odds API for a short fixed list of competitions. It is not a complete Uganda or BetPawa feed. Historical stats, social feeds, prediction models, secure public login, and production hosting are not connected.

## Your confirmed scope

- User country: Uganda
- Sports: association football (soccer), including women’s competitions, and basketball
- Timing: pre-game and in-game
- Launch: private/personal first; public later
- Finance tracking: a user-entered monthly UGX limit, stake confirmation, and manually recorded pending/win/loss/void outcomes, stored locally in the browser
- Competition scope: compare provider-supported competitions with the competitions visible in your Uganda BetPawa catalogue, including women’s leagues. Include only verified overlaps and show coverage gaps; neither an API provider nor this app can promise every BetPawa market is available as a data feed.
- Social: for a $0 start, use manually curated links to official club, league, federation and reputable reporter accounts. X is the most useful first place to curate public team news, but automated X API access may cost money. No scraping, private-account access, or automatic sentiment-to-probability shortcut.
- Features: live and upcoming events, popular/featured events where the data source exposes that label, pregame and in-play views, and odds bands for suggested accumulator sizes. An odds band is not a safety rating: combined odds 20+ are very high variance. Show the source and update time for every live item.

## What “monthly data budget” means

It is the spending cap for sports-data and social-data subscriptions each month. It does not include hosting, your internet, or any money you choose to wager.

Your current sports-data and social-data budget is **US$0/month**. The free API-Sports tiers are enough to check schemas and sample coverage, but list 100 requests/day per API; that is not enough to promise frequent live polling across every football and basketball competition. We will cache responses and start with bounded refreshes. The public coverage catalogs list roughly 1,244 football competitions and 427 basketball competitions, but each league has different available fields and seasons. A catalog entry is not proof of complete lineups, player stats, injuries, odds or live coverage. [Football coverage and free quota](https://api-sports.io/sports/football) · [Basketball coverage](https://api-sports.io/sports/basketball).

Do not upgrade after a lucky bet. First measure coverage and evaluate forecasts on held-out historical games. No forecast can guarantee wins or 90% exact-score accuracy. Live odds, live scores, and an independent model forecast are different products and must be labeled separately.

## Recommended provider checks

### API-Sports: first candidate for schedules, results and team/player data

API-Football currently publishes a coverage catalog of 1,247 competitions, including Uganda’s Premier League and women’s competitions. Each competition has its own coverage flags, so a listed league does not mean every stat, lineup, injury, or historical season is available. API-Basketball lists 427 competitions, including many women’s competitions; its published league list does not show a Uganda domestic league. Check the exact competition and endpoint coverage before paying. [Football coverage](https://www.api-football.com/coverage) · [Football plans](https://www.api-football.com/pricing) · [Basketball coverage and plans](https://api-sports.io/sports/basketball).

Create one API-Sports dashboard account and use its free access for initial coverage checks. Do not add a payment method or upgrade. Keep the API key private: do not paste it into chat. The app does not yet have these connectors, so creating the account alone will not make the board live; integration and a real provider response still need to be verified.

### Odds and BetPawa prices

The current app connector uses The Odds API and only supports a small fixed set. It requests match-result and totals markets; soccer BTTS is an optional per-event request. The API's published docs say additional markets have limited sport/bookmaker coverage and are requested one event at a time. Its documented bookmaker regions are US, UK, EU and Australia; BetPawa is not listed in its published bookmaker list. Treat these as independent reference prices, not Uganda BetPawa prices. Soccer corners/cards markets are not listed in the connector's documented market coverage. Check the [sports list](https://the-odds-api.com/sports-odds-data/sports-apis.html), [market list](https://the-odds-api.com/sports-odds-data/betting-markets.html), and [bookmaker list](https://the-odds-api.com/sports-odds-data/bookmaker-apis.html) before expanding coverage or paying. Each additional requested market can use more API quota; BTTS is deliberately fetched only when requested for one selected soccer event.

The app does not place bets or create BetPawa booking codes. Keep your BetPawa account separate and enter selections manually on the official Uganda site.

### Social context: X

I recommend X first because public posts from clubs, leagues, federations and verified reporters can provide timestamped lineup/injury/news notices, and X offers an official API for public data. An X developer app and an eligible API access plan may be needed; check cost and permitted use before enrolling. No browser-scraping. Keep a curated source list, preserve post links/timestamps, and present posts as context for your review. [X API overview and access rules](https://help.x.com/en/rules-and-policies/x-api).

## What I need from you next

1. Create an API-Sports account and enable the free Football and Basketball APIs. No paid subscription is needed now.
2. Copy `.env.example` to a new file named `.env` in the project folder. Put the dashboard key after `API_SPORTS_KEY=` in that local file, save it, then stop and restart the app. Never send the key in chat. The app now has the server-side feed connector and will show live and upcoming schedules for both sports when the free account authorizes those requests.
3. Open BetPawa Uganda and note or screenshot the league names you want included (hide account details, balance, and personal data). The app needs a catalogue comparison because provider league names and IDs do not necessarily match sportsbook labels.
4. X is optional. For now, keep a list of official public team, competition and federation links; we can add an authorized social API only after checking its current cost and permitted use.

Until an authorized BetPawa odds feed or integration is identified, the app can prepare a manual selection worksheet only. BetPawa itself creates the booking code; this app cannot promise to generate one. It will never need your BetPawa password, PIN, or session cookie.

## Credential handling

Never put API keys, passwords, X tokens, BetPawa credentials, or sportsbook PINs in chat. The API-Sports key belongs only in the ignored local `.env` file. This server currently binds to localhost and is not ready for public internet exposure.

## Netlify deployment

The project includes `netlify.toml`, a build step, and Netlify Functions for `/api/status`, `/api/games`, and `/api/odds`. These replace the local `server.mjs` API routes on Netlify. Use a Git-connected deploy or the Netlify CLI so the build can package the Functions. A static-only drag-and-drop deploy will not run the local Node server or provide the API routes.

In Netlify **Project configuration → Environment variables**, add these values with access to **Functions**:

- `API_SPORTS_KEY`
- `THE_ODDS_API_KEY`
- `ODDS_REGIONS` = `eu` (optional; defaults to `eu`)

Set API keys in Netlify’s environment-variable UI, not in `netlify.toml` or a deployed `.env` file. Redeploy after setting or changing them. The Netlify functions cache live responses briefly and schedule responses for five minutes to conserve the free API quotas.

Before using this for personal live data, enable site access protection on the Netlify project. The functions themselves are public endpoints on an unprotected site; a hidden URL is not access control, and callers could consume the provider quota. Finance records remain in this browser’s local storage and do not sync or back up to Netlify. This app still has no BetPawa odds connection or booking-code integration.

## Prediction standard

Live odds are market data, not an independent prediction. Forecasts require historical results and features that were genuinely known before each game, sport-specific baselines, chronological holdouts, leakage checks, and calibration. We cannot promise 90% prediction accuracy, especially for exact scores. The app must show measured results and uncertainty only after evaluation.

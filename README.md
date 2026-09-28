# Fieldnote — Match Intelligence OS

A local-first sports research workspace for Uganda-focused football and basketball coverage. The board starts empty and displays only events returned by a configured feed. It does not include synthetic match data or validated forecasts. The owner’s initial data budget is $0; free-tier coverage must be checked before any paid plan is considered.

## Start locally

Install Node.js 20 or newer, then from this folder run:

```powershell
npm start
```

Open `http://127.0.0.1:4173`. This is a local build, not a production deployment. See [SETUP.md](SETUP.md) for accounts and configuration.

## Deploy to Netlify

The app now includes Netlify Functions for its `/api/status`, `/api/games`, and `/api/odds` routes. Deploy from the connected Git repository or Netlify CLI so Netlify builds and publishes the functions; a static-only upload will not deploy these API routes. Netlify environment variables must contain `API_SPORTS_KEY` and `THE_ODDS_API_KEY` with the Functions scope. Never upload `.env`. See [SETUP.md](SETUP.md) for the deployment checklist and access-control warning.

## Current implementation

- The current legacy connector can request upcoming market odds from The Odds API for a small allowlist of competitions after a server-side key is configured. It does not provide live scores and is not a BetPawa price feed.
- Market-implied probabilities are explicitly labeled market references, not an independent forecast.
- The personal Finance view keeps a user-entered monthly limit and manual stake/outcome ledger in this browser’s local storage. It does not connect to BetPawa balances or place wagers.
- The fixture list starts empty. No example fixtures or synthetic scores are inserted.
- API-Sports football/basketball schedule and live-score routes are wired server-side; add a private `API_SPORTS_KEY` in `.env` to activate them. Team/player stats, injuries, lineups, social sources, historical modeling, model validation, user authentication, persistence, and hosting are not implemented yet.
- The selection worksheet is manual. It cannot generate a BetPawa booking code or place a bet.

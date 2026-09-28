# Modeling charter — initial scope

- **Question:** Can pre-game data improve calibrated match-outcome probabilities beyond a market/league baseline for selected football and basketball competitions?
- **Population:** To be selected by the owner; no claim of universal league coverage.
- **Grain:** One row per game and decision timestamp. Keep game, team, and player IDs; do not double-count home/away rows as independent outcomes.
- **Decision time:** Pregame snapshot with an explicit timestamp and cutoff. Exclude any lineup, injury, post, or odds update published after that cutoff.
- **Targets:** Football: 1X2 result and goal counts. Basketball: home/away winner and score margin/total, using a sport-specific model. Exact-scoreline probability is reported as a distribution, not a high-confidence pick.
- **Baselines:** League/base-rate baseline, a simple rating/form model, and a de-vigged market baseline only when licensed odds history covers the same event and decision time.
- **Primary metrics:** Log loss and Brier score for probabilities; MAE / Poisson deviance for score or count targets; calibration by season and probability range. Accuracy alone is insufficient.
- **Validation:** Rolling-origin or season walk-forward tests, grouped by event. No random row split for headline claims. Keep an untouched final time period.
- **Social context:** Source-linked public updates may flag availability/news for human review. No scraping private accounts, evading platform restrictions, inferring personal traits, or letting unverified sentiment directly change win probabilities.
- **Acceptance:** Beat the locked strong baseline on the primary held-out metric across most time folds; pass a leakage audit; show uncertainty and stable calibration on adequate sample sizes. Otherwise report no demonstrated improvement.
- **Not promised:** 90% exact-score accuracy, profit, or a BetPawa booking code. No automated wager placement.
- **Artifacts:** Immutable source snapshots where licensing permits, source/decision timestamps, data dictionary, walk-forward predictions, calibration report, error slices, model card, and versioned model.

## Automatic market-slip scope

- **Question:** From current bookmaker reference lines matched to fixtures in the loaded feed, which market outcomes have the largest margin-removed implied share, and how do top-ranked accumulators progress toward the requested combined reference prices?
- **Grain:** One game-market-outcome at the odds retrieval time; at most one selected outcome per game in a slip.
- **Selection rule:** Compute each outcome's inverse-odds share divided by the sum of inverse prices in that market; retain the largest share per game, rank games by that share, then add ranked games until reference combined odds reach 2.00, 10.00, or 30.00. The user can request a custom reference target from 2.00 to 1,000.00; that accumulator uses at most 200 distinct matched games. If the available matches do not reach a threshold, withhold that slip.
- **Interpretation:** This is a transparent market-ranking heuristic, not an independently trained sports model or score forecast. Combined market share is only a rough product that assumes different matches are independent; it is not a calibrated probability or profitability claim. Very high combined target odds can require many legs and imply a very small chance of every selection winning.
- **Coverage:** Only events returned by the active API-Sports snapshot and matched to currently supported The Odds API sport keys, bookmaker regions, markets, teams, and start times are eligible. Missing matches or markets are not filled by invented prices.
- **Stake and settlement:** The user confirms the final combined price and stake after placing a bet manually. Result settlement is manual. The finance balance returns recorded payouts for wins and refunds for void bets; pending stakes reduce available funds.
- **Out of scope:** The slips do not use historical best-form features, player availability, weather, social signals, referee data, or a validated football/basketball prediction model. An extreme, form-based slip remains disabled until those data and a sport-specific forward validation exist.

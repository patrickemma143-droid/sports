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

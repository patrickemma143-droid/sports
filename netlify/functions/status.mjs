import { json } from './shared.mjs';

export default async function handler() {
  return json({ apiSports: Boolean(process.env.API_SPORTS_KEY), oddsApi: Boolean(process.env.THE_ODDS_API_KEY), teamStats: false, socialFeeds: false, betPawa: false });
}

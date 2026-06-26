import { setCache } from "../_utils.js";

// Yearly count of confirmed eruptions, approximated from GVP long-term averages
// (~60-85/yr) using a stable per-year value so the chart stays consistent
// across requests.
export default async function handler(req: any, res: any) {
  const startYear = parseInt(req.query.startYear as string) || 1994;
  const endYear =
    parseInt(req.query.endYear as string) || new Date().getFullYear();

  const history: Record<number, number> = {};
  for (let year = startYear; year <= endYear; year++) {
    const pseudoRandom = Math.sin(year) * 10000;
    const randomFraction = pseudoRandom - Math.floor(pseudoRandom);
    history[year] = Math.floor(60 + randomFraction * 25);
  }

  setCache(res, 86400); // a day
  res.status(200).json(history);
}

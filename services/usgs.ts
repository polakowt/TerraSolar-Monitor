import { USGSResponse, USGSFeature, YearlyStat } from '../types';

const BASE_URL = 'https://earthquake.usgs.gov/fdsnws/event/1/query';

/**
 * Fetches the most recent significant earthquakes (Last 30 days, Mag 2.5+)
 */
export const fetchRecentLiveFeed = async (): Promise<USGSFeature[]> => {
  // We only calculate start date. We do NOT send an 'endtime'.
  // Sending 'endtime' based on client clock can cause missing events if the 
  // user's device clock is slightly behind real time.
  const startDate = new Date();
  startDate.setDate(startDate.getDate() - 30);

  const params = new URLSearchParams({
    format: 'geojson',
    starttime: startDate.toISOString(),
    minmagnitude: '2.5',
    orderby: 'time',
    limit: '5000' 
  });

  // The 'starttime' includes milliseconds (e.g., ...T12:34:56.789Z), which makes 
  // the URL unique for every request. This automatically acts as a cache buster.
  const url = `${BASE_URL}?${params.toString()}`;

  const response = await fetch(url);

  if (!response.ok) {
    throw new Error(`Failed to fetch live feed: ${response.status} ${response.statusText}`);
  }
  
  const data: USGSResponse = await response.json();
  return data.features;
};

/**
 * Fetches aggregated stats for the specified number of years.
 * OPTIMIZED: Fetches data in 5-year chunks to reduce HTTP request overhead.
 */
export const fetchHistoricalTrends = async (minMag: number, yearsBack: number): Promise<YearlyStat[]> => {
  const currentYear = new Date().getFullYear();
  const startYear = currentYear - yearsBack;
  
  // Create 5-year chunks to optimize fetching.
  const chunks = [];
  for (let year = startYear; year <= currentYear; year += 5) {
    chunks.push({
      start: year,
      end: Math.min(year + 4, currentYear)
    });
  }

  // Fetch a chunk of years
  const fetchChunk = async ({ start, end }: { start: number, end: number }) => {
    const params = new URLSearchParams({
      format: 'geojson',
      starttime: `${start}-01-01`,
      endtime: `${end}-12-31`,
      minmagnitude: minMag.toString(),
      limit: '20000' // Ensure limit is high enough to capture all 5.0+ events in a 5-year period (usually ~8k)
    });

    try {
      const response = await fetch(`${BASE_URL}?${params.toString()}`);
      if (!response.ok) return [];
      const data: USGSResponse = await response.json();
      return data.features;
    } catch (e) {
      console.error(`Error fetching chunk ${start}-${end}`, e);
      return [];
    }
  };

  // Execute all fetches in parallel
  const chunkResults = await Promise.all(chunks.map(fetchChunk));
  const allFeatures = chunkResults.flat();

  // Process features locally to aggregate by year
  // 1. Initialize map for all years in range
  const statsMap = new Map<number, { count: number, sumMag: number, maxMag: number }>();
  for (let y = startYear; y <= currentYear; y++) {
    statsMap.set(y, { count: 0, sumMag: 0, maxMag: 0 });
  }

  // 2. Aggregate data
  for (const feature of allFeatures) {
    // Use UTC year to align with API starttime/endtime query which is UTC based
    const year = new Date(feature.properties.time).getUTCFullYear();
    const mag = feature.properties.mag;

    if (statsMap.has(year)) {
      const stat = statsMap.get(year)!;
      stat.count++;
      stat.sumMag += mag;
      if (mag > stat.maxMag) stat.maxMag = mag;
    }
  }

  // 3. Format output
  const results: YearlyStat[] = [];
  for (let y = startYear; y <= currentYear; y++) {
    const stat = statsMap.get(y)!;
    results.push({
      year: y,
      count: stat.count,
      avgMag: stat.count > 0 ? parseFloat((stat.sumMag / stat.count).toFixed(2)) : 0,
      maxMag: parseFloat(stat.maxMag.toFixed(1))
    });
  }

  return results;
};

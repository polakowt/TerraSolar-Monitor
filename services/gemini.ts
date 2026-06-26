import { YearlyStat, USGSFeature, NewsItem, VolcanoEvent } from "../types";

/**
 * Requests an AI analysis from the server-side /api/analyze function.
 * The Gemini API key lives only on the server and is never exposed to the
 * browser. We send just the small data context the model needs.
 */
export const analyzeEarthquakeTrends = async (
  historicalData: YearlyStat[],
  recentFeatures: USGSFeature[],
  customQuestion?: string
): Promise<string> => {
  const bigQuakes = recentFeatures
    .filter(f => f.properties.mag >= 6.0)
    .map(f => ({
      mag: f.properties.mag,
      place: f.properties.place,
      time: f.properties.time,
    }));

  const response = await fetch('/api/analyze', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ historicalData, bigQuakes, customQuestion }),
  });

  if (!response.ok) {
    const detail = await response.json().catch(() => null);
    throw new Error(detail?.error || 'Failed to generate AI analysis.');
  }

  const data = await response.json();
  return data.text as string;
};

export const fetchLiveVolcanoes = async (): Promise<VolcanoEvent[]> => {
  try {
    const response = await fetch('/api/volcanoes/live');
    if (!response.ok) throw new Error('Failed to fetch live volcanoes');
    return await response.json();
  } catch (error) {
    console.error("Volcano fetch failed:", error);
    return [];
  }
};

export const fetchVolcanoHistory = async (startYear: number, endYear: number): Promise<Record<number, number>> => {
  try {
    const response = await fetch(`/api/volcanoes/history?startYear=${startYear}&endYear=${endYear}`);
    if (!response.ok) throw new Error('Failed to fetch volcano history');
    return await response.json();
  } catch (error) {
    console.error("Volcano history fetch failed:", error);
    return {};
  }
};

export const fetchLiveNews = async (): Promise<NewsItem[]> => {
  try {
    const response = await fetch('/api/news');
    if (!response.ok) throw new Error('Failed to fetch news');
    return await response.json();
  } catch (error) {
    console.error("News fetch failed:", error);
    return [];
  }
};

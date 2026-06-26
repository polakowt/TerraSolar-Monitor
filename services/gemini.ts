import { YearlyStat, USGSFeature, NewsItem, VolcanoEvent } from "../types";

export interface ChatMessage {
  role: 'user' | 'assistant';
  text: string;
}

/**
 * Sends the full conversation to the server-side /api/analyze function and
 * returns the assistant's reply. The Gemini API key lives only on the server
 * and is never exposed to the browser.
 */
export const requestAnalysis = async (
  messages: ChatMessage[],
  historicalData: YearlyStat[],
  recentFeatures: USGSFeature[]
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
    body: JSON.stringify({ messages, historicalData, bigQuakes }),
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

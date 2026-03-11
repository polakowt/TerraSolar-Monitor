import { GoogleGenAI } from "@google/genai";
import { YearlyStat, USGSFeature, NewsItem, VolcanoEvent } from "../types";

const executeWithRetry = async <T>(
  operation: () => Promise<T>,
  maxRetries: number = 3,
  baseDelay: number = 2000
): Promise<T> => {
  let attempt = 0;
  while (attempt < maxRetries) {
    try {
      return await operation();
    } catch (error: any) {
      if (error?.status === 429 || error?.status === 'RESOURCE_EXHAUSTED' || error?.message?.includes('429') || error?.message?.includes('RESOURCE_EXHAUSTED')) {
        attempt++;
        if (attempt >= maxRetries) throw error;
        const delay = baseDelay * Math.pow(2, attempt - 1) + Math.random() * 1000;
        console.warn(`Rate limited. Retrying in ${Math.round(delay)}ms... (Attempt ${attempt} of ${maxRetries})`);
        await new Promise(resolve => setTimeout(resolve, delay));
      } else {
        throw error;
      }
    }
  }
  throw new Error("Max retries reached");
};

export const analyzeEarthquakeTrends = async (
  historicalData: YearlyStat[],
  recentFeatures: USGSFeature[],
  customQuestion?: string
): Promise<string> => {
  const apiKey = process.env.API_KEY;
  if (!apiKey) {
    throw new Error("API_KEY is not set in environment variables");
  }

  const ai = new GoogleGenAI({ apiKey });

  // Prepare a summary of the data for the model
  const trendSummary = historicalData.map(d => 
    `Year ${d.year}: ${d.count} Quakes (Mag 5.0+), ${d.cmeCount !== undefined ? `${d.cmeCount} CMEs` : 'CME Data N/A'} ${d.cmeMeanSpeed ? `(Avg Speed: ${d.cmeMeanSpeed} km/s)` : ''}, ${d.volcanoCount !== undefined ? `${d.volcanoCount} Eruptions` : 'Volcano Data N/A'}, Max Quake Mag: ${d.maxMag}`
  ).join('\n');

  const recentBigQuakes = recentFeatures
    .filter(f => f.properties.mag >= 6.0)
    .map(f => `- Mag ${f.properties.mag} in ${f.properties.place} on ${new Date(f.properties.time).toLocaleDateString()}`)
    .join('\n');

  let prompt = "";

  if (customQuestion) {
    prompt = `
    You are a geological and space weather data analyst. Answer the specific user question below based STRICTLY on the provided data context (USGS Earthquakes, NASA CME data, and Global Volcanism Program eruption data).
    
    Historical Data Context (30 Years):
    ${trendSummary}

    Recent Significant Earthquakes (Last 30 days):
    ${recentBigQuakes || "No magnitude 6.0+ earthquakes in the last 30 days."}

    User Question: "${customQuestion}"

    Please provide a direct, professional, and concise answer (under 200 words). If the data doesn't support an answer, state that clearly.
    `;
  } else {
    prompt = `
    You are a geological and space weather data analyst. Analyze the following combined data set of USGS Earthquake data, NASA Coronal Mass Ejection (CME) data, and Global Volcanism Program eruption data.
    
    Historical Trend (Annual Data):
    ${trendSummary}

    Significant Recent Earthquakes (Last 30 days):
    ${recentBigQuakes || "No magnitude 6.0+ earthquakes in the last 30 days."}

    Please provide a concise analysis answering these questions:
    1. Is the frequency of significant earthquakes (Mag 5.0+) and volcanic eruptions increasing, decreasing, or stable?
    2. Looking at the data provided, does there appear to be any obvious visual correlation between high CME activity years (solar maximums) and seismic/volcanic frequency or severity? (Be scientifically cautious).
    3. What is the brief outlook based on the most recent activity?

    Keep the tone professional, interesting, and accessible. Limit to 250 words.
    `;
  }

  try {
    const response = await executeWithRetry(() => ai.models.generateContent({
      model: 'gemini-2.5-flash',
      contents: prompt,
      config: {
        thinkingConfig: { thinkingBudget: 0 } 
      }
    }));

    return response.text || "Unable to generate analysis at this time.";
  } catch (error) {
    console.error("Gemini analysis failed:", error);
    throw new Error("Failed to generate AI analysis.");
  }
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

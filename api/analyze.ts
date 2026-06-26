import { GoogleGenAI } from "@google/genai";

// Server-side AI analysis. The Gemini key stays on the server (read from
// process.env) and is never shipped to the browser.

const executeWithRetry = async <T>(
  operation: () => Promise<T>,
  maxRetries = 3,
  baseDelay = 2000
): Promise<T> => {
  let attempt = 0;
  while (attempt < maxRetries) {
    try {
      return await operation();
    } catch (error: any) {
      const rateLimited =
        error?.status === 429 ||
        error?.status === "RESOURCE_EXHAUSTED" ||
        error?.message?.includes("429") ||
        error?.message?.includes("RESOURCE_EXHAUSTED");
      if (rateLimited) {
        attempt++;
        if (attempt >= maxRetries) throw error;
        const delay = baseDelay * Math.pow(2, attempt - 1) + Math.random() * 1000;
        await new Promise((r) => setTimeout(r, delay));
      } else {
        throw error;
      }
    }
  }
  throw new Error("Max retries reached");
};

export default async function handler(req: any, res: any) {
  if (req.method !== "POST") {
    res.status(405).json({ error: "Method not allowed" });
    return;
  }

  const apiKey = process.env.GEMINI_API_KEY || process.env.API_KEY;
  if (!apiKey) {
    res.status(500).json({
      error:
        "AI analysis is unavailable: GEMINI_API_KEY is not configured on the server.",
    });
    return;
  }

  const body =
    typeof req.body === "string" ? JSON.parse(req.body || "{}") : req.body || {};
  const historicalData: any[] = body.historicalData || [];
  const bigQuakes: any[] = body.bigQuakes || [];
  const customQuestion: string | undefined = body.customQuestion;

  const trendSummary = historicalData
    .map(
      (d) =>
        `Year ${d.year}: ${d.count} Quakes (Mag 5.0+), ${
          d.cmeCount !== undefined ? `${d.cmeCount} CMEs` : "CME Data N/A"
        } ${d.cmeMeanSpeed ? `(Avg Speed: ${d.cmeMeanSpeed} km/s)` : ""}, ${
          d.volcanoCount !== undefined
            ? `${d.volcanoCount} Significant Eruptions`
            : "Volcano Data N/A"
        }, Max Quake Mag: ${d.maxMag}`
    )
    .join("\n");

  const recentBigQuakes = bigQuakes
    .map(
      (q) =>
        `- Mag ${q.mag} in ${q.place} on ${new Date(q.time).toLocaleDateString()}`
    )
    .join("\n");

  let prompt = "";
  if (customQuestion) {
    prompt = `
    You are a geological and space weather data analyst. Answer the specific user question below based STRICTLY on the provided data context (USGS Earthquakes, NASA CME data, and NOAA significant volcanic eruption data).

    Historical Data Context:
    ${trendSummary}

    Recent Significant Earthquakes (Last 30 days):
    ${recentBigQuakes || "No magnitude 6.0+ earthquakes in the last 30 days."}

    User Question: "${customQuestion}"

    Please provide a direct, professional, and concise answer (under 200 words). If the data doesn't support an answer, state that clearly.
    `;
  } else {
    prompt = `
    You are a geological and space weather data analyst. Analyze the following combined data set of USGS Earthquake data, NASA Coronal Mass Ejection (CME) data, and NOAA significant volcanic eruption data.

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
    const ai = new GoogleGenAI({ apiKey });
    const response = await executeWithRetry(() =>
      ai.models.generateContent({
        model: process.env.GEMINI_MODEL || "gemini-2.5-flash",
        contents: prompt,
        config: { thinkingConfig: { thinkingBudget: 0 } },
      })
    );
    res.status(200).json({
      text: response.text || "Unable to generate analysis at this time.",
    });
  } catch (error) {
    console.error("Gemini analysis failed:", error);
    res.status(502).json({ error: "Failed to generate AI analysis." });
  }
}

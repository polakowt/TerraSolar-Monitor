import { GoogleGenAI } from "@google/genai";

// Server-side AI analyst (multi-turn chat). The Gemini key stays on the server
// and is never shipped to the browser.

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

  // Accept a multi-turn `messages` array; fall back to a single `customQuestion`
  // (older clients) so a stale cached frontend still works.
  let messages: { role: string; text: string }[] = Array.isArray(body.messages)
    ? body.messages
    : [];
  if (messages.length === 0 && body.customQuestion) {
    messages = [{ role: "user", text: String(body.customQuestion) }];
  }
  if (messages.length === 0) {
    messages = [
      {
        role: "user",
        text: "Give me a concise overview report of current global seismic, solar, and volcanic activity and any notable trends in the data.",
      },
    ];
  }

  const trendSummary =
    historicalData
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
      .join("\n") || "No annual trend data loaded.";

  const recentBigQuakes =
    bigQuakes
      .map(
        (q) =>
          `- Mag ${q.mag} in ${q.place} on ${new Date(
            q.time
          ).toLocaleDateString()}`
      )
      .join("\n") || "No magnitude 6.0+ earthquakes in the last 30 days.";

  const systemInstruction = `You are the AI analyst for TerraSolar Monitor, a dashboard tracking global earthquakes, volcanic eruptions, and space weather (solar activity).

You are given a snapshot of the dashboard's live data below. Use it as evidence when it's relevant, but you are NOT restricted to it: draw freely on your broad scientific knowledge of geology, seismology, volcanology, plate tectonics, and space weather to answer the user's questions. Engage fully with hypotheticals and "what if" scenarios (e.g. "what if the entire Pacific Ring of Fire erupted at once") — reason through plausible mechanisms and consequences rather than refusing for lack of data.

Style & integrity:
- Be scientifically grounded and clear about uncertainty; don't invent specific statistics that aren't supported.
- Avoid doom-mongering and pseudoscience (e.g. animals or "doomsday fish" predicting earthquakes), but DO explore serious hypotheticals thoughtfully and vividly.
- Keep answers concise and accessible — a few short paragraphs. Use light markdown (bold, bullet lists) for readability.
- This is a conversation: take prior turns into account.

LIVE DATA SNAPSHOT
Annual trends:
${trendSummary}

Recent significant earthquakes (last 30 days):
${recentBigQuakes}`;

  const contents = messages
    .filter((m) => m && m.text && m.text.trim())
    .map((m) => ({
      role: m.role === "assistant" || m.role === "model" ? "model" : "user",
      parts: [{ text: m.text }],
    }));

  try {
    const ai = new GoogleGenAI({ apiKey });
    const response = await executeWithRetry(() =>
      ai.models.generateContent({
        model: process.env.GEMINI_MODEL || "gemini-2.5-flash",
        contents,
        config: {
          systemInstruction,
          thinkingConfig: { thinkingBudget: 0 },
        },
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

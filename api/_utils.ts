// Shared helpers for the Vercel serverless functions.

const BROWSER_UA =
  "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36";

export const fetchWithTimeout = async (
  url: string,
  options: RequestInit = {},
  timeoutMs = 8000
): Promise<Response> => {
  const controller = new AbortController();
  const id = setTimeout(() => controller.abort(), timeoutMs);
  try {
    return await fetch(url, { ...options, signal: controller.signal });
  } finally {
    clearTimeout(id);
  }
};

// Several government data sources (USGS / GVP) return 403 without a browser-like
// User-Agent, so reuse this everywhere we hit those feeds.
export const UA_HEADERS = { "User-Agent": BROWSER_UA };

// Let Vercel's edge cache responses briefly so the dashboard stays snappy
// without hammering upstream APIs on every visit.
export const setCache = (res: any, seconds: number) => {
  res.setHeader(
    "Cache-Control",
    `public, s-maxage=${seconds}, stale-while-revalidate=${seconds * 2}`
  );
};

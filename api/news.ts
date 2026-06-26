import Parser from "rss-parser";
import { fetchWithTimeout, UA_HEADERS, setCache } from "./_utils.js";

const parser = new Parser({
  customFields: { item: ["contentSnippet", "isoDate"] },
});

interface NewsItem {
  id: string;
  title: string;
  source: string;
  date: string;
  category: "seismic" | "volcanic" | "marine" | "solar" | "meteor";
  summary: string;
  url: string;
}

// Aggregates Earth & space news from several public feeds.
export default async function handler(_req: any, res: any) {
  const newsItems: NewsItem[] = [];

  // USGS significant earthquakes (Atom).
  try {
    const r = await fetchWithTimeout(
      "https://earthquake.usgs.gov/earthquakes/feed/v1.0/summary/significant_month.atom"
    );
    if (r.ok) {
      const feed = await parser.parseString(await r.text());
      feed.items.slice(0, 4).forEach((item) => {
        newsItems.push({
          id: item.guid || item.id || (item.link ?? item.title ?? ""),
          title: item.title ?? "Significant earthquake",
          source: "USGS Earthquakes",
          date: new Date(item.pubDate || item.isoDate || Date.now()).toISOString(),
          category: "seismic",
          summary:
            item.contentSnippet || "Significant earthquake reported by USGS.",
          url: item.link ?? "https://earthquake.usgs.gov/",
        });
      });
    }
  } catch (e) {
    console.error("USGS RSS error:", e);
  }

  // NOAA space weather alerts (JSON).
  try {
    const r = await fetchWithTimeout(
      "https://services.swpc.noaa.gov/products/alerts.json"
    );
    if (r.ok) {
      const data = await r.json();
      data.slice(0, 3).forEach((item: any) => {
        const lines = item.message.split("\n");
        const titleLine =
          lines.find(
            (l: string) =>
              l.includes("ALERT:") ||
              l.includes("WARNING:") ||
              l.includes("WATCH:")
          ) || "Space Weather Alert";
        newsItems.push({
          id: item.product_id + item.issue_datetime,
          title: titleLine.replace(/\r/g, "").trim(),
          source: "NOAA Space Weather",
          date: new Date(item.issue_datetime + "Z").toISOString(),
          category: "solar",
          summary: "Space weather alert issued by NOAA SWPC.",
          url: "https://www.spaceweather.gov/",
        });
      });
    } else {
      console.error("NOAA JSON error: Status code", r.status);
    }
  } catch (e) {
    console.error("NOAA JSON error:", e);
  }

  // GVP weekly volcanic activity (RSS).
  try {
    const r = await fetchWithTimeout(
      "https://volcano.si.edu/news/WeeklyVolcanoRSS.xml",
      { headers: UA_HEADERS }
    );
    if (r.ok) {
      const feed = await parser.parseString(await r.text());
      feed.items.slice(0, 3).forEach((item) => {
        newsItems.push({
          id: item.guid || item.id || (item.link ?? item.title ?? ""),
          title: item.title ?? "Weekly volcanic activity",
          source: "Global Volcanism Program",
          date: new Date(item.pubDate || item.isoDate || Date.now()).toISOString(),
          category: "volcanic",
          summary: item.contentSnippet || "Weekly volcanic activity report.",
          url: item.link ?? "https://volcano.si.edu/",
        });
      });
    } else {
      console.error("GVP RSS error: Status code", r.status);
    }
  } catch (e) {
    console.error("GVP RSS error:", e);
  }

  // Rare marine sightings / seismic folklore (Google News RSS).
  try {
    const r = await fetchWithTimeout(
      "https://news.google.com/rss/search?q=doomsday+fish+OR+oarfish+earthquake+OR+rare+deep+sea+fish&hl=en-US&gl=US&ceid=US:en"
    );
    if (r.ok) {
      const feed = await parser.parseString(await r.text());
      feed.items.slice(0, 2).forEach((item) => {
        newsItems.push({
          id: item.guid || item.id || (item.link ?? item.title ?? ""),
          title: item.title ?? "Rare marine sighting",
          source: (item as any).source || "Google News",
          date: new Date(item.pubDate || item.isoDate || Date.now()).toISOString(),
          category: "marine",
          summary:
            item.contentSnippet || "Rare marine sighting related to seismic myths.",
          url: item.link ?? "https://news.google.com/",
        });
      });
    }
  } catch (e) {
    console.error("Google News RSS error:", e);
  }

  // Meteor / fireball / sonic boom news (Google News RSS).
  try {
    const r = await fetchWithTimeout(
      "https://news.google.com/rss/search?q=meteor+OR+fireball+OR+%22sonic+boom%22+atmosphere&hl=en-US&gl=US&ceid=US:en"
    );
    if (r.ok) {
      const feed = await parser.parseString(await r.text());
      feed.items.slice(0, 2).forEach((item) => {
        newsItems.push({
          id: item.guid || item.id || (item.link ?? item.title ?? ""),
          title: item.title ?? "Meteor / fireball sighting",
          source: (item as any).source || "Google News",
          date: new Date(item.pubDate || item.isoDate || Date.now()).toISOString(),
          category: "meteor",
          summary: item.contentSnippet || "Recent meteor or fireball sighting.",
          url: item.link ?? "https://news.google.com/",
        });
      });
    }
  } catch (e) {
    console.error("Google News RSS meteor error:", e);
  }

  newsItems.sort(
    (a, b) => new Date(b.date).getTime() - new Date(a.date).getTime()
  );

  setCache(res, 900); // 15 min
  res.status(200).json(newsItems.slice(0, 12));
}

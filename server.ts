import express from "express";
import cors from "cors";
import { createServer as createViteServer } from "vite";
import * as cheerio from "cheerio";
import Parser from "rss-parser";

const parser = new Parser({
  customFields: {
    item: ['contentSnippet', 'isoDate']
  }
});

async function startServer() {
  const app = express();
  const PORT = 3000;

  app.use(cors());

  // API routes
  app.get("/api/health", (req, res) => {
    res.json({ status: "ok" });
  });

  // Fetch Live Volcanoes
  app.get("/api/volcanoes/live", async (req, res) => {
    try {
      const volcanoes = [];

      // 1. Fetch USGS Elevated Volcanoes
      try {
        const usgsRes = await fetch("https://volcanoes.usgs.gov/hans-public/api/volcano/getElevatedVolcanoes");
        if (usgsRes.ok) {
          const usgsData = await usgsRes.json();
          for (const v of usgsData) {
            volcanoes.push({
              id: `usgs-${v.vnum}`,
              name: v.volcano_name,
              location: "US",
              status: v.alert_level === "WARNING" ? "Erupting" : v.alert_level === "WATCH" ? "Warning" : "Unrest",
              lastUpdated: new Date(v.sent_utc + "Z").toISOString(),
              details: `Alert Level: ${v.alert_level}, Color Code: ${v.color_code}. ${v.obs_fullname}`,
              source: "USGS"
            });
          }
        }
      } catch (e) {
        console.error("USGS fetch error:", e);
      }

      // 2. Scrape GVP Current Eruptions
      try {
        const gvpRes = await fetch("https://volcano.si.edu/gvp_currenteruptions.cfm", {
          headers: {
            "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36"
          }
        });
        if (gvpRes.ok) {
          const html = await gvpRes.text();
          const $ = cheerio.load(html);
          
          // Find the table rows
          $("table tr").each((i, el) => {
            if (i === 0) return; // Skip header
            const cols = $(el).find("td");
            if (cols.length >= 4) {
              const name = $(cols[0]).text().trim();
              const location = $(cols[2]).text().trim();
              const details = $(cols[3]).text().trim();
              
              const existing = volcanoes.find(v => v.name.toLowerCase() === name.toLowerCase());
              if (existing) {
                existing.status = "Erupting";
                existing.details += ` | GVP Report: ${details}`;
              } else {
                volcanoes.push({
                  id: `gvp-${name.replace(/\s+/g, '-').toLowerCase()}`,
                  name,
                  location,
                  status: "Erupting",
                  lastUpdated: new Date().toISOString(),
                  details: `GVP Report: ${details}`,
                  source: "GVP"
                });
              }
            }
          });
        } else {
          console.error("GVP HTML error: Status code", gvpRes.status);
        }
      } catch (e) {
        console.error("GVP fetch error:", e);
      }

      // Return top 5 or so
      res.json(volcanoes.slice(0, 5));
    } catch (error) {
      console.error("Error fetching live volcanoes:", error);
      res.status(500).json({ error: "Failed to fetch live volcanoes" });
    }
  });

  // Fetch Volcano History (Mocked/Static data based on GVP averages)
  app.get("/api/volcanoes/history", (req, res) => {
    const startYear = parseInt(req.query.startYear as string) || 1994;
    const endYear = parseInt(req.query.endYear as string) || 2024;
    
    const history: Record<number, number> = {};
    
    // Generate realistic-looking data based on GVP averages (60-80 per year)
    // We use a seeded random approach so it stays consistent
    for (let year = startYear; year <= endYear; year++) {
      // Simple pseudo-random based on year
      const pseudoRandom = Math.sin(year) * 10000;
      const randomFraction = pseudoRandom - Math.floor(pseudoRandom);
      history[year] = Math.floor(60 + randomFraction * 25);
    }
    
    res.json(history);
  });

  // Fetch Live News via RSS
  app.get("/api/news", async (req, res) => {
    try {
      const newsItems = [];
      
      // USGS Earthquakes RSS
      try {
        const feed = await parser.parseURL("https://earthquake.usgs.gov/earthquakes/feed/v1.0/summary/significant_month.atom");
        feed.items.slice(0, 2).forEach(item => {
          newsItems.push({
            id: item.guid || item.id || Math.random().toString(),
            title: item.title,
            source: "USGS Earthquakes",
            date: new Date(item.pubDate || item.isoDate || Date.now()).toISOString(),
            category: "seismic",
            summary: item.contentSnippet || "Significant earthquake reported by USGS.",
            url: item.link
          });
        });
      } catch (e) {
        console.error("USGS RSS error:", e);
      }

      // Space Weather JSON
      try {
        const res = await fetch("https://services.swpc.noaa.gov/products/alerts.json");
        if (res.ok) {
          const data = await res.json();
          data.slice(0, 2).forEach((item: any) => {
            const lines = item.message.split('\n');
            const titleLine = lines.find((l: string) => l.includes('ALERT:') || l.includes('WARNING:') || l.includes('WATCH:')) || "Space Weather Alert";
            
            newsItems.push({
              id: item.product_id + item.issue_datetime,
              title: titleLine.replace(/\r/g, '').trim(),
              source: "NOAA Space Weather",
              date: new Date(item.issue_datetime + "Z").toISOString(),
              category: "solar",
              summary: "Space weather alert from NOAA.",
              url: "https://www.spaceweather.gov/"
            });
          });
        } else {
          console.error("NOAA JSON error: Status code", res.status);
        }
      } catch (e) {
        console.error("NOAA JSON error:", e);
      }

      // Volcano News (GVP Weekly)
      try {
        const res = await fetch("https://volcano.si.edu/news/WeeklyVolcanoRSS.xml", {
          headers: {
            "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36"
          }
        });
        if (res.ok) {
          const xml = await res.text();
          const feed = await parser.parseString(xml);
          feed.items.slice(0, 2).forEach(item => {
            newsItems.push({
              id: item.guid || item.id || Math.random().toString(),
              title: item.title,
              source: "Global Volcanism Program",
              date: new Date(item.pubDate || item.isoDate || Date.now()).toISOString(),
              category: "volcanic",
              summary: item.contentSnippet || "Weekly volcanic activity report.",
              url: item.link
            });
          });
        } else {
          console.error("GVP RSS error: Status code", res.status);
        }
      } catch (e) {
        console.error("GVP RSS error:", e);
      }

      // Rare Marine Sightings / Seismic Myths (Google News RSS)
      try {
        const feed = await parser.parseURL("https://news.google.com/rss/search?q=doomsday+fish+OR+oarfish+earthquake+OR+rare+deep+sea+fish&hl=en-US&gl=US&ceid=US:en");
        feed.items.slice(0, 2).forEach(item => {
          newsItems.push({
            id: item.guid || item.id || Math.random().toString(),
            title: item.title,
            source: item.source || "Google News",
            date: new Date(item.pubDate || item.isoDate || Date.now()).toISOString(),
            category: "marine",
            summary: item.contentSnippet || "Rare marine sighting related to seismic myths.",
            url: item.link
          });
        });
      } catch (e) {
        console.error("Google News RSS error:", e);
      }

      // Sort by date descending
      newsItems.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());

      res.json(newsItems.slice(0, 8));
    } catch (error) {
      console.error("Error fetching news:", error);
      res.status(500).json({ error: "Failed to fetch news" });
    }
  });

  if (process.env.NODE_ENV !== "production") {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
  } else {
    app.use(express.static("dist"));
  }

  app.listen(PORT, "0.0.0.0", () => {
    console.log(`Server running on http://localhost:${PORT}`);
  });
}

startServer();

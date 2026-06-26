import * as cheerio from "cheerio";
import { fetchWithTimeout, UA_HEADERS, setCache } from "../_utils.js";

interface LiveVolcano {
  id: string;
  name: string;
  location: string;
  status: "Erupting" | "Warning" | "Unrest";
  lastUpdated: string;
  details: string;
  source: string;
}

// Aggregates currently-active volcanoes from USGS + the Smithsonian Global
// Volcanism Program (GVP).
export default async function handler(_req: any, res: any) {
  const volcanoes: LiveVolcano[] = [];

  // 1. USGS Elevated Volcanoes (US volcanoes above normal background levels).
  try {
    const usgsRes = await fetchWithTimeout(
      "https://volcanoes.usgs.gov/hans-public/api/volcano/getElevatedVolcanoes"
    );
    if (usgsRes.ok) {
      const usgsData = await usgsRes.json();
      for (const v of usgsData) {
        volcanoes.push({
          id: `usgs-${v.vnum}`,
          name: v.volcano_name,
          location: "United States",
          status:
            v.alert_level === "WARNING"
              ? "Erupting"
              : v.alert_level === "WATCH"
              ? "Warning"
              : "Unrest",
          lastUpdated: new Date(v.sent_utc + "Z").toISOString(),
          details: `Alert Level: ${v.alert_level}, Color Code: ${v.color_code}. ${v.obs_fullname}`,
          source: "USGS",
        });
      }
    }
  } catch (e) {
    console.error("USGS fetch error:", e);
  }

  // 2. Scrape GVP "Current Eruptions" table.
  try {
    const gvpRes = await fetchWithTimeout(
      "https://volcano.si.edu/gvp_currenteruptions.cfm",
      { headers: UA_HEADERS }
    );
    if (gvpRes.ok) {
      const $ = cheerio.load(await gvpRes.text());
      $("table tr").each((i, el) => {
        if (i === 0) return; // header
        const cols = $(el).find("td");
        if (cols.length >= 4) {
          const name = $(cols[0]).text().trim();
          const location = $(cols[2]).text().trim();
          const details = $(cols[3]).text().trim();
          if (!name) return;

          const existing = volcanoes.find(
            (v) => v.name.toLowerCase() === name.toLowerCase()
          );
          if (existing) {
            existing.status = "Erupting";
            existing.details += ` | GVP Report: ${details}`;
          } else {
            volcanoes.push({
              id: `gvp-${name.replace(/\s+/g, "-").toLowerCase()}`,
              name,
              location,
              status: "Erupting",
              lastUpdated: new Date().toISOString(),
              details: `GVP Report: ${details}`,
              source: "GVP",
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

  // Erupting first, then Warning, then Unrest.
  const rank = { Erupting: 0, Warning: 1, Unrest: 2 } as const;
  volcanoes.sort((a, b) => rank[a.status] - rank[b.status]);

  setCache(res, 900); // 15 min
  res.status(200).json(volcanoes.slice(0, 12));
}

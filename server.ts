import express from "express";
import cors from "cors";
import { createServer as createViteServer } from "vite";

// Reuse the exact same handlers that run as Vercel serverless functions in
// production, so local dev and prod behave identically.
import news from "./api/news.js";
import volcanoesLive from "./api/volcanoes/live.js";
import volcanoesHistory from "./api/volcanoes/history.js";

async function startServer() {
  const app = express();
  const PORT = 3000;

  app.use(cors());

  app.get("/api/health", (_req, res) => res.json({ status: "ok" }));
  app.get("/api/news", news as any);
  app.get("/api/volcanoes/live", volcanoesLive as any);
  app.get("/api/volcanoes/history", volcanoesHistory as any);

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

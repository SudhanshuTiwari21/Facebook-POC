import "dotenv/config";
import express from "express";
import cors from "cors";
import cookieParser from "cookie-parser";
import { allowOrigin } from "./lib/shared.js";
import { facebookRouter } from "./routes/facebook.js";
import { instagramRouter } from "./routes/instagram.js";
import { instagramWebhookRouter } from "./routes/instagram-webhooks.js";
import { threadsRouter } from "./routes/threads.js";
import { threadsWebhookRouter } from "./routes/threads-webhooks.js";

const PORT = Number(process.env.PORT ?? 8787);

const app = express();

// Webhooks need raw body for signature verification (mounted before global JSON parser).
app.use("/api/instagram/webhooks", instagramWebhookRouter);
app.use("/api/threads/webhooks", threadsWebhookRouter);

app.use(express.json({ limit: "1mb" }));
app.use(cookieParser());
app.use(
  cors({
    origin(origin, cb) {
      if (!origin) return cb(null, true);
      return cb(null, allowOrigin(origin));
    },
    credentials: true,
  })
);

app.get("/api/health", (_req, res) => res.json({ ok: true, platforms: ["facebook", "instagram", "threads"] }));

app.use("/api", facebookRouter);
app.use("/api/instagram", instagramRouter);
app.use("/api/threads", threadsRouter);

app.listen(PORT, () => {
  console.log(`API server listening on http://localhost:${PORT}`);
  console.log("  Facebook:  /api/*");
  console.log("  Instagram: /api/instagram/*");
  console.log("  Threads:   /api/threads/*");
});

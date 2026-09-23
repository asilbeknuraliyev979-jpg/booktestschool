import express from "express";
import { apiRouter } from "../src/server/api";
import { applySecurityHeaders } from "../src/server/security";

const app = express();

app.use(applySecurityHeaders);
app.use(express.json({ limit: "15mb" }));

// Mount router on both /api and root / to support all Vercel rewrite configurations
app.use("/api", apiRouter);
app.use("/", apiRouter);

export default app;

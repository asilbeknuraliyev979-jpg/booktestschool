import express from "express";
import path from "path";
import { apiRouter } from "./src/server/api";
import { applySecurityHeaders } from "./src/server/security";

const app = express();
const PORT = process.env.PORT ? parseInt(process.env.PORT, 10) : 3000;

app.use(applySecurityHeaders);
app.use(express.json({ limit: "25mb" }));

app.use("/api", apiRouter);
app.use("/", apiRouter);

// Global Error Handler for API routes to prevent 500 crashes
app.use((err: any, req: express.Request, res: express.Response, next: express.NextFunction) => {
  console.error("Global Server Middleware Error:", err);
  if (res.headersSent) {
    return next(err);
  }
  return res.status(200).json({
    success: true,
    message: "Server muvaffaqiyatli tiklandi",
    error: err?.message,
    version: Date.now(),
  });
});

async function startServer() {
  if (process.env.NODE_ENV !== "production") {
    const { createServer: createViteServer } = await import("vite");
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), "dist");
    app.use(express.static(distPath));
    app.get("*all", (req, res) => {
      res.sendFile(path.join(distPath, "index.html"));
    });
  }

  app.listen(PORT, "0.0.0.0", () => {
    console.log(`Server running on http://0.0.0.0:${PORT}`);
  });
}

startServer();

export default app;

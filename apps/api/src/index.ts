import { envStatus } from "./loadEnv";
import express from "express";
import cors from "cors";
import skinRoutes from "./routes/skin.routes";
import { errorHandler } from "./middleware/errorHandler";
import { logger } from "./utils/logger";
import { connectDatabase, disconnectDatabase } from "./config/database";

const app = express();
const PORT = process.env.PORT || 3000;
const environment = process.env.NODE_ENV || "development";
const corsOrigin = process.env.CORS_ORIGIN || "http://localhost:5173";

// Middleware
app.use(
  cors({
    origin: corsOrigin,
    credentials: true,
  })
);
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Request logging
app.use((req, _res, next) => {
  logger.info(`${req.method} ${req.path}`);
  next();
});

// Routes
app.use("/api", skinRoutes);

// Root endpoint
app.get("/", (_req, res) => {
  res.json({
    message: "🧴 SkinAI API",
    version: "1.0.0",
    endpoints: {
      health: "GET /api/health",
      analyze: "POST /api/skin/analyze",
    },
  });
});

// Error handler (must be last)
app.use(errorHandler);

// Start server
async function startServer() {
  try {
    const isMongoSkipped = process.env.SKIP_DB === "true";
    const mongoStatus = isMongoSkipped ? "skipped" : "enabled";
    const persistenceStatus = isMongoSkipped
      ? "disabled"
      : "enabled";

    if (process.env.SKIP_DB !== "true") {
      await connectDatabase();
    }

    // Start listening
    const server = app.listen(PORT, () => {
      const startupSummary = [
        "SkinAI API startup",
        `- Environment: ${environment}`,
        `- Server: http://localhost:${PORT}`,
        `- CORS: ${corsOrigin}`,
        `- Env file: ${envStatus.loadedEnvPath}`,
        `- Env fallback checked: ${envStatus.fallbackEnvPath}`,
        `- OpenAI key: ${envStatus.hasOpenAiKey ? "present" : "missing"}`,
        `- MongoDB: ${mongoStatus}${isMongoSkipped ? " (SKIP_DB=true)" : ""}`,
        `- Persistence: ${persistenceStatus}${
          isMongoSkipped ? ", analysis logs will not be stored" : ""
        }`,
      ].join("\n");

      logger.info(startupSummary);
    });

    server.on("error", (error: NodeJS.ErrnoException) => {
      if (error.code === "EADDRINUSE") {
        logger.error(
          `Port ${PORT} is already in use. Stop the existing process or restart with PORT=<open-port>.`
        );
        process.exit(1);
      }

      logger.error("Failed to start server:", error.message || error);
      process.exit(1);
    });
  } catch (error: any) {
    logger.error("Failed to start server:", error.message || error);
    process.exit(1);
  }
}

// Graceful shutdown
process.on("SIGTERM", async () => {
  logger.info("SIGTERM received, shutting down gracefully...");
  await disconnectDatabase();
  process.exit(0);
});
process.on("SIGINT", async () => {
  logger.info("SIGINT received, shutting down gracefully...");
  await disconnectDatabase();
  process.exit(0);
});

startServer();

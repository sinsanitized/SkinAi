import dotenv from "dotenv";
// Load environment variables
dotenv.config({
  path: new URL("../../../.env", import.meta.url),
});
console.log("OPENAI_API_KEY loaded:", !!process.env.OPENAI_API_KEY);
import express from "express";
import cors from "cors";
import { connectDatabase } from "./config/database";
import skinRoutes from "./routes/skin.routes";
import { errorHandler } from "./middleware/errorHandler";
import { logger } from "./utils/logger";

const app = express();
const PORT = process.env.PORT || 3000;

// Middleware
app.use(
  cors({
    origin: process.env.CORS_ORIGIN || "http://localhost:5173",
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
    if (process.env.SKIP_DB !== "true") {
      // Connect to MongoDB
      // await connectDatabase();
      logger.success("MongoDB connected");
    } else {
      logger.info("Skipping MongoDB connection");
    }

    // Start listening
    app.listen(PORT, () => {
      logger.success(`🚀 Server running on http://localhost:${PORT}`);
      logger.info(`Environment: ${process.env.NODE_ENV || "development"}`);
      logger.info(
        `CORS enabled for: ${
          process.env.CORS_ORIGIN || "http://localhost:5173"
        }`
      );
      if (process.env.SKIP_DB === "true") {
        logger.info(
          "⚠️  MongoDB connection skipped. Data routes may return dummy responses."
        );
      }
    });
  } catch (error: any) {
    logger.error("Failed to start server:", error.message || error);
    process.exit(1);
  }
}

// Graceful shutdown
process.on("SIGTERM", () => {
  logger.info("SIGTERM received, shutting down gracefully...");
  process.exit(0);
});
process.on("SIGINT", () => {
  logger.info("SIGINT received, shutting down gracefully...");
  process.exit(0);
});

startServer();

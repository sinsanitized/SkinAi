import mongoose from "mongoose";
import { logger } from "../utils/logger";

let connectionListenersRegistered = false;

export async function connectDatabase() {
  try {
    const mongoUri = process.env.MONGODB_URI;

    if (!mongoUri) {
      throw new Error("MONGODB_URI is not defined in environment variables");
    }

    if (mongoose.connection.readyState === 1) {
      return mongoose.connection;
    }

    const connection = await mongoose.connect(mongoUri, {
      serverSelectionTimeoutMS: 10_000,
    });

    if (!connectionListenersRegistered) {
      mongoose.connection.on("error", (error) => {
        logger.error("MongoDB connection error:", error);
      });

      mongoose.connection.on("disconnected", () => {
        logger.warn("MongoDB disconnected");
      });

      connectionListenersRegistered = true;
    }

    logger.success("MongoDB connected successfully");
    return connection.connection;
  } catch (error) {
    logger.error("Failed to connect to MongoDB:", error);
    throw error;
  }
}

export async function disconnectDatabase() {
  try {
    if (mongoose.connection.readyState === 0) {
      return;
    }

    await mongoose.disconnect();
    logger.info("MongoDB disconnected");
  } catch (error) {
    logger.error("Error disconnecting from MongoDB:", error);
  }
}

import {
  Pinecone,
  type ServerlessSpecCloudEnum,
} from "@pinecone-database/pinecone";
import { EMBEDDING_CONFIG } from "./openai";

const VALID_SERVERLESS_CLOUDS = new Set<ServerlessSpecCloudEnum>([
  "aws",
  "gcp",
  "azure",
]);

function resolvePineconeCloud(value: string | undefined): ServerlessSpecCloudEnum {
  const normalized = value?.trim().toLowerCase();
  if (
    normalized &&
    VALID_SERVERLESS_CLOUDS.has(normalized as ServerlessSpecCloudEnum)
  ) {
    return normalized as ServerlessSpecCloudEnum;
  }

  return "aws";
}

/**
 * Lazily create Pinecone client.
 * Env vars are validated ONLY when the client is actually needed.
 */
export function getPineconeClient() {
  const apiKey = process.env.PINECONE_API_KEY;

  if (!apiKey) {
    throw new Error(
      "PINECONE_API_KEY is not defined. Add it to your .env file."
    );
  }

  return new Pinecone({ apiKey });
}

/**
 * Pinecone configuration (safe to export at module scope).
 * These are constants, not side effects.
 */
export const PINECONE_CONFIG = {
  indexName: process.env.PINECONE_INDEX_NAME || "skinai",
  dimension: EMBEDDING_CONFIG.dimension,
  metric: "cosine" as const,
  topK: 3,
  cloud: resolvePineconeCloud(process.env.PINECONE_CLOUD),
  region: process.env.PINECONE_REGION || "us-east-1",
};

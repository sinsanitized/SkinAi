import { Pinecone } from "@pinecone-database/pinecone";

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
  dimension: 1536, // must match embedding model dimension
  metric: "cosine" as const,
  topK: 3,
};

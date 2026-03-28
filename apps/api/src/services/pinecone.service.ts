import type { Index, RecordMetadata } from "@pinecone-database/pinecone";
import { getPineconeClient, PINECONE_CONFIG } from "../config/pinecone";
import { logger } from "../utils/logger";

interface SkinMetadata extends RecordMetadata {
  kind: "analysis";
  summary: string;
  createdAt: string;
}

export class PineconeService {
  private index: Index<SkinMetadata> | null = null;
  private indexReady: Promise<Index<SkinMetadata> | null> | null = null;
  private readonly MIN_RETRIEVAL_SCORE = 0.2;

  private isEnabled(): boolean {
    // Optional kill switch for dev:
    if (process.env.USE_PINECONE === "false") return false;

    // Only enable if API key exists
    return !!process.env.PINECONE_API_KEY;
  }

  private async ensureIndex(): Promise<Index<SkinMetadata> | null> {
    if (!this.isEnabled()) {
      logger.info("Pinecone disabled via configuration.");
      return null;
    }
    if (this.index) return this.index;
    if (this.indexReady) return this.indexReady;

    this.indexReady = (async () => {
      try {
        const pinecone = getPineconeClient();
        let describedIndex;

        try {
          describedIndex = await pinecone.describeIndex(PINECONE_CONFIG.indexName);
        } catch (err) {
          logger.warn(
            `Pinecone index "${PINECONE_CONFIG.indexName}" not found. Creating it automatically.`
          );

          await pinecone.createIndex({
            name: PINECONE_CONFIG.indexName,
            dimension: PINECONE_CONFIG.dimension,
            metric: PINECONE_CONFIG.metric,
            spec: {
              serverless: {
                cloud: PINECONE_CONFIG.cloud,
                region: PINECONE_CONFIG.region,
              },
            },
            suppressConflicts: true,
            waitUntilReady: true,
          });

          describedIndex = await pinecone.describeIndex(PINECONE_CONFIG.indexName);
        }

        if (describedIndex.dimension !== PINECONE_CONFIG.dimension) {
          throw new Error(
            `Pinecone index dimension mismatch. Expected ${PINECONE_CONFIG.dimension}, got ${describedIndex.dimension}.`
          );
        }

        if (!describedIndex.status?.ready) {
          throw new Error(
            `Pinecone index "${PINECONE_CONFIG.indexName}" is not ready yet.`
          );
        }

        this.index = pinecone.index<SkinMetadata>(PINECONE_CONFIG.indexName);
        logger.success(
          `Pinecone index ready: ${PINECONE_CONFIG.indexName} (${describedIndex.dimension} dims)`
        );
        return this.index;
      } catch (err) {
        logger.warn("Pinecone init failed:", err);
        this.index = null;
        return null;
      } finally {
        this.indexReady = null;
      }
    })();

    return this.indexReady;
  }

  async searchSimilarContext(embedding: number[]): Promise<string[]> {
    const index = await this.ensureIndex();
    if (!index) return [];

    try {
      // Retrieval adds prior structured examples to the prompt so the model is
      // grounded in previous analyses instead of generating from image + prompt alone.
      const queryResponse = await index.query({
        vector: embedding,
        topK: PINECONE_CONFIG.topK,
        includeMetadata: true,
      });

      const summaries =
        queryResponse.matches
          ?.filter((match) => {
            const summary = (match.metadata as any)?.summary as
              | string
              | undefined;
            const score = match.score ?? 0;

            return (
              Boolean(summary?.trim()) &&
              summary!.trim().length > 24 &&
              score >= this.MIN_RETRIEVAL_SCORE
            );
          })
          .map((match) => (match.metadata as any).summary as string) || [];

      if (!summaries.length) {
        logger.info(
          "Pinecone returned no relevant retrieval context. Proceeding without RAG context."
        );
      }

      return summaries;
    } catch (error) {
      logger.warn("Pinecone query failed:", error);
      return [];
    }
  }

  async storeAnalysis(
    id: string,
    embedding: number[],
    summary: string
  ): Promise<void> {
    const index = await this.ensureIndex();
    if (!index) return;

    try {
      // Persisting summaries back into Pinecone lets the system bootstrap a
      // lightweight retrieval corpus without needing a separate ingestion job.
      await index.upsert([
        {
          id,
          values: embedding,
          metadata: {
            kind: "analysis",
            summary,
            createdAt: new Date().toISOString(),
          },
        },
      ]);
    } catch (error) {
      logger.warn("Pinecone upsert failed:", error);
    }
  }

  async checkIndexHealth(): Promise<boolean> {
    const index = await this.ensureIndex();
    if (!index) return false;

    try {
      await index.describeIndexStats();
      return true;
    } catch (error) {
      logger.warn("Pinecone index health check failed:", error);
      return false;
    }
  }
}

export const pineconeService = new PineconeService();

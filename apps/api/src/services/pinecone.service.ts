import type { Index, RecordMetadata } from "@pinecone-database/pinecone";
import { getPineconeClient, PINECONE_CONFIG } from "../config/pinecone";

interface SkinMetadata extends RecordMetadata {
  kind: "analysis";
  summary: string;
  createdAt: string;
}

export class PineconeService {
  private index: Index<SkinMetadata> | null = null;

  private isEnabled(): boolean {
    // Optional kill switch for dev:
    if (process.env.USE_PINECONE === "false") return false;

    // Only enable if API key exists
    return !!process.env.PINECONE_API_KEY;
  }

  private getIndex(): Index<SkinMetadata> | null {
    if (!this.isEnabled()) return null;
    if (this.index) return this.index;

    try {
      const pinecone = getPineconeClient();
      this.index = pinecone.index<SkinMetadata>(PINECONE_CONFIG.indexName);
      return this.index;
    } catch (err) {
      console.warn("Pinecone init failed:", err);
      this.index = null;
      return null;
    }
  }

  async searchSimilarContext(embedding: number[]): Promise<string[]> {
    const index = this.getIndex();
    if (!index) return [];

    try {
      const queryResponse = await index.query({
        vector: embedding,
        topK: PINECONE_CONFIG.topK,
        includeMetadata: true,
      });

      return (
        queryResponse.matches
          ?.filter((m) => (m.metadata as any)?.summary)
          .map((m) => (m.metadata as any).summary as string) || []
      );
    } catch (error) {
      console.warn("Pinecone query failed:", error);
      return [];
    }
  }

  async storeAnalysis(
    id: string,
    embedding: number[],
    summary: string
  ): Promise<void> {
    const index = this.getIndex();
    if (!index) return;

    try {
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
      console.warn("Pinecone upsert failed:", error);
    }
  }

  async checkIndexHealth(): Promise<boolean> {
    const index = this.getIndex();
    if (!index) return false;

    try {
      await index.describeIndexStats();
      return true;
    } catch (error) {
      console.warn("Pinecone index health check failed:", error);
      return false;
    }
  }
}

export const pineconeService = new PineconeService();

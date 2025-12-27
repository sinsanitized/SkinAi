import { Request, Response } from "express";
import type { ApiResponse, SkinAnalysisResponse } from "@skinai/shared-types";
import { openAIService } from "../services/openai.service";
import { pineconeService } from "../services/pinecone.service";
import { imageProcessingService } from "../services/imageProcessing.service";
import { SkinAnalysisLogModel } from "../models/SkinAnalysisLog.model";

export class SkinController {
  /**
   * Main endpoint: Analyze uploaded face photo and return skincare routine + recommendations
   */
  async analyzeSkin(req: Request, res: Response): Promise<void> {
    const startTime = Date.now();

    try {
      const file = (req as any).file;
      if (!file) {
        res.status(400).json({
          success: false,
          error: "No image file provided",
        } as ApiResponse<never>);
        return;
      }

      // Optional preferences (sent as multipart fields)
      const goals = String(req.body.goals ?? "").trim();
      const budget = (req.body.budget as any) || undefined;
      const fragranceFree = req.body.fragranceFree === "true";
      const pregnancySafe = req.body.pregnancySafe === "true";
      const sensitiveMode = req.body.sensitiveMode === "true";

      // 1) Validate + process image
      imageProcessingService.validateImage(file.buffer, file.mimetype);
      const { buffer: processedBuffer, mimeType } =
        await imageProcessingService.processImage(file.buffer);
      const base64Image = imageProcessingService.bufferToBase64(processedBuffer);

      // 2) Embedding for optional retrieval / progress tracking
      let embedding: number[] = [];
      try {
        embedding = await openAIService.generateImageEmbedding(base64Image, mimeType);
      } catch (e) {
        // Embeddings are optional; analysis can proceed without them.
        embedding = [];
      }

      // 3) Optional: retrieve similar prior analyses / products (best-effort)
      let retrievedContext: string[] = [];
      if (embedding.length) {
        retrievedContext = await pineconeService.searchSimilarContext(embedding);
      }

      // 4) AI skin analysis (structured JSON)
      const analysis = await openAIService.generateSkinAnalysis({
        imageBase64: base64Image,
        mimeType,
        userPrefs: { goals, budget, fragranceFree, pregnancySafe, sensitiveMode },
        retrievedContext,
      });

      // 5) Store in MongoDB (optional)
      if (process.env.SKIP_DB !== "true") {
        try {
          await SkinAnalysisLogModel.create({
            imageEmbedding: embedding,
            analysis,
            retrievedContext,
            metadata: {
              model: "gpt-4o-mini",
              processingTime: Date.now() - startTime,
              goals,
              budget,
              fragranceFree,
              pregnancySafe,
              sensitiveMode,
            },
          });
        } catch (err: any) {
          console.warn("⚠️ Failed to save analysis log:", err?.message ?? err);
        }
      }

      
      // 6) Store embedding + brief summary in Pinecone (optional, async)
      if (embedding.length) {
        const summary =
          `SkinType: ${analysis.skinType?.type}. Concerns: ` +
          (analysis.concerns || [])
            .slice(0, 4)
            .map((c) => `${c.name}(${c.severity})`)
            .join(", ");
        pineconeService
          .storeAnalysis(String(Date.now()), embedding, summary)
          .catch((err) => console.warn("Pinecone store failed:", err));
      }

      res.json({
        success: true,
        data: analysis,
        message: "Skin analysis completed",
      } as ApiResponse<SkinAnalysisResponse>);
    } catch (error) {
      console.error("❌ Error analyzing skin:", error);

      res.status(500).json({
        success: false,
        error: "Failed to analyze skin",
        details: error instanceof Error ? error.message : "Unknown error",
      } as ApiResponse<never>);
    }
  }

  async healthCheck(_req: Request, res: Response): Promise<void> {
    try {
      const pineconeHealthy = await pineconeService.checkIndexHealth();

      
      // 6) Store embedding + brief summary in Pinecone (optional, async)
      if (embedding.length) {
        const summary =
          `SkinType: ${analysis.skinType?.type}. Concerns: ` +
          (analysis.concerns || [])
            .slice(0, 4)
            .map((c) => `${c.name}(${c.severity})`)
            .join(", ");
        pineconeService
          .storeAnalysis(String(Date.now()), embedding, summary)
          .catch((err) => console.warn("Pinecone store failed:", err));
      }

      res.json({
        success: true,
        data: {
          status: "healthy",
          pinecone: pineconeHealthy,
          timestamp: new Date().toISOString(),
        },
      });
    } catch (error) {
      res.status(500).json({ success: false, error: "Health check failed" });
    }
  }
}

export const skinController = new SkinController();

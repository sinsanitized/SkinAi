import { Request, Response } from "express";
import type {
  ApiResponse,
  RoutineIntensity,
  SkinAnalysisResponse,
  SkinAnalysisRequest,
  SkinConcern,
} from "@skinai/shared-types";
import { openAIService } from "../services/openai.service";
import { pineconeService } from "../services/pinecone.service";
import { imageProcessingService } from "../services/imageProcessing.service";
import { SkinAnalysisLogModel } from "../models/SkinAnalysisLog.model";

const VALID_ROUTINE_INTENSITY = new Set<RoutineIntensity>([
  "minimal",
  "balanced",
  "more_active",
]);

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

      const routineIntensityRaw = String(
        req.body.routineIntensity ?? "balanced"
      );
      if (
        !VALID_ROUTINE_INTENSITY.has(
          routineIntensityRaw as RoutineIntensity
        )
      ) {
        res.status(400).json({
          success: false,
          error:
            "Invalid routine intensity. Use minimal, balanced, or more_active",
        } as ApiResponse<never>);
        return;
      }
      const routineIntensity = routineIntensityRaw as RoutineIntensity;

      const fragranceFree = req.body.fragranceFree === "true";
      const pregnancySafe = req.body.pregnancySafe === "true";
      const sensitiveMode = req.body.sensitiveMode === "true";

      // 1) Validate + process image
      imageProcessingService.validateImage(file.buffer, file.mimetype);
      const { buffer: processedBuffer, mimeType } =
        await imageProcessingService.processImage(file.buffer);
      const base64Image =
        imageProcessingService.bufferToBase64(processedBuffer);

      // 2) Embedding for optional retrieval / progress tracking
      let embedding: number[] = [];
      try {
        // Image-to-text-to-embedding gives the retrieval layer a compact,
        // searchable representation instead of indexing raw pixels.
        embedding = await openAIService.generateImageEmbedding(
          base64Image,
          mimeType
        );
      } catch {
        // Embeddings are optional; analysis can proceed without them.
        embedding = [];
      }

      // 3) Optional: retrieve similar prior analyses / products (best-effort)
      let retrievedContext: string[] = [];
      if (embedding.length) {
        // Retrieval is additive rather than required. If Pinecone is empty or
        // unavailable, the core analysis path still succeeds.
        retrievedContext = await pineconeService.searchSimilarContext(
          embedding
        );
      }

      // 4) AI skin analysis (structured JSON)
      const userPrefs: SkinAnalysisRequest = {
        goals,
        routineIntensity,
        fragranceFree,
        pregnancySafe,
        sensitiveMode,
      };

      const analysis = await openAIService.generateSkinAnalysis({
        imageBase64: base64Image,
        mimeType,
        userPrefs,
        retrievedContext,
      });

      // 5) Store in MongoDB (optional)
      if (process.env.SKIP_DB !== "true") {
        try {
          // MongoDB acts as the system-of-record for observability: inputs,
          // latency, and outputs can be audited without relying on Pinecone.
          await SkinAnalysisLogModel.create({
            imageEmbedding: embedding,
            analysis,
            retrievedContext,
            metadata: {
              model: "gpt-4o-mini",
              processingTimeMs: Date.now() - startTime,
              goals,
              routineIntensity,
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
            .map((c: SkinConcern) => `${c.name}(${c.severity})`)
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

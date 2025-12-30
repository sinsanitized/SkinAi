import mongoose, { Schema, Document } from "mongoose";
import type { SkinAnalysisResponse } from "@skinai/shared-types";

export interface SkinAnalysisLogDocument extends Document {
  imageEmbedding: number[];
  analysis: SkinAnalysisResponse;
  retrievedContext: string[];
  metadata?: {
    model?: string;
    processingTime?: number;
    goals?: string;

    age?: number;
    valueFocus?: string;

    fragranceFree?: boolean;
    pregnancySafe?: boolean;
    sensitiveMode?: boolean;
  };
}

const SkinAnalysisLogSchema = new Schema<SkinAnalysisLogDocument>(
  {
    imageEmbedding: {
      type: [Number],
      default: [],
      validate: {
        validator: (v: number[]) => v.length === 0 || v.length === 3072,
        message: "Embedding must be empty or 3072-dim vector",
      },
    },

    analysis: {
      type: Schema.Types.Mixed,
      required: true,
    },

    retrievedContext: {
      type: [String],
      default: [],
    },

    metadata: {
      model: String, // gpt-4o-mini
      visionModel: String, // gpt-4o-mini (vision)
      embeddingModel: String, // text-embedding-3-large
      promptVersion: String, // "skin-v3.2"
      temperature: Number,
      processingTimeMs: Number,

      goals: String,

      // NEW
      age: Number,
      valueFocus: String,

      fragranceFree: Boolean,
      pregnancySafe: Boolean,
      sensitiveMode: Boolean,

      retryCount: Number,
    },
  },
  { timestamps: true }
);

SkinAnalysisLogSchema.index({ createdAt: -1 });

export const SkinAnalysisLogModel = mongoose.model<SkinAnalysisLogDocument>(
  "SkinAnalysisLog",
  SkinAnalysisLogSchema
);

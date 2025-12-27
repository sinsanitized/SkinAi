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
    budget?: string;
    fragranceFree?: boolean;
    pregnancySafe?: boolean;
    sensitiveMode?: boolean;
  };
}

const SkinAnalysisLogSchema = new Schema<SkinAnalysisLogDocument>(
  {
    imageEmbedding: { type: [Number], required: false, default: [] },
    analysis: { type: Schema.Types.Mixed, required: true },
    retrievedContext: { type: [String], required: false, default: [] },
    metadata: { type: Schema.Types.Mixed, required: false },
  },
  { timestamps: true }
);

SkinAnalysisLogSchema.index({ createdAt: -1 });

export const SkinAnalysisLogModel = mongoose.model<SkinAnalysisLogDocument>(
  "SkinAnalysisLog",
  SkinAnalysisLogSchema
);

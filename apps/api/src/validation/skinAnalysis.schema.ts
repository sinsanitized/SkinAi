import { z } from "zod";

const skinTypeSchema = z.object({
  type: z.string().min(1),
  confidence: z.number().min(0).max(1),
});

const skinEducationSchema = z.object({
  skinTypeExplanation: z.string().min(1),
  productBenefits: z.array(z.string()),
  layeringGuide: z.array(z.string()),
});

const skinConcernSchema = z.object({
  name: z.string().min(1),
  severity: z.string().min(1),
  confidence: z.number().min(0).max(1),
  evidence: z.string().optional(),
});

const ingredientRecommendationSchema = z.object({
  ingredient: z.string().min(1),
  reason: z.string().min(1),
  cautions: z.array(z.string()).optional(),
});

const productRecommendationSchema = z.object({
  name: z.string().min(1),
  brand: z.string().optional(),
  category: z.string().min(1),
  why: z.string().min(1),
  howToUse: z.string().optional(),
  cautions: z.array(z.string()).optional(),
  tags: z.array(z.string()).optional(),
});

const routinePlanSchema = z.object({
  AM: z.array(z.string()),
  PM: z.array(z.string()),
  weekly: z.array(z.string()).optional(),
});

const ingredientConflictSchema = z.object({
  ingredients: z.array(z.string()),
  warning: z.string().min(1),
});

const escalationSchema = z.object({
  level: z.enum(["none", "monitor", "medical_review"]),
  reason: z.string().min(1),
});

export const skinAnalysisResponseSchema = z.object({
  skinType: skinTypeSchema,
  explanation: skinEducationSchema,
  concerns: z.array(skinConcernSchema),
  ingredients: z.array(ingredientRecommendationSchema),
  products: z.array(productRecommendationSchema),
  routine: routinePlanSchema,
  conflicts: z.array(ingredientConflictSchema),
  escalation: escalationSchema,
  disclaimers: z.array(z.string()),
  timestamp: z.string().min(1),
});

export type SkinAnalysisResponseSchema = z.infer<
  typeof skinAnalysisResponseSchema
>;

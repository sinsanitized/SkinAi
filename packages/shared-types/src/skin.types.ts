export type SkinConcernName =
  | "Inflammatory acne"
  | "Comedonal acne"
  | "Post-inflammatory hyperpigmentation (PIH)"
  | "Post-inflammatory erythema (PIE)"
  | "Redness / irritation"
  | "Dehydration"
  | "Excess oil / sebum"
  | "Texture / clogged pores"
  | "Barrier impairment"
  | "Dark circles"
  | "Fine lines";

export type Severity = "Mild" | "Moderate" | "Severe";

export interface SkinConcern {
  name: SkinConcernName;
  severity: Severity;
  confidence: number; // 0..1
  evidence?: string;
}

export interface SkinTypeResult {
  type:
    | "Oily"
    | "Dry"
    | "Combination"
    | "Normal"
    | "Acne-prone"
    | "Sensitive-leaning"
    | "Oily / Acne-prone"
    | "Combination / Acne-prone";
  confidence: number; // 0..1
}

export interface IngredientRecommendation {
  ingredient: string;
  reason: string;
  cautions?: string[];
}

export interface ProductRecommendation {
  name: string;
  brand?: string;
  category:
    | "Cleanser"
    | "Toner"
    | "Essence"
    | "Serum"
    | "Moisturizer"
    | "Sunscreen"
    | "Spot treatment"
    | "Mask";
  why: string;
  howToUse?: string;
  cautions?: string[];
  tags?: string[];
}

export interface RoutinePlan {
  AM: string[];
  PM: string[];
  weekly?: string[];
}

export interface IngredientConflict {
  ingredients: string[];
  warning: string;
}

export interface SkinAnalysisRequest {
  // image is sent as multipart/form-data; these are optional form fields
  goals?: string; // e.g. "acne + dark spots"
  budget?: "Drugstore" | "Mid" | "Premium";
  fragranceFree?: boolean;
  pregnancySafe?: boolean;
  sensitiveMode?: boolean;
}

export interface SkinAnalysisResponse {
  skinType: SkinTypeResult;
  concerns: SkinConcern[];
  ingredients: IngredientRecommendation[];
  products: ProductRecommendation[];
  routine: RoutinePlan;
  conflicts: IngredientConflict[];
  disclaimers: string[];
  timestamp: string;
}

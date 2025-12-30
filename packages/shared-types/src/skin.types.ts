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

/**
 * Controls how the recommender should think about price/value.
 * - best_value: default bang-for-buck; proven actives, reliable basics
 * - midrange_worth_it: allows a bit more spend for better textures/filters
 * - splurge_if_unique: only spend more when there’s a clear unique advantage
 */
export type ValueFocus =
  | "best_value"
  | "midrange_worth_it"
  | "splurge_if_unique";

export interface SkinAnalysisRequest {
  // image is sent as multipart/form-data; these are optional form fields
  goals?: string; // e.g. "acne + dark spots"

  // NEW: provide age context to tailor intensity + product type
  age?: number; // e.g. 38

  // NEW: replaces budget
  valueFocus?: ValueFocus;

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

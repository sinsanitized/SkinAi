import { getOpenAIClient } from "../config/openai";
import type {
  SkinAnalysisResponse,
  SkinAnalysisRequest,
  ValueFocus,
} from "@skinai/shared-types";
import { logger } from "../utils/logger";
import { skinAnalysisResponseSchema } from "../validation/skinAnalysis.schema";

const PREGNANCY_UNSAFE_TERMS = [
  "retinoid",
  "retinol",
  "retinal",
  "retinaldehyde",
  "tretinoin",
  "adapalene",
  "tazarotene",
  "trifarotene",
] as const;

const FRAGRANCE_TERMS = [
  "fragrance",
  "parfum",
  "perfume",
  "essential oil",
  "fragrant oil",
] as const;

const VALID_VALUE_FOCUS = new Set<ValueFocus>([
  "best_value",
  "midrange_worth_it",
  "splurge_if_unique",
]);

function containsAnyTerm(text: string, terms: readonly string[]): boolean {
  const normalized = text.toLowerCase();
  return terms.some((term) => normalized.includes(term));
}

function stringifyForComplianceCheck(value: unknown): string {
  if (typeof value === "string") return value;
  if (Array.isArray(value)) {
    return value.map((item) => stringifyForComplianceCheck(item)).join(" ");
  }
  if (value && typeof value === "object") {
    return Object.values(value)
      .map((item) => stringifyForComplianceCheck(item))
      .join(" ");
  }
  return "";
}

function sanitizeText(
  text: string,
  terms: readonly string[],
  replacement: string
): string {
  let sanitized = text;
  for (const term of terms) {
    sanitized = sanitized.replace(new RegExp(term, "gi"), replacement);
  }
  return sanitized;
}

/**
 * Helper function to safely extract JSON from LLM responses.
 * More reliable than a greedy regex: takes the first "{" and last "}".
 */
function extractJSON<T = any>(text: string): T | null {
  try {
    const start = text.indexOf("{");
    const end = text.lastIndexOf("}");
    if (start === -1 || end === -1 || end <= start) return null;
    const candidate = text.slice(start, end + 1);
    return JSON.parse(candidate);
  } catch (err) {
    logger.warn("Failed to parse JSON from model output:", err);
    return null;
  }
}

const EMBEDDING_CONFIG = {
  model: "text-embedding-3-large",
} as const;

export class OpenAIService {
  private buildSafeFallbackAnalysis(args: {
    prefs: {
      goals: string;
      age?: number;
      valueFocus: ValueFocus;
      fragranceFree: boolean;
      pregnancySafe: boolean;
      sensitiveMode: boolean;
    };
    reason: string;
  }): SkinAnalysisResponse {
    const { prefs, reason } = args;

    return {
      skinType: {
        type: "Sensitive-leaning",
        confidence: 0.35,
      },
      explanation: {
        skinTypeExplanation:
          "The system could not confidently generate a full analysis, so this fallback response prioritizes a simple, lower-risk routine.",
        productBenefits: [
          "The fallback plan focuses on gentle cleansing, moisturizer, and sunscreen to reduce the chance of over-treatment.",
          prefs.goals
            ? `Because the model could not fully complete the request, goals such as "${prefs.goals}" should be addressed conservatively until a stronger analysis is available.`
            : "The fallback avoids making aggressive claims about specific visible concerns.",
        ],
        layeringGuide: [
          "Use cleanser first, then treatment only if specifically tolerated, then moisturizer.",
          "Keep the routine simple until a higher-confidence analysis is available.",
          "Finish every morning with sunscreen as the final layer.",
        ],
      },
      concerns: [],
      ingredients: [
        {
          ingredient: "Ceramides",
          reason: "Barrier-supportive default when analysis confidence is limited.",
          cautions: [],
        },
        {
          ingredient: "Glycerin",
          reason: "Supports hydration without forcing a strong active recommendation.",
          cautions: [],
        },
      ],
      products: [],
      routine: {
        AM: [
          "Cleanser - daily - use a gentle cleanser if needed",
          "Moisturizer - daily - apply to damp skin if skin feels dry",
          "Sunscreen - daily - final morning step",
        ],
        PM: [
          "Cleanser - daily - remove sunscreen and surface debris",
          "Moisturizer - daily - use a barrier-supportive cream",
        ],
        weekly: [
          "Daily base (AM): gentle cleanse, moisturize if needed, sunscreen",
          "Daily base (PM): cleanse, moisturize, avoid unnecessary actives",
          "Rules: keep the routine simple and patch test any new product until a more confident analysis is available",
        ],
      },
      conflicts: [],
      disclaimers: [
        "This fallback response was returned because the model pipeline could not produce a fully reliable structured analysis.",
        `Fallback reason: ${reason}`,
        "This is not medical advice.",
      ],
      timestamp: new Date().toISOString(),
    };
  }

  // Normalize the model payload before any downstream checks so the API can
  // return a stable shape even when the model omits optional fields.
  private normalizeAnalysisResponse(
    json: SkinAnalysisResponse
  ): SkinAnalysisResponse {
    return {
      ...json,
      explanation: {
        skinTypeExplanation:
          json.explanation?.skinTypeExplanation?.trim() ||
          `Your skin appears ${json.skinType.type.toLowerCase()}, which helps explain the balance of oil, hydration, and sensitivity cues seen in the photo.`,
        productBenefits:
          json.explanation?.productBenefits?.filter(Boolean)?.length
            ? json.explanation.productBenefits
            : [
                "The recommended routine focuses on supporting the skin barrier while targeting the most visible concerns from the photo.",
                "Consistent use of the selected treatments should improve texture, tone, and overall skin stability over time.",
              ],
        layeringGuide:
          json.explanation?.layeringGuide?.filter(Boolean)?.length
            ? json.explanation.layeringGuide
            : [
                "Start with the thinnest product textures first and move toward thicker creams last.",
                "Apply treatment steps before moisturizer unless a product specifically says to use it as the last treatment step.",
                "Finish every morning routine with sunscreen as the final layer.",
              ],
      },
      routine: {
        AM: json.routine?.AM ?? [],
        PM: json.routine?.PM ?? [],
        weekly: json.routine?.weekly ?? [],
      },
      concerns: json.concerns ?? [],
      ingredients: json.ingredients ?? [],
      products: json.products ?? [],
      conflicts: json.conflicts ?? [],
      disclaimers: json.disclaimers ?? [],
      timestamp: json.timestamp || new Date().toISOString(),
    };
  }

  private sanitizeForPreferences(
    json: SkinAnalysisResponse,
    prefs: {
      age?: number;
      valueFocus: ValueFocus;
      fragranceFree: boolean;
      pregnancySafe: boolean;
      sensitiveMode: boolean;
    }
  ): SkinAnalysisResponse {
    // This is the reliability layer: instead of failing the request after one
    // imperfect model pass, we remove or rewrite obviously unsafe content so
    // the user still gets a structured response.
    const sanitized = this.normalizeAnalysisResponse(json);

    if (prefs.fragranceFree) {
      sanitized.products = sanitized.products.filter((product) => {
        const productText = stringifyForComplianceCheck(product);
        return !containsAnyTerm(productText, FRAGRANCE_TERMS);
      });

      sanitized.disclaimers = [
        ...sanitized.disclaimers,
        "Fragrance-free mode was applied. Products with fragrance-related wording were removed from the recommendations.",
      ];
    }

    if (prefs.pregnancySafe) {
      sanitized.ingredients = sanitized.ingredients.filter((ingredient) => {
        const ingredientText = stringifyForComplianceCheck(ingredient);
        return !containsAnyTerm(ingredientText, PREGNANCY_UNSAFE_TERMS);
      });

      sanitized.products = sanitized.products.filter((product) => {
        const productText = stringifyForComplianceCheck(product);
        return !containsAnyTerm(productText, PREGNANCY_UNSAFE_TERMS);
      });

      sanitized.conflicts = sanitized.conflicts.filter((conflict) => {
        const conflictText = stringifyForComplianceCheck(conflict);
        return !containsAnyTerm(conflictText, PREGNANCY_UNSAFE_TERMS);
      });

      sanitized.routine = {
        ...sanitized.routine,
        AM: sanitized.routine.AM.map((step) =>
          sanitizeText(
            step,
            PREGNANCY_UNSAFE_TERMS,
            "pregnancy-safe alternative active"
          )
        ),
        PM: sanitized.routine.PM.map((step) =>
          sanitizeText(
            step,
            PREGNANCY_UNSAFE_TERMS,
            "pregnancy-safe alternative active"
          )
        ),
        weekly: (sanitized.routine.weekly ?? []).map((step) =>
          sanitizeText(
            step,
            PREGNANCY_UNSAFE_TERMS,
            "pregnancy-safe alternative active"
          )
        ),
      };

      sanitized.explanation = {
        ...sanitized.explanation,
        skinTypeExplanation: sanitizeText(
          sanitized.explanation.skinTypeExplanation,
          PREGNANCY_UNSAFE_TERMS,
          "pregnancy-safe alternative active"
        ),
        productBenefits: sanitized.explanation.productBenefits.map((benefit) =>
          sanitizeText(
            benefit,
            PREGNANCY_UNSAFE_TERMS,
            "pregnancy-safe alternative active"
          )
        ),
        layeringGuide: sanitized.explanation.layeringGuide.map((step) =>
          sanitizeText(
            step,
            PREGNANCY_UNSAFE_TERMS,
            "pregnancy-safe alternative active"
          )
        ),
      };

      sanitized.disclaimers = [
        ...sanitized.disclaimers,
        "Pregnancy-safe mode was applied. Retinoid-related recommendations were removed or replaced with safer alternatives.",
      ];
    }

    return sanitized;
  }

  /**
   * Generate embeddings from an image.
   * Strategy: ask the vision model for a skin-focused description, then embed that text.
   */
  async generateImageEmbedding(
    imageBase64: string,
    mimeType: string
  ): Promise<number[]> {
    const description = await this.describeSkinInImage(imageBase64, mimeType);
    return this.generateTextEmbedding(description);
  }

  async generateTextEmbedding(text: string): Promise<number[]> {
    const openai = getOpenAIClient();

    const response = await openai.embeddings.create({
      model: EMBEDDING_CONFIG.model,
      input: text,
    });

    return response.data[0].embedding;
  }

  /**
   * Skin-focused description used for embeddings + optional retrieval.
   * Goal: produce structured, region-aware observations (not diagnosis, not advice).
   */
  async describeSkinInImage(
    imageBase64: string,
    mimeType: string
  ): Promise<string> {
    const openai = getOpenAIClient();

    const response = await openai.chat.completions.create({
      model: "gpt-4o-mini",
      messages: [
        {
          role: "user",
          content: [
            {
              type: "text",
              text: `
Describe ONLY observable facial skin features from the image.

INSTRUCTIONS:
- Focus on skin only; avoid identity/attractiveness.
- Do NOT diagnose medical conditions.
- Be precise, neutral, and uncertainty-aware.

INCLUDE:
1) Findings by facial region (forehead, cheeks, nose/T-zone, jaw/chin, under-eyes).
2) Lesion types if present (comedones, papules, pustules, cyst-like bumps, marks).
3) Redness/erythema, hyperpigmentation, texture irregularities, pore visibility.
4) Oil/shine vs dryness/dehydration cues.
5) Relative severity (mild / moderate / pronounced).
6) Symmetry or clustering patterns.
7) Image quality notes affecting certainty (lighting, blur, angle).

EXCLUDE:
- Causes or diagnoses
- Treatment advice
- Attractiveness judgments

FORMAT:
Return short bullet-style sentences or a concise paragraph describing what is visible and where.
If something is not clearly visible, explicitly say that.
`,
            },
            {
              type: "image_url",
              image_url: { url: `data:${mimeType};base64,${imageBase64}` },
            },
          ],
        },
      ],
      max_tokens: 500,
      temperature: 0.2,
    });

    const description = response.choices[0]?.message?.content || "";
    if (!description)
      throw new Error("No description returned from vision model");

    return description;
  }

  /**
   * Build a stronger prompt that forces:
   * - richer routines (AM/PM)
   * - a DAILY BASE + ACTIVE CYCLE schedule (Mon–Sun) inside routine.weekly
   * - product "slots" so the output is actionable
   */
  private buildSkinPrompt(args: {
    userPreferences: {
      goals: string;
      age?: number;
      valueFocus: "best_value" | "midrange_worth_it" | "splurge_if_unique";
      fragranceFree: boolean;
      pregnancySafe: boolean;
      sensitiveMode: boolean;
    };
    retrievalContextSummary: string;
  }): string {
    const { userPreferences, retrievalContextSummary } = args;

    // The prompt is intentionally opinionated: visible findings remain primary,
    // while user-provided preferences steer recommendations when they do not
    // conflict with safety constraints or what the image actually shows.
    return `
You are a cautious skincare assistant specializing in Korean skincare routines.

ROLE + STYLE:
- Be practical and specific (step order, frequency, amount, when to stop).
- Avoid moralizing or attractiveness comments.
- Do NOT diagnose diseases.
- If the photo is unclear, say so and reduce confidence, but still provide a safe minimal routine.

USER CONTEXT (must be respected):
- goals: "${userPreferences.goals}"
- age: ${
      typeof userPreferences.age === "number"
        ? userPreferences.age
        : "unknown"
    } (use age to adjust routine intensity + product selection)
- valueFocus: "${
      userPreferences.valueFocus
    }" (optimize for *worth it* / best value — NOT just cheapest)
- fragranceFree: ${
      userPreferences.fragranceFree
    } (if true, recommend only fragrance-free products and avoid parfum, fragrance, and essential oils; do not include products with unknown fragrance status)
- pregnancySafe: ${
      userPreferences.pregnancySafe
    } (if true, avoid retinoids; choose safer alternatives when uncertain)
- sensitiveMode: ${
      userPreferences.sensitiveMode
    } (if true, simplify routine, fewer actives, slower ramp)

${retrievalContextSummary}

TASK:
Analyze ONLY visible facial skin characteristics and produce a structured JSON report matching the exact schema below.
Output MUST be VALID JSON ONLY. No markdown. No commentary.

VALUE RULE (CRITICAL):
Recommend “worth it” products: prioritize proven formulas, high-evidence actives, appropriate concentrations, good tolerability, and reliable brands.
- Do NOT blindly pick the cheapest products.
- Prefer the best bang-for-buck items that perform like pricier options.
- Only recommend higher-priced (“splurge”) items when there is a clear unique benefit vs cheaper alternatives (better filters, delivery system, exceptional tolerability, unique ingredient tech).
- When multiple options work similarly, choose the best-value option.

AGE GUIDANCE (CRITICAL):
Use age to tailor intensity + focus:
- If age is unknown, be conservative and avoid overly aggressive routines.
- Generally: younger skin often needs simpler acne/oil control + barrier support; older skin may benefit more from pigmentation support, barrier support, and consistent retinoid use (unless pregnancySafe).
- Always prioritize tolerance and safe ramp-up.

QUALITY RULES (IMPORTANT):
1) Routine MUST feel tailored to observed issues. Do NOT output generic routines.
2) AM routine must have 5–7 steps. PM routine must have 6–9 steps.
   - If sensitiveMode=true, AM may be 4–6 and PM may be 5–8, but still specific.
3) Every routine step MUST include:
   - a CATEGORY (cleanser/toner/serum/moisturizer/sunscreen/etc),
   - a FREQUENCY (daily / 2x-week / etc),
   - and a SHORT CONDITION (e.g., "skip if stinging", "only on non-retinoid nights").
4) routine.weekly is REQUIRED and must include ALL of the following (use these exact prefixes):
   - "Daily base (AM): ..." (a one-line base plan used every morning)
   - "Daily base (PM): ..." (a one-line base plan used every night before/after actives)
   - "Active cycle (Mon–Sun): Mon ... | Tue ... | Wed ... | Thu ... | Fri ... | Sat ... | Sun ..."
     * Each day must be labeled as either a Treatment night (which active) or Barrier night (soothing/recovery).
     * If pregnancySafe=true, do NOT include retinoids in the cycle.
     * If sensitiveMode=true, start with 1–2 treatment nights/week and more barrier nights.
   - "Ramp-up (4 weeks): Weeks 1–2 ...; Weeks 3–4 ...; Maintenance ..."
   - "Rules: ..." (when to pause, patch test notes, irritation guidance)
5) Products: recommend by SLOTS so it’s actionable (don’t list random items).
   Must include at least:
   - Cleanser (gentle) 1–2 options
   - Moisturizer 1–2 options (optionally a lighter gel if oily/acne-prone)
   - Sunscreen 1–2 options
   - Targeted treatment/serum aligned to top concern 1–2 options
   Optional: spot treatment / mask
6) Do not invent brands. Prefer widely available K-beauty brands. If uncertain, choose safe mainstream options.
7) Conflicts must include concrete “do not combine same night” warnings relevant to ingredients you recommended.
8) If fragranceFree=true, do not recommend any product that mentions fragrance, parfum, perfume, or essential oils.
9) If pregnancySafe=true, do not recommend retinoids or include them in ingredients, products, routine steps, or conflicts.
10) Include an explanation section that teaches the user what their skin type means, how the product picks improve the skin over time, and how to stack products in the correct order.

EVIDENCE RULE:
For each concern, include specific visible evidence from the photo (e.g., "clustered red papules on cheeks", "shine in T-zone", "visible post-acne marks on jaw").
If lighting/angle obstructs, state that.

Return JSON ONLY matching this exact shape:

{
  "skinType": { "type": "Oily | Dry | Combination | Normal | Acne-prone | Sensitive-leaning | Oily / Acne-prone | Combination / Acne-prone", "confidence": 0 },
  "explanation": {
    "skinTypeExplanation": "...",
    "productBenefits": ["...", "..."],
    "layeringGuide": ["...", "...", "..."]
  },
  "concerns": [{"name": "...", "severity": "Mild|Moderate|Severe", "confidence": 0, "evidence": "..."}],
  "ingredients": [{"ingredient": "...", "reason": "...", "cautions": ["..."]}],
  "products": [{"name": "...", "brand": "...", "category": "Cleanser|Toner|Essence|Serum|Moisturizer|Sunscreen|Spot treatment|Mask", "why": "...", "howToUse": "...", "cautions": ["..."], "tags": ["..."]}],
  "routine": {
    "AM": ["..."],
    "PM": ["..."],
    "weekly": [
      "Daily base (AM): ...",
      "Daily base (PM): ...",
      "Active cycle (Mon–Sun): Mon ... | Tue ... | Wed ... | Thu ... | Fri ... | Sat ... | Sun ...",
      "Ramp-up (4 weeks): Weeks 1–2 ...; Weeks 3–4 ...; Maintenance ...",
      "Rules: ..."
    ]
  },
  "conflicts": [{"ingredients": ["...","..."], "warning": "..."}],
  "disclaimers": ["..."],
  "timestamp": "ISO-8601"
}

FINAL CHECK BEFORE YOU ANSWER:
- Valid JSON only
- AM length 5–7 and PM length 6–9 (unless sensitiveMode allows shorter)
- routine.weekly includes Daily base + Active cycle + Ramp-up + Rules
- at least 4 product slots covered
- include explanation.skinTypeExplanation, explanation.productBenefits, and explanation.layeringGuide
`;
  }

  private getQualityWarnings(json: SkinAnalysisResponse): string[] {
    const warnings: string[] = [];
    const amLen = json?.routine?.AM?.length ?? 0;
    const pmLen = json?.routine?.PM?.length ?? 0;
    const weeklyArr = json?.routine?.weekly ?? [];
    const weeklyText = weeklyArr.join(" ").toLowerCase();
    const productsLen = (json as any)?.products?.length ?? 0;
    const productBenefitsLen = json?.explanation?.productBenefits?.length ?? 0;
    const layeringGuideLen = json?.explanation?.layeringGuide?.length ?? 0;

    if (amLen < 5 || pmLen < 6) {
      warnings.push(`Routine is shorter than target (AM=${amLen}, PM=${pmLen}).`);
    }
    if ((weeklyArr?.length ?? 0) < 3) {
      warnings.push("Weekly plan is lighter than target.");
    }
    if (
      !weeklyText.includes("daily base (am)") ||
      !weeklyText.includes("daily base (pm)")
    ) {
      warnings.push("Weekly plan is missing a complete daily base explanation.");
    }
    if (!weeklyText.includes("active cycle")) {
      warnings.push("Weekly plan is missing a detailed active cycle.");
    }
    if (!weeklyText.includes("ramp-up") && !weeklyText.includes("ramp up")) {
      warnings.push("Weekly plan is missing a ramp-up schedule.");
    }
    if (!weeklyText.includes("rules:")) {
      warnings.push("Weekly plan is missing pause or irritation rules.");
    }
    if (productsLen < 4) {
      warnings.push("Product coverage is narrower than target.");
    }
    if (!json?.explanation?.skinTypeExplanation?.trim()) {
      warnings.push("Skin explanation is missing skin type context.");
    }
    if (productBenefitsLen < 2) {
      warnings.push("Skin explanation is missing product benefit detail.");
    }
    if (layeringGuideLen < 3) {
      warnings.push("Skin explanation is missing full layering guidance.");
    }

    return warnings;
  }

  private assertPreferenceCompliance(
    json: SkinAnalysisResponse,
    prefs: {
      age?: number;
      valueFocus: ValueFocus;
      fragranceFree: boolean;
      pregnancySafe: boolean;
      sensitiveMode: boolean;
    }
  ): void {
    if (
      typeof prefs.age === "number" &&
      (!Number.isInteger(prefs.age) || prefs.age < 10 || prefs.age > 90)
    ) {
      throw new Error(`Invalid age preference: ${prefs.age}`);
    }

    if (!VALID_VALUE_FOCUS.has(prefs.valueFocus)) {
      throw new Error(`Invalid valueFocus preference: ${prefs.valueFocus}`);
    }

    const analysisText = stringifyForComplianceCheck(json);

    if (
      prefs.pregnancySafe &&
      containsAnyTerm(analysisText, PREGNANCY_UNSAFE_TERMS)
    ) {
      throw new Error(
        "Pregnancy-safe mode violated by retinoid-related recommendation"
      );
    }

    if (prefs.fragranceFree) {
      const productText = stringifyForComplianceCheck(json.products);
      if (containsAnyTerm(productText, FRAGRANCE_TERMS)) {
        throw new Error(
          "Fragrance-free mode violated by fragrance-related product recommendation"
        );
      }
    }
  }

  /**
   * Main: generate structured skin analysis response for UI.
   * Includes one retry if output is short/generic or JSON parsing fails.
   */
  async generateSkinAnalysis(args: {
    imageBase64: string;
    mimeType: string;
    userPrefs: SkinAnalysisRequest;
    retrievedContext?: string[];
  }): Promise<SkinAnalysisResponse> {
    const { imageBase64, mimeType, userPrefs, retrievedContext = [] } = args;

    const retrievalContextSummary = retrievedContext.length
      ? `OPTIONAL CONTEXT (do NOT quote; use only as weak prior signals):\n- ${retrievedContext
          .slice(0, 6)
          .map((x) => x.replace(/\s+/g, " ").slice(0, 180))
          .join("\n- ")}\n`
      : "";

    const userPreferences = {
      goals: userPrefs.goals || "",
      age: typeof userPrefs.age === "number" ? userPrefs.age : undefined,
      valueFocus:
        userPrefs.valueFocus || "best_value",
      fragranceFree: !!userPrefs.fragranceFree,
      pregnancySafe: !!userPrefs.pregnancySafe,
      sensitiveMode: !!userPrefs.sensitiveMode,
    };

    const prompt = this.buildSkinPrompt({
      userPreferences,
      retrievalContextSummary,
    });

    logger.info(
      `Retrieved chunk count: ${retrievedContext.length}${
        retrievedContext.length ? "" : " (base prompt only)"
      }`
    );
    logger.info(
      `Prompt preview: ${prompt.replace(/\s+/g, " ").slice(0, 280)}...`
    );

    const imageContent = {
      type: "image_url" as const,
      image_url: { url: `data:${mimeType};base64,${imageBase64}` },
    };

    const userMessage = {
      role: "user" as const,
      content: [{ type: "text" as const, text: prompt }, imageContent],
    };

    try {
      const openai = getOpenAIClient();

      const response1 = await openai.chat.completions.create({
        model: "gpt-4o-mini",
        messages: [userMessage],
        temperature: 0.4,
        max_tokens: 1600,
      });

      const text1 = response1.choices?.[0]?.message?.content || "";
      let json = extractJSON<SkinAnalysisResponse>(text1);

      if (!json) {
        logger.warn("Validation failure: malformed JSON on first model response.");
        const responseFix = await openai.chat.completions.create({
          model: "gpt-4o-mini",
          messages: [
            userMessage,
            {
              role: "user",
              content: [
                {
                  type: "text",
                  text: "Your last output was not valid JSON. Return ONLY valid JSON matching the schema exactly. No markdown. No extra keys.",
                },
              ],
            },
          ],
          temperature: 0.2,
          max_tokens: 1600,
        });

        const textFix = responseFix.choices?.[0]?.message?.content || "";
        json = extractJSON<SkinAnalysisResponse>(textFix);
      }

      if (!json) {
        logger.warn(
          "Fallback trigger: model returned malformed JSON after repair attempt."
        );
        return this.buildSafeFallbackAnalysis({
          prefs: userPreferences,
          reason: "Model returned malformed JSON after one repair attempt",
        });
      }

      json = this.normalizeAnalysisResponse(json);

      const shapeValidation = skinAnalysisResponseSchema.safeParse(json);
      if (!shapeValidation.success) {
        const validationErrors = shapeValidation.error.issues.map(
          (issue) => `${issue.path.join(".")}: ${issue.message}`
        );

        logger.warn(
          `Validation failure: schema validation failed (${validationErrors.join(
            " | "
          )})`
        );
        logger.warn("Fallback trigger: schema validation failure.");
        return this.buildSafeFallbackAnalysis({
          prefs: userPreferences,
          reason: `Schema validation failed: ${validationErrors.join(", ")}`,
        });
      }

      logger.info("Validation success: response matches schema.");

      const qualityWarnings = this.getQualityWarnings(json);

      this.assertPreferenceCompliance(json, userPreferences);
      if (qualityWarnings.length) {
        json.disclaimers = [...json.disclaimers, ...qualityWarnings];
      }
      return json;
    } catch (err) {
      logger.warn(
        "Skin analysis failed preference validation. Returning sanitized fallback:",
        err
      );
      logger.warn("Fallback trigger: preference compliance failure.");

      if (err instanceof Error) {
        const rawFallback = this.buildSafeFallbackAnalysis({
          prefs: userPreferences,
          reason: err.message,
        });
        const fallback = this.sanitizeForPreferences(rawFallback, userPreferences);
        fallback.disclaimers = [
          ...fallback.disclaimers,
          "Some recommendations were auto-adjusted because the model response did not fully satisfy the requested safety rules.",
        ];
        return fallback;
      }

      return this.buildSafeFallbackAnalysis({
        prefs: userPreferences,
        reason: "Unexpected model pipeline error",
      });
    }
  }
}

export const openAIService = new OpenAIService();

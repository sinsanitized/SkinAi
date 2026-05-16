import { describe, expect, it } from "vitest";
import { openAIService } from "./openai.service";
import type { SkinAnalysisRequest, SkinAnalysisResponse } from "@skinai/shared-types";

function createAnalysis(
  overrides: Partial<SkinAnalysisResponse> = {}
): SkinAnalysisResponse {
  const hasEscalationOverride = Object.prototype.hasOwnProperty.call(
    overrides,
    "escalation"
  );

  return {
    skinType: {
      type: "Combination / Acne-prone",
      confidence: 0.72,
      ...overrides.skinType,
    },
    explanation: {
      skinTypeExplanation: "Visible congestion is concentrated in the T-zone.",
      productBenefits: ["Targets breakouts effectively", "Supports barrier recovery"],
      layeringGuide: ["Cleanser", "Treatment", "Moisturizer"],
      ...overrides.explanation,
    },
    concerns: overrides.concerns ?? [
      {
        name: "Inflammatory acne",
        severity: "Moderate",
        confidence: 0.7,
        evidence: "Clustered inflamed bumps along the chin.",
      },
      {
        name: "Redness / irritation",
        severity: "Mild",
        confidence: 0.62,
        evidence: "Mild diffuse redness on the cheeks.",
      },
      {
        name: "Texture / clogged pores",
        severity: "Moderate",
        confidence: 0.68,
        evidence: "Visible uneven texture around the nose and chin.",
      },
    ],
    ingredients: [],
    products: [],
    routine: {
      AM: ["Cleanser"],
      PM: ["Treatment"],
      weekly: ["Rules: patch test"],
      ...overrides.routine,
    },
    conflicts: [],
    escalation: hasEscalationOverride
      ? (overrides.escalation as SkinAnalysisResponse["escalation"])
      : {
          level: "none",
          reason: "No escalation needed.",
        },
    disclaimers: overrides.disclaimers ?? [],
    timestamp: overrides.timestamp ?? "2026-05-16T00:00:00.000Z",
  };
}

describe("openAIService escalation heuristics", () => {
  it("does not force monitor solely because multiple common concerns are present", () => {
    const analysis = createAnalysis({
      escalation: { level: "none", reason: "" },
    });

    const escalation = (openAIService as unknown as {
      deriveEscalationFromAnalysis: (
        json: Partial<SkinAnalysisResponse>
      ) => SkinAnalysisResponse["escalation"];
    }).deriveEscalationFromAnalysis(analysis);

    expect(escalation.level).toBe("none");
  });

  it("preserves an explicit none escalation level from the model", () => {
    const analysis = createAnalysis({
      escalation: { level: "none", reason: "" },
      skinType: { type: "Combination / Acne-prone", confidence: 0.28 },
    });

    const escalation = (openAIService as unknown as {
      deriveEscalationFromAnalysis: (
        json: Partial<SkinAnalysisResponse>
      ) => SkinAnalysisResponse["escalation"];
    }).deriveEscalationFromAnalysis(analysis);

    expect(escalation.level).toBe("none");
  });

  it("still marks clearly severe cases for medical review", () => {
    const analysis = createAnalysis({
      escalation: undefined,
      concerns: [
        {
          name: "Inflammatory acne",
          severity: "Severe",
          confidence: 0.86,
          evidence: "Large inflamed lesions are visible across the cheeks.",
        },
      ],
    });

    const escalation = (openAIService as unknown as {
      deriveEscalationFromAnalysis: (
        json: Partial<SkinAnalysisResponse>
      ) => SkinAnalysisResponse["escalation"];
    }).deriveEscalationFromAnalysis(analysis);

    expect(escalation.level).toBe("medical_review");
  });
});

describe("openAIService more-active strengthening", () => {
  it("adds a stronger treatment cadence for acne-friendly more-active cases", () => {
    const analysis = createAnalysis({
      ingredients: [
        {
          ingredient: "Ceramides",
          reason: "Barrier support",
          cautions: [],
        },
      ],
      routine: {
        AM: ["Cleanser", "Moisturizer", "Sunscreen"],
        PM: ["Cleanser", "Moisturizer"],
        weekly: [
          "Daily base (AM): cleanse, moisturize, sunscreen",
          "Daily base (PM): cleanse, moisturize",
          "Active cycle (Mon–Sun): Mon Barrier night | Tue Barrier night | Wed Barrier night | Thu Barrier night | Fri Barrier night | Sat Barrier night | Sun Barrier night",
          "Ramp-up (4 weeks): Weeks 1–2 once weekly; Weeks 3–4 twice weekly if calm; Maintenance based on tolerance",
          "Rules: pause if irritated",
        ],
      },
    });

    const strengthened = (openAIService as unknown as {
      strengthenForRoutineIntensity: (
        json: SkinAnalysisResponse,
        prefs: {
          routineIntensity: "minimal" | "balanced" | "more_active";
          pregnancySafe: boolean;
          sensitiveMode: boolean;
        }
      ) => SkinAnalysisResponse;
    }).strengthenForRoutineIntensity(analysis, {
      routineIntensity: "more_active",
      pregnancySafe: false,
      sensitiveMode: false,
    });

    expect(
      strengthened.ingredients.some((ingredient) =>
        ingredient.ingredient.toLowerCase().includes("salicylic")
      )
    ).toBe(true);
    expect(
      strengthened.routine.PM.some((step) =>
        step.toLowerCase().includes("3x-week")
      )
    ).toBe(true);
    expect(
      (strengthened.routine.weekly ?? []).some((step) =>
        step.includes("Fri Treatment night")
      )
    ).toBe(true);
  });
});

describe("openAIService image usability fallback", () => {
  it("returns a low-confidence fallback when the image is unusable", () => {
    const prefs: SkinAnalysisRequest = {
      goals: "acne marks",
      routineIntensity: "balanced",
    };

    const fallback = openAIService.createImageUsabilityFallback(
      prefs,
      "No clearly visible human face was present in the image."
    );

    expect(fallback.skinType.confidence).toBeLessThan(0.2);
    expect(fallback.products).toEqual([]);
    expect(fallback.escalation.level).toBe("monitor");
    expect(fallback.disclaimers.some((item) => item.includes("No reliable face"))).toBe(true);
  });
});

describe("openAIService normalization", () => {
  it("maps unsupported concern labels to the closest supported concern using evidence", () => {
    const normalized = (openAIService as unknown as {
      normalizeAnalysisResponse: (json: SkinAnalysisResponse) => SkinAnalysisResponse;
    }).normalizeAnalysisResponse(
      createAnalysis({
        concerns: [
          {
            name: "Severe nodulocystic acne" as SkinAnalysisResponse["concerns"][number]["name"],
            severity: "Severe",
            confidence: 0.88,
            evidence: "Large inflamed cystic lesions and scarring are visible on the cheeks.",
          },
        ],
      })
    );

    expect(normalized.concerns[0]?.name).toBe("Inflammatory acne");
  });

  it("replaces model timestamps with a fresh server timestamp", () => {
    const normalized = (openAIService as unknown as {
      normalizeAnalysisResponse: (json: SkinAnalysisResponse) => SkinAnalysisResponse;
    }).normalizeAnalysisResponse(
      createAnalysis({
        timestamp: "2023-10-05T12:00:00Z",
      })
    );

    expect(normalized.timestamp).not.toBe("2023-10-05T12:00:00Z");
    expect(Number.isNaN(Date.parse(normalized.timestamp))).toBe(false);
  });
});

describe("openAIService medical-review cleanup", () => {
  it("drops weak generic product names in supportive-care outputs", () => {
    const cleaned = (openAIService as unknown as {
      applyEscalationGuardrails: (
        json: SkinAnalysisResponse
      ) => SkinAnalysisResponse;
    }).applyEscalationGuardrails(
      createAnalysis({
        escalation: {
          level: "medical_review",
          reason: "Visible severe acne and scarring may require professional evaluation.",
        },
        products: [
          {
            name: "Cleansing Foam",
            brand: "COSRX",
            category: "Cleanser",
            why: "Generic cleanser",
            howToUse: "Use daily",
            cautions: [],
            tags: [],
          },
          {
            name: "Toleriane Hydrating Gentle Cleanser",
            brand: "La Roche-Posay",
            category: "Cleanser",
            why: "Supportive option",
            howToUse: "Use daily",
            cautions: [],
            tags: [],
          },
        ],
      })
    );

    expect(
      cleaned.products.some((product) => product.name === "Cleansing Foam")
    ).toBe(false);
    expect(cleaned.products.length).toBeLessThanOrEqual(1);
  });
});

describe("openAIService low-concern maintenance mode", () => {
  it("removes weak barrier concerns and lightens cadence for clear-skin results", () => {
    const lightened = (openAIService as unknown as {
      lightenLowConcernResults: (
        json: SkinAnalysisResponse,
        prefs: {
          routineIntensity: "minimal" | "balanced" | "more_active";
          sensitiveMode: boolean;
        }
      ) => SkinAnalysisResponse;
    }).lightenLowConcernResults(
      createAnalysis({
        skinType: {
          type: "Normal",
          confidence: 0.7,
        },
        concerns: [
          {
            name: "Barrier impairment",
            severity: "Mild",
            confidence: 0.6,
            evidence: "The skin appears somewhat dull, indicating a potential need for brightening.",
          },
        ],
        ingredients: [
          {
            ingredient: "Niacinamide",
            reason: "Brightening support",
            cautions: [],
          },
        ],
        products: [
          {
            name: "Brightening Serum",
            brand: "Some By Mi",
            category: "Serum",
            why: "Brightening support",
            howToUse: "Use daily",
            cautions: [],
            tags: [],
          },
          {
            name: "Hydrating Moisturizer",
            brand: "Innisfree",
            category: "Moisturizer",
            why: "Hydration",
            howToUse: "Use daily",
            cautions: [],
            tags: [],
          },
        ],
        routine: {
          AM: ["Gentle Foaming Cleanser", "Brightening Serum", "Hydrating Moisturizer", "Sunscreen SPF 50"],
          PM: ["Gentle Foaming Cleanser", "Brightening Serum", "Hydrating Moisturizer"],
          weekly: [
            "Daily base (AM): Gentle Foaming Cleanser → Brightening Serum → Hydrating Moisturizer → Sunscreen SPF 50",
            "Daily base (PM): Gentle Foaming Cleanser → Brightening Serum → Hydrating Moisturizer",
            "Active cycle (Mon–Sun): Mon Treatment night | Tue Barrier night | Wed Treatment night | Thu Barrier night | Fri Treatment night | Sat Barrier night | Sun Barrier night",
            "Ramp-up (4 weeks): Weeks 1–2 1 Treatment night; Weeks 3–4 3 Treatment nights; Maintenance 2 Treatment nights per week",
            "Rules: Maintain consistency and adjust based on skin response.",
          ],
        },
      }),
      {
        routineIntensity: "balanced",
        sensitiveMode: false,
      }
    );

    expect(lightened.concerns).toEqual([]);
    expect(
      (lightened.routine.weekly ?? []).some((step) =>
        step.includes("Maintenance night")
      )
    ).toBe(true);
    expect(
      lightened.disclaimers.some((item) =>
        item.includes("Low-concern maintenance mode")
      )
    ).toBe(true);
  });
});

describe("openAIService weak cosmetic evidence filtering", () => {
  it("drops concerns that are only inferred from vague brightness language", () => {
    const normalized = (openAIService as unknown as {
      normalizeAnalysisResponse: (json: SkinAnalysisResponse) => SkinAnalysisResponse;
    }).normalizeAnalysisResponse(
      createAnalysis({
        skinType: {
          type: "Normal",
          confidence: 0.7,
        },
        concerns: [
          {
            name: "Texture / clogged pores",
            severity: "Mild",
            confidence: 0.6,
            evidence: "The skin tone appears even but could benefit from enhanced brightness.",
          },
        ],
      })
    );

    expect(normalized.concerns).toEqual([]);
  });
});

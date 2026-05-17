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
    expect(lightened.routine.AM).toEqual(["Cleanser", "Moisturizer", "Sunscreen"]);
    expect(lightened.routine.PM).toEqual(["Cleanser", "Moisturizer"]);
    expect(lightened.routine.weekly?.[0]).toBe("Daily base (AM): Cleanser, Moisturizer, Sunscreen");
    expect(lightened.routine.weekly?.[1]).toBe("Daily base (PM): Cleanser, Moisturizer");
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

  it("removes stale conflicts when maintenance mode strips the related actives", () => {
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
          confidence: 0.75,
        },
        concerns: [],
        ingredients: [
          {
            ingredient: "Niacinamide",
            reason: "Tone support",
            cautions: [],
          },
        ],
        products: [
          {
            name: "Brightening Serum",
            brand: "The Ordinary",
            category: "Serum",
            why: "Tone support",
            howToUse: "Use nightly",
            cautions: [],
            tags: [],
          },
        ],
        routine: {
          AM: ["Cleanser", "Sunscreen"],
          PM: ["Cleanser", "Brightening Serum"],
          weekly: ["Rules: patch test"],
        },
        conflicts: [
          {
            ingredients: ["Niacinamide", "Vitamin C"],
            warning: "Avoid combining them.",
          },
        ],
      }),
      {
        routineIntensity: "balanced",
        sensitiveMode: false,
      }
    );

    expect(lightened.conflicts).toEqual([]);
  });
});

describe("openAIService maintenance-mode quality warnings", () => {
  it("does not warn that maintenance-mode plans are too thin or under-covered", () => {
    const warnings = (openAIService as unknown as {
      getQualityWarnings: (
        json: SkinAnalysisResponse,
        prefs: {
          routineIntensity: "minimal" | "balanced" | "more_active";
          sensitiveMode: boolean;
        }
      ) => string[];
    }).getQualityWarnings(
      createAnalysis({
        skinType: {
          type: "Normal",
          confidence: 0.75,
        },
        concerns: [],
        products: [
          {
            name: "Gentle Hydrating Cleanser",
            brand: "COSRX",
            category: "Cleanser",
            why: "Gentle cleanse",
            howToUse: "Use daily",
            cautions: [],
            tags: [],
          },
          {
            name: "Moisturizing Cream",
            brand: "Etude House",
            category: "Moisturizer",
            why: "Hydration",
            howToUse: "Use daily",
            cautions: [],
            tags: [],
          },
          {
            name: "Daily Sunscreen SPF 50",
            brand: "Missha",
            category: "Sunscreen",
            why: "UV protection",
            howToUse: "Use daily",
            cautions: [],
            tags: [],
          },
        ],
        routine: {
          AM: ["Cleanser", "Moisturizer", "Sunscreen"],
          PM: ["Cleanser", "Moisturizer"],
          weekly: [
            "Daily base (AM): Cleanser, Moisturizer, Sunscreen",
            "Daily base (PM): Cleanser, Moisturizer",
            "Active cycle (Mon–Sun): Mon Maintenance night | Tue Barrier night | Wed Maintenance night | Thu Barrier night | Fri Maintenance night | Sat Barrier night | Sun Barrier night",
            "Ramp-up (4 weeks): Weeks 1–2 keep the base routine consistent; Weeks 3–4 add only one optional brightening step if desired; Maintenance stay with a low-irritation maintenance rhythm",
            "Rules: if the skin stays clear and comfortable, prioritize consistency over adding stronger treatment products.",
          ],
        },
        disclaimers: [
          "Low-concern maintenance mode was applied because the visible findings appeared minimal.",
        ],
      }),
      {
        routineIntensity: "balanced",
        sensitiveMode: false,
      }
    );

    expect(
      warnings.some((warning) => warning.includes("Routine may be too thin"))
    ).toBe(false);
    expect(
      warnings.some((warning) => warning.includes("Product coverage is narrower"))
    ).toBe(false);
  });
});

describe("openAIService aging-support routing", () => {
  it("switches wrinkle-focused cases to a hydration and repair cadence", () => {
    const adjusted = (openAIService as unknown as {
      alignRoutineToConcernFamily: (
        json: SkinAnalysisResponse,
        prefs: {
          routineIntensity: "minimal" | "balanced" | "more_active";
          pregnancySafe: boolean;
          sensitiveMode: boolean;
        }
      ) => SkinAnalysisResponse;
    }).alignRoutineToConcernFamily(
      createAnalysis({
        skinType: {
          type: "Dry",
          confidence: 0.7,
        },
        concerns: [
          {
            name: "Fine lines",
            severity: "Moderate",
            confidence: 0.6,
            evidence: "Visible fine lines around the eyes and mouth.",
          },
          {
            name: "Dehydration",
            severity: "Moderate",
            confidence: 0.6,
            evidence: "Skin appears rough and lacks moisture.",
          },
        ],
        ingredients: [
          {
            ingredient: "Hyaluronic Acid",
            reason: "Provides hydration.",
            cautions: [],
          },
        ],
        routine: {
          AM: ["Cleanser", "Serum", "Moisturizer", "Sunscreen"],
          PM: ["Cleanser", "Serum", "Moisturizer"],
          weekly: [
            "Daily base (AM): Cleanser, Serum, Moisturizer, Sunscreen",
            "Daily base (PM): Cleanser, Serum, Moisturizer",
            "Active cycle (Mon–Sun): Mon Treatment night | Tue Barrier night | Wed Treatment night | Thu Barrier night | Fri Treatment night | Sat Barrier night | Sun Barrier night",
            "Ramp-up (4 weeks): Weeks 1–2 1-2 treatment nights; Weeks 3–4 3 treatment nights; Maintenance 2 treatment nights",
            "Rules: Focus on hydration and anti-aging.",
          ],
        },
      }),
      {
        routineIntensity: "balanced",
        pregnancySafe: false,
        sensitiveMode: false,
      }
    );

    expect(
      adjusted.ingredients.some((ingredient) =>
        ingredient.ingredient.toLowerCase().includes("peptide")
      )
    ).toBe(true);
    expect(
      adjusted.routine.PM.some((step) => step.toLowerCase().includes("wrinkle-support"))
    ).toBe(true);
    expect(
      (adjusted.routine.weekly ?? []).some((step) => step.includes("Repair night"))
    ).toBe(true);
    expect(
      (adjusted.routine.weekly ?? []).some((step) => step.includes("Hydration night"))
    ).toBe(true);
    expect(
      adjusted.disclaimers.some((item) => item.includes("Aging-support mode"))
    ).toBe(true);
  });

  it("does not flag wrinkle-care plans as too thin when aging-support mode is active", () => {
    const warnings = (openAIService as unknown as {
      getQualityWarnings: (
        json: SkinAnalysisResponse,
        prefs: {
          routineIntensity: "minimal" | "balanced" | "more_active";
          sensitiveMode: boolean;
        }
      ) => string[];
    }).getQualityWarnings(
      createAnalysis({
        skinType: {
          type: "Dry",
          confidence: 0.75,
        },
        concerns: [
          {
            name: "Fine lines",
            severity: "Moderate",
            confidence: 0.8,
            evidence: "Visible wrinkles around the eyes and mouth.",
          },
          {
            name: "Dehydration",
            severity: "Moderate",
            confidence: 0.7,
            evidence: "Skin appears rough and lacks moisture.",
          },
        ],
        routine: {
          AM: ["Cleanser", "Serum", "Moisturizer", "Sunscreen"],
          PM: [
            "Cleanser",
            "Treatment serum - 2x-week to start - use a wrinkle-supportive serum on non-consecutive nights",
            "Moisturizer",
          ],
          weekly: [
            "Daily base (AM): Cleanser, Serum, Moisturizer, Sunscreen",
            "Daily base (PM): Cleanser, Treatment serum - 2x-week to start - use a wrinkle-supportive serum on non-consecutive nights, Moisturizer",
            "Active cycle (Mon–Sun): Mon Repair night | Tue Hydration night | Wed Repair night | Thu Hydration night | Fri Repair night | Sat Hydration night | Sun Recovery night",
            "Ramp-up (4 weeks): Weeks 1–2 use the wrinkle-support step once or twice weekly; Weeks 3–4 increase to two or three nights weekly if comfortable; Maintenance keep the strongest cadence the skin tolerates without dryness",
            "Rules: if dryness, stinging, or tightness increases, reduce wrinkle-focused nights and lean more heavily on hydration and moisturizer.",
          ],
        },
        disclaimers: [
          "Aging-support mode was applied because fine lines and dryness were more prominent than acne-style concerns.",
        ],
      }),
      {
        routineIntensity: "balanced",
        sensitiveMode: false,
      }
    );

    expect(
      warnings.some((warning) => warning.includes("Routine may be too thin"))
    ).toBe(false);
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

  it("drops clogged-pore concerns that are only justified by freckles", () => {
    const normalized = (openAIService as unknown as {
      normalizeAnalysisResponse: (json: SkinAnalysisResponse) => SkinAnalysisResponse;
    }).normalizeAnalysisResponse(
      createAnalysis({
        skinType: {
          type: "Normal",
          confidence: 0.8,
        },
        concerns: [
          {
            name: "Texture / clogged pores",
            severity: "Mild",
            confidence: 0.9,
            evidence: "Visible freckles across the cheeks and nose.",
          },
        ],
      })
    );

    expect(normalized.concerns).toEqual([]);
  });

  it("drops pigmentation concerns that are only justified by freckles", () => {
    const normalized = (openAIService as unknown as {
      normalizeAnalysisResponse: (json: SkinAnalysisResponse) => SkinAnalysisResponse;
    }).normalizeAnalysisResponse(
      createAnalysis({
        skinType: {
          type: "Normal",
          confidence: 0.8,
        },
        concerns: [
          {
            name: "Post-inflammatory hyperpigmentation (PIH)",
            severity: "Mild",
            confidence: 0.7,
            evidence: "Visible freckles across the cheeks and nose.",
          },
        ],
      })
    );

    expect(normalized.concerns).toEqual([]);
  });

  it("drops birthmark-only concerns instead of turning them into PIH or texture issues", () => {
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
            evidence:
              "There are areas of discoloration on the forehead and temples consistent with a facial birthmark.",
          },
          {
            name: "Post-inflammatory hyperpigmentation (PIH)",
            severity: "Mild",
            confidence: 0.6,
            evidence:
              "Visible port-wine stain style birthmark across the forehead.",
          },
        ],
      })
    );

    expect(normalized.concerns).toEqual([]);
  });

  it("drops pigment-only discoloration concerns when there is no real pore or texture evidence", () => {
    const normalized = (openAIService as unknown as {
      normalizeAnalysisResponse: (json: SkinAnalysisResponse) => SkinAnalysisResponse;
    }).normalizeAnalysisResponse(
      createAnalysis({
        concerns: [
          {
            name: "Texture / clogged pores",
            severity: "Mild",
            confidence: 0.6,
            evidence:
              "There are areas of discoloration on the forehead that appear slightly darker than the surrounding skin.",
          },
        ],
      })
    );

    expect(normalized.concerns).toEqual([]);
  });

  it("drops texture concerns that are only supported by vague skin markings or age-related wording", () => {
    const normalized = (openAIService as unknown as {
      normalizeAnalysisResponse: (json: SkinAnalysisResponse) => SkinAnalysisResponse;
    }).normalizeAnalysisResponse(
      createAnalysis({
        concerns: [
          {
            name: "Texture / clogged pores",
            severity: "Mild",
            confidence: 0.6,
            evidence:
              "There are some visible skin markings on the forehead, which may indicate age-related changes.",
          },
        ],
      })
    );

    expect(normalized.concerns).toEqual([]);
  });
});

describe("openAIService focal-lesion routing", () => {
  it("routes lesion-like findings away from acne-style routines", () => {
    const routed = (openAIService as unknown as {
      routeFocalLesionResults: (json: SkinAnalysisResponse) => SkinAnalysisResponse;
    }).routeFocalLesionResults(
      createAnalysis({
        skinType: {
          type: "Combination / Acne-prone",
          confidence: 0.7,
        },
        explanation: {
          skinTypeExplanation:
            "Visible bumps and uneven texture around the chin area.",
          productBenefits: ["Targets texture"],
          layeringGuide: ["Cleanser", "Treatment", "Moisturizer"],
        },
        concerns: [
          {
            name: "Texture / clogged pores",
            severity: "Moderate",
            confidence: 0.6,
            evidence: "Visible bumps and uneven texture around the chin area.",
          },
          {
            name: "Dehydration",
            severity: "Mild",
            confidence: 0.5,
            evidence: "Lips appear dry and skin shows some flakiness.",
          },
        ],
        ingredients: [
          {
            ingredient: "Salicylic Acid",
            reason: "Helps clear bumps.",
            cautions: [],
          },
        ],
        products: [
          {
            name: "BHA Blackhead Power Liquid",
            brand: "COSRX",
            category: "Serum",
            why: "Targets texture",
            howToUse: "Use at night",
            cautions: [],
            tags: [],
          },
          {
            name: "Moisturizing Cream",
            brand: "Etude House",
            category: "Moisturizer",
            why: "Hydration",
            howToUse: "Use daily",
            cautions: [],
            tags: [],
          },
          {
            name: "Daily Sunscreen SPF 50",
            brand: "Missha",
            category: "Sunscreen",
            why: "UV protection",
            howToUse: "Use daily",
            cautions: [],
            tags: [],
          },
        ],
        routine: {
          AM: ["Cleanser", "Moisturizer", "Sunscreen"],
          PM: ["Cleanser", "Treatment", "Moisturizer"],
          weekly: [
            "Daily base (AM): Cleanser, Moisturizer, Sunscreen",
            "Daily base (PM): Cleanser, Treatment, Moisturizer",
            "Active cycle (Mon–Sun): Mon Treatment night | Tue Barrier night | Wed Treatment night | Thu Barrier night | Fri Treatment night | Sat Barrier night | Sun Barrier night",
            "Ramp-up (4 weeks): Weeks 1–2 1 Treatment night; Weeks 3–4 2 Treatment nights; Maintenance 3 Treatment nights",
            "Rules: Adjust treatment frequency based on skin tolerance.",
          ],
        },
      })
    );

    expect(routed.escalation.level).toBe("monitor");
    expect(routed.routine.PM).toEqual(["Cleanser", "Moisturizer"]);
    expect(
      routed.disclaimers.some((item) => item.includes("Focal-lesion mode"))
    ).toBe(true);
    expect(routed.concerns).toEqual([]);
  });

  it("can still reroute a localized raised bump even if the model labels it inflammatory acne", () => {
    const routed = (openAIService as unknown as {
      routeFocalLesionResults: (json: SkinAnalysisResponse) => SkinAnalysisResponse;
    }).routeFocalLesionResults(
      createAnalysis({
        concerns: [
          {
            name: "Inflammatory acne",
            severity: "Moderate",
            confidence: 0.6,
            evidence: "Visible bumps and some redness around the chin area.",
          },
        ],
      })
    );

    expect(routed.escalation.level).toBe("monitor");
    expect(routed.concerns).toEqual([]);
    expect(routed.routine.PM).toEqual(["Cleanser", "Moisturizer"]);
  });

  it("does not add thin-routine warnings in focal-lesion mode", () => {
    const warnings = (openAIService as unknown as {
      getQualityWarnings: (
        json: SkinAnalysisResponse,
        prefs: {
          routineIntensity: "minimal" | "balanced" | "more_active";
          sensitiveMode: boolean;
        }
      ) => string[];
    }).getQualityWarnings(
      createAnalysis({
        skinType: {
          type: "Sensitive-leaning",
          confidence: 0.35,
        },
        concerns: [],
        routine: {
          AM: ["Cleanser", "Moisturizer", "Sunscreen"],
          PM: ["Cleanser", "Moisturizer"],
          weekly: [
            "Daily base (AM): Cleanser, Moisturizer, Sunscreen",
            "Daily base (PM): Cleanser, Moisturizer",
            "Active cycle (Mon–Sun): Mon Barrier night | Tue Barrier night | Wed Barrier night | Thu Barrier night | Fri Barrier night | Sat Barrier night | Sun Barrier night",
            "Ramp-up (4 weeks): Weeks 1–2 keep the routine gentle; Weeks 3–4 continue basic care; Maintenance prioritize observation",
            "Rules: if the spot changes or bleeds, arrange a clinical skin check",
          ],
        },
        products: [
          {
            name: "Gentle Cleanser",
            brand: "COSRX",
            category: "Cleanser",
            why: "Gentle cleansing",
            howToUse: "Use daily",
            cautions: [],
            tags: [],
          },
          {
            name: "Moisturizing Cream",
            brand: "Etude House",
            category: "Moisturizer",
            why: "Hydration",
            howToUse: "Use daily",
            cautions: [],
            tags: [],
          },
          {
            name: "Daily Sunscreen SPF 50",
            brand: "Missha",
            category: "Sunscreen",
            why: "UV protection",
            howToUse: "Use daily",
            cautions: [],
            tags: [],
          },
        ],
        disclaimers: [
          "Focal-lesion mode was applied because the visible finding looked more like a mole, wart, tag, cyst, or localized growth than ordinary acne-style texture.",
        ],
      }),
      {
        routineIntensity: "balanced",
        sensitiveMode: false,
      }
    );

    expect(
      warnings.some((warning) => warning.includes("Routine may be too thin"))
    ).toBe(false);
    expect(
      warnings.some((warning) => warning.includes("Product coverage is narrower"))
    ).toBe(false);
  });
});

describe("openAIService special-condition routing", () => {
  it("routes melasma-like findings into pigment-pattern mode", () => {
    const routed = (openAIService as unknown as {
      routePigmentPatternResults: (json: SkinAnalysisResponse) => SkinAnalysisResponse;
    }).routePigmentPatternResults(
      createAnalysis({
        concerns: [
          {
            name: "Post-inflammatory hyperpigmentation (PIH)",
            severity: "Moderate",
            confidence: 0.7,
            evidence: "Symmetric melasma-style pigmentation is visible across the cheeks and forehead.",
          },
        ],
      })
    );

    expect(routed.escalation.level).toBe("none");
    expect(routed.concerns[0]?.name).toBe("Post-inflammatory hyperpigmentation (PIH)");
    expect(
      routed.disclaimers.some((item) => item.includes("Pigment-pattern mode"))
    ).toBe(true);
    expect(routed.routine.AM).toEqual([
      "Cleanser",
      "Pigment-support serum",
      "Moisturizer",
      "Sunscreen",
    ]);
  });

  it("routes rosacea-like findings into a barrier-first monitor plan", () => {
    const routed = (openAIService as unknown as {
      routeBarrierConditionResults: (json: SkinAnalysisResponse) => SkinAnalysisResponse;
    }).routeBarrierConditionResults(
      createAnalysis({
        concerns: [
          {
            name: "Redness / irritation",
            severity: "Moderate",
            confidence: 0.7,
            evidence: "Persistent redness, flushing, and visible vessels suggest a rosacea-like pattern.",
          },
        ],
      })
    );

    expect(routed.escalation.level).toBe("monitor");
    expect(routed.skinType.type).toBe("Sensitive-leaning");
    expect(
      routed.disclaimers.some((item) => item.includes("Barrier-condition mode"))
    ).toBe(true);
    expect(routed.routine.weekly?.[2]).toContain("Barrier night");
  });

  it("routes suspicious rough patches into medical review", () => {
    const routed = (openAIService as unknown as {
      routeSuspiciousMedicalResults: (json: SkinAnalysisResponse) => SkinAnalysisResponse;
    }).routeSuspiciousMedicalResults(
      createAnalysis({
        concerns: [
          {
            name: "Texture / clogged pores",
            severity: "Moderate",
            confidence: 0.6,
            evidence: "A persistent rough actinic keratosis-like patch is visible on the cheek.",
          },
        ],
      })
    );

    expect(routed.escalation.level).toBe("medical_review");
    expect(
      routed.disclaimers.some((item) => item.includes("Suspicious-patch mode"))
    ).toBe(true);
  });

  it("routes vitiligo-like findings into hypopigment mode", () => {
    const routed = (openAIService as unknown as {
      routeHypopigmentResults: (json: SkinAnalysisResponse) => SkinAnalysisResponse;
    }).routeHypopigmentResults(
      createAnalysis({
        concerns: [
          {
            name: "Barrier impairment",
            severity: "Mild",
            confidence: 0.5,
            evidence: "Visible hypopigmented patches suggest a vitiligo-like pattern.",
          },
        ],
      })
    );

    expect(routed.escalation.level).toBe("monitor");
    expect(routed.concerns).toEqual([]);
    expect(
      routed.disclaimers.some((item) => item.includes("Hypopigment mode"))
    ).toBe(true);
  });

  it("routes milia-like findings away from classic acne plans", () => {
    const routed = (openAIService as unknown as {
      routeFollicularVariantResults: (
        json: SkinAnalysisResponse,
        prefs: { pregnancySafe: boolean }
      ) => SkinAnalysisResponse;
    }).routeFollicularVariantResults(
      createAnalysis({
        concerns: [
          {
            name: "Texture / clogged pores",
            severity: "Mild",
            confidence: 0.55,
            evidence: "Tiny white bumps around the eyes look more like milia than inflamed acne.",
          },
        ],
      }),
      {
        pregnancySafe: false,
      }
    );

    expect(routed.escalation.level).toBe("none");
    expect(
      routed.disclaimers.some((item) => item.includes("Follicular-variant mode"))
    ).toBe(true);
    expect(routed.routine.PM[1]).toContain("retinoid-style");
  });
});

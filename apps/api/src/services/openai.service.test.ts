import { describe, expect, it } from "vitest";
import { openAIService } from "./openai.service";
import type { SkinAnalysisResponse } from "@skinai/shared-types";

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

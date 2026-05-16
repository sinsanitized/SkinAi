import { describe, expect, it, vi, afterEach } from "vitest";
import { skinAnalysisApi } from "./skinAnalysisApi";

describe("skinAnalysisApi", () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("returns parsed analysis data on success", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue({
        ok: true,
        text: async () =>
          JSON.stringify({
            success: true,
            data: {
              skinType: { type: "Combination", confidence: 0.81 },
              explanation: {
                skinTypeExplanation: "Combination skin profile",
                productBenefits: ["Supports barrier balance"],
                layeringGuide: ["Cleanser first"],
              },
              concerns: [],
              ingredients: [],
              products: [],
              routine: { AM: ["Cleanser"], PM: ["Moisturizer"] },
              conflicts: [],
              escalation: { level: "none", reason: "No escalation needed." },
              disclaimers: [],
              timestamp: "2026-05-16T00:00:00.000Z",
            },
          }),
      })
    );

    const analysis = await skinAnalysisApi.analyzeSkin(
      new File(["image"], "face.jpg", { type: "image/jpeg" })
    );

    expect(analysis.skinType.type).toBe("Combination");
    expect(analysis.routine.AM).toEqual(["Cleanser"]);
  });

  it("surfaces structured API errors", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue({
        ok: false,
        status: 400,
        text: async () =>
          JSON.stringify({
            success: false,
            error: "No image file provided",
          }),
      })
    );

    await expect(
      skinAnalysisApi.analyzeSkin(
        new File(["image"], "face.jpg", { type: "image/jpeg" })
      )
    ).rejects.toThrow("No image file provided");
  });
});

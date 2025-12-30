import { getOpenAIClient } from "../config/openai";
import type {
  SkinAnalysisResponse,
  SkinAnalysisRequest,
} from "@skinai/shared-types";

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
    console.error("Failed to parse JSON:", err);
    return null;
  }
}

const EMBEDDING_CONFIG = {
  model: "text-embedding-3-large",
} as const;

export class OpenAIService {
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
- Focus on skin, not attractiveness or identity.
- Do NOT diagnose medical conditions.
- Be precise, neutral, and uncertainty-aware.

INCLUDE:
1) Skin findings by facial region (forehead, cheeks, nose/T-zone, jaw/chin, under-eyes).
2) Lesion types if present (comedones, papules, pustules, cyst-like bumps, marks).
3) Redness/erythema, hyperpigmentation, texture irregularities, pore visibility.
4) Oil/shine vs dryness/dehydration cues.
5) Relative severity (mild / moderate / pronounced).
6) Symmetry or clustering patterns.
7) Image quality notes that affect certainty (lighting, blur, angle).

EXCLUDE:
- Judgments of attractiveness
- Causes or diagnoses
- Treatment advice

FORMAT:
Return a concise paragraph or short bullet-style sentences describing what is visible and where.
If something is not clearly visible, state that explicitly.
`,
            },
            {
              type: "image_url",
              image_url: { url: `data:${mimeType};base64,${imageBase64}` },
            },
          ],
        },
      ],
      max_tokens: 450,
      temperature: 0.2,
    });

    const description = response.choices[0]?.message?.content || "";
    if (!description) {
      throw new Error("No description returned from vision model");
    }
    console.log("Image description for embedding:", description);
    return description;
  }

  /**
   * Build a stronger prompt that forces richer routines + weekly schedule + product slots.
   */
  private buildSkinPrompt(args: {
    prefs: {
      goals: string;
      budget: string;
      fragranceFree: boolean;
      pregnancySafe: boolean;
      sensitiveMode: boolean;
    };
    houseContext: string;
  }): string {
    const { prefs, houseContext } = args;

    return `
You are a cautious skincare assistant specializing in Korean skincare routines.

ROLE + STYLE:
- Be practical and specific (step order, frequency, amount, when to stop).
- Avoid moralizing or attractiveness comments.
- Do NOT diagnose diseases.
- If the photo is unclear, say so and reduce confidence, but still provide a safe minimal routine.

USER PREFERENCES (must be respected):
- goals: "${prefs.goals}"
- budget: "${prefs.budget || "mid-range"}"
- fragranceFree: ${
      prefs.fragranceFree
    } (if true, prioritize fragrance-free options; mention uncertainty)
- pregnancySafe: ${
      prefs.pregnancySafe
    } (if true, avoid retinoids and other pregnancy-contraindicated actives; when unsure, choose safer alternatives)
- sensitiveMode: ${
      prefs.sensitiveMode
    } (if true, simplify routine, reduce actives, slower ramp)

${houseContext}

TASK:
Analyze ONLY visible facial skin characteristics and produce a structured JSON report matching the exact schema below.
Output MUST be VALID JSON ONLY. No markdown. No commentary.

QUALITY RULES (IMPORTANT):
1) Routine MUST feel tailored to observed issues. Do NOT output generic routines.
2) AM routine must have 5–7 steps. PM routine must have 6–9 steps.
   - If sensitiveMode=true, AM may be 4–6 and PM may be 5–8, but still specific.
3) Every routine step MUST include:
   - a CATEGORY (cleanser/toner/serum/moisturizer/sunscreen/etc),
   - a FREQUENCY (daily / 2x-week / etc),
   - and a SHORT CONDITION (e.g., "skip if stinging", "only on non-retinoid nights").
4) routine.weekly is REQUIRED and must include:
   - a simple actives schedule (e.g., "Retinoid nights: Mon/Thu", "Exfoliation: Sat", "Barrier nights: other nights")
   - a 4-week ramp-up guide if using any active (retinoid, AHA/BHA, vitamin C, benzoyl peroxide, azelaic acid, TXA).
5) Products: recommend by SLOTS so it’s actionable (don’t list random items).
   - Must include at least:
     - 1 gentle cleanser option
     - 1 moisturizer option (and if oily/acne-prone, optionally a lighter gel option)
     - 1 sunscreen option
     - 1 targeted active serum/treatment aligned to top concern
   - You may include 1–2 alternates per slot based on budget/fragranceFree/sensitiveMode.
6) Do not invent brands. Prefer widely available K-beauty brands. If uncertain, choose safe mainstream options.
7) Conflicts must include concrete “do not combine same night” warnings relevant to ingredients you recommended.

EVIDENCE RULE:
For each concern, include specific visible evidence from the photo (e.g., "clustered red papules on cheeks", "shine in T-zone", "visible post-acne marks on jaw").
If lighting/angle obstructs, state that.

Return JSON ONLY matching this exact shape:

{
  "skinType": { "type": "Oily | Dry | Combination | Normal | Acne-prone | Sensitive-leaning | Oily / Acne-prone | Combination / Acne-prone", "confidence": 0 },
  "concerns": [{"name": "...", "severity": "Mild|Moderate|Severe", "confidence": 0, "evidence": "..."}],
  "ingredients": [{"ingredient": "...", "reason": "...", "cautions": ["..."]}],
  "products": [{"name": "...", "brand": "...", "category": "Cleanser|Toner|Essence|Serum|Moisturizer|Sunscreen|Spot treatment|Mask", "why": "...", "howToUse": "...", "cautions": ["..."], "tags": ["..."]}],
  "routine": {
    "AM": ["..."],
    "PM": ["..."],
    "weekly": [
      "Active schedule: ...",
      "Weeks 1–2: ...",
      "Weeks 3–4: ...",
      "Maintenance: ..."
    ]
  },
  "conflicts": [{"ingredients": ["...","..."], "warning": "..."}],
  "disclaimers": ["..."],
  "timestamp": "ISO-8601"
}

FINAL CHECK BEFORE YOU ANSWER:
- Valid JSON only
- AM length 5–7 and PM length 6–9 (unless sensitiveMode allows shorter)
- routine.weekly includes active schedule + ramp-up
- at least 4 product slots covered
`;
  }

  /**
   * Validates whether the model response is "rich enough" to avoid lackluster routines.
   * Throws to trigger a retry.
   */
  private assertRichEnough(json: SkinAnalysisResponse): void {
    const amLen = json?.routine?.AM?.length ?? 0;
    const pmLen = json?.routine?.PM?.length ?? 0;
    const weeklyLen = json?.routine?.weekly?.length ?? 0;
    const productsLen = (json as any)?.products?.length ?? 0;

    if (amLen < 4 || pmLen < 5) {
      throw new Error(`Routine too short (AM=${amLen}, PM=${pmLen})`);
    }
    if (weeklyLen < 2) {
      throw new Error("Weekly plan missing/too short");
    }
    if (productsLen < 4) {
      throw new Error("Not enough product slots covered");
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
    const openai = getOpenAIClient();

    const { imageBase64, mimeType, userPrefs, retrievedContext = [] } = args;

    const houseContext = retrievedContext.length
      ? `OPTIONAL CONTEXT (do NOT quote; use only as weak prior signals):\n- ${retrievedContext
          .slice(0, 6)
          .map((x) => x.replace(/\s+/g, " ").slice(0, 180))
          .join("\n- ")}\n`
      : "";

    const prefs = {
      goals: userPrefs.goals || "",
      budget: userPrefs.budget || "",
      fragranceFree: !!userPrefs.fragranceFree,
      pregnancySafe: !!userPrefs.pregnancySafe,
      sensitiveMode: !!userPrefs.sensitiveMode,
    };

    const prompt = this.buildSkinPrompt({ prefs, houseContext });

    const imageContent = {
      type: "image_url" as const,
      image_url: { url: `data:${mimeType};base64,${imageBase64}` },
    };

    const userMessage = {
      role: "user" as const,
      content: [{ type: "text" as const, text: prompt }, imageContent],
    };

    // First attempt
    const response1 = await openai.chat.completions.create({
      model: "gpt-4o-mini",
      messages: [userMessage],
      temperature: 0.4,
      max_tokens: 1400,
    });

    const text1 = response1.choices?.[0]?.message?.content || "";
    let json = extractJSON<SkinAnalysisResponse>(text1);

    // If parse failed, retry once focusing on strict JSON output.
    if (!json) {
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
        max_tokens: 1400,
      });

      const textFix = responseFix.choices?.[0]?.message?.content || "";
      json = extractJSON<SkinAnalysisResponse>(textFix);
    }

    if (!json) {
      throw new Error("Model returned unparseable JSON");
    }

    // Ensure timestamp
    if (!(json as any).timestamp)
      (json as any).timestamp = new Date().toISOString();

    // Richness check: if too short/generic, retry once with a corrective instruction.
    try {
      this.assertRichEnough(json);
      return json;
    } catch (err) {
      console.warn("Skin analysis too generic/short. Retrying once:", err);

      const response2 = await openai.chat.completions.create({
        model: "gpt-4o-mini",
        messages: [
          userMessage,
          {
            role: "user",
            content: [
              {
                type: "text",
                text: "Your last output was too generic/short. Expand with specific step frequencies, conditions (when to skip), a clear weekly actives schedule, a 4-week ramp-up plan, and product recommendations by slot. Return valid JSON only.",
              },
            ],
          },
        ],
        temperature: 0.35,
        max_tokens: 1600,
      });

      const text2 = response2.choices?.[0]?.message?.content || "";
      const json2 = extractJSON<SkinAnalysisResponse>(text2);

      if (!json2) {
        // fall back to first valid JSON
        return json;
      }

      if (!(json2 as any).timestamp)
        (json2 as any).timestamp = new Date().toISOString();

      // If still not rich enough, return json2 anyway (better attempt), or fallback.
      try {
        this.assertRichEnough(json2);
        return json2;
      } catch {
        return json2;
      }
    }
  }
}

export const openAIService = new OpenAIService();

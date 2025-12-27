import { getOpenAIClient } from "../config/openai";
import type {
  SkinAnalysisResponse,
  SkinAnalysisRequest,
} from "@skinai/shared-types";

/**
 * Helper function to safely extract JSON from LLM responses.
 */
function extractJSON<T = any>(text: string): T | null {
  try {
    const match = text.match(/\{[\s\S]*\}/);
    if (!match) return null;
    return JSON.parse(match[0]);
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
              text:
                "Describe ONLY the visible facial skin characteristics in this image (acne types, redness, hyperpigmentation, texture, pores, dryness/dehydration signs, shine/oil). " +
                "Avoid judgments about attractiveness. Be specific but cautious.",
            },
            {
              type: "image_url",
              image_url: { url: `data:${mimeType};base64,${imageBase64}` },
            },
          ],
        },
      ],
      max_tokens: 450,
    });

    const description = response.choices[0]?.message?.content || "";
    if (!description)
      throw new Error("No description returned from vision model");
    return description;
  }

  /**
   * Main: generate structured skin analysis response for UI.
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

    const prompt = `
You are a cautious skincare assistant specializing in Korean skincare routines.

TASK:
Analyze the FACE PHOTO and return a structured JSON report with:
- skinType (with confidence)
- concerns (name, severity, confidence, evidence)
- ingredient recommendations (with brief reasons and cautions)
- product recommendations (K-beauty leaning; keep to popular, widely available products; do not invent brands)
- simple AM/PM routine steps
- ingredient conflicts to avoid (retinoids + AHA/BHA same night, etc.)
- disclaimers (non-medical, lighting/camera limits)

SAFETY:
- Do NOT diagnose diseases.
- If the image is unclear, say so in evidence and lower confidence.
- Avoid moralizing language. Avoid attractiveness comments.
- Prefer gentle routines; minimize irritation.

USER PREFERENCES:
- goals: "${prefs.goals}"
- budget: "${prefs.budget}"
- fragranceFree: ${prefs.fragranceFree}
- pregnancySafe: ${prefs.pregnancySafe}
- sensitiveMode: ${prefs.sensitiveMode}

${houseContext}

Return JSON ONLY matching this shape:

{
  "skinType": { "type": "Oily | Dry | Combination | Normal | Acne-prone | Sensitive-leaning | Oily / Acne-prone | Combination / Acne-prone", "confidence": 0 },
  "concerns": [{"name": "...", "severity": "Mild|Moderate|Severe", "confidence": 0, "evidence": "..."}],
  "ingredients": [{"ingredient": "...", "reason": "...", "cautions": ["..."]}],
  "products": [{"name": "...", "brand": "...", "category": "Cleanser|Toner|Essence|Serum|Moisturizer|Sunscreen|Spot treatment|Mask", "why": "...", "howToUse": "...", "cautions": ["..."], "tags": ["..."]}],
  "routine": { "AM": ["..."], "PM": ["..."], "weekly": ["..."] },
  "conflicts": [{"ingredients": ["...","..."], "warning": "..."}],
  "disclaimers": ["..."],
  "timestamp": "ISO-8601"
}
`;

    const response = await openai.chat.completions.create({
      model: "gpt-4o-mini",
      messages: [
        {
          role: "user",
          content: [
            { type: "text", text: prompt },
            {
              type: "image_url",
              image_url: { url: `data:${mimeType};base64,${imageBase64}` },
            },
          ],
        },
      ],
      temperature: 0.4,
      max_tokens: 1200,
    });

    const text = response.choices?.[0]?.message?.content || "";
    const json = extractJSON<SkinAnalysisResponse>(text);

    if (!json) {
      throw new Error("Model returned unparseable JSON");
    }

    if (!json.timestamp) (json as any).timestamp = new Date().toISOString();

    return json;
  }
}

export const openAIService = new OpenAIService();

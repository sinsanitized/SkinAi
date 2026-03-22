import type {
  ApiResponse,
  SkinAnalysisRequest,
  SkinAnalysisResponse,
  ValueFocus,
} from "@skinai/shared-types";

// In dev, use Vite proxy by default (same-origin).
// In prod, set VITE_API_URL (e.g. https://api.yourdomain.com)
const API_URL = import.meta.env.VITE_API_URL || "";

export class SkinAnalysisApi {
  async analyzeSkin(
    imageFile: File,
    analysisOptions: SkinAnalysisRequest = {}
  ): Promise<SkinAnalysisResponse> {
    const formData = new FormData();
    formData.append("image", imageFile);

    if (analysisOptions.goals) {
      formData.append("goals", analysisOptions.goals);
    }

    if (typeof analysisOptions.age === "number") {
      formData.append("age", String(analysisOptions.age));
    }

    if (analysisOptions.valueFocus) {
      formData.append(
        "valueFocus",
        analysisOptions.valueFocus satisfies ValueFocus
      );
    }

    if (typeof analysisOptions.fragranceFree === "boolean") {
      formData.append(
        "fragranceFree",
        String(analysisOptions.fragranceFree)
      );
    }
    if (typeof analysisOptions.pregnancySafe === "boolean") {
      formData.append("pregnancySafe", String(analysisOptions.pregnancySafe));
    }
    if (typeof analysisOptions.sensitiveMode === "boolean") {
      formData.append("sensitiveMode", String(analysisOptions.sensitiveMode));
    }

    const response = await fetch(`${API_URL}/api/skin/analyze`, {
      method: "POST",
      body: formData,
    });

    // If server returned non-JSON, avoid crashing on response.json()
    const text = await response.text();
    let data: ApiResponse<SkinAnalysisResponse> | null = null;
    try {
      data = JSON.parse(text);
    } catch {
      data = null;
    }

    if (!response.ok) {
      throw new Error(
        (data as any)?.error || text || `Request failed (${response.status})`
      );
    }

    if (!data?.success) {
      throw new Error(data?.error || "Failed to analyze skin");
    }

    if (!data.data) throw new Error("No data received from server");
    return data.data;
  }

  async healthCheck(): Promise<boolean> {
    try {
      const response = await fetch(`${API_URL}/api/health`);
      const data: ApiResponse<any> = await response.json();
      return !!data.success;
    } catch {
      return false;
    }
  }
}

export const skinAnalysisApi = new SkinAnalysisApi();

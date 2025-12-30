import type {
  SkinAnalysisResponse,
  ApiResponse,
  SkinAnalysisRequest,
} from "@skinai/shared-types";

// In dev, use Vite proxy by default (same-origin).
// In prod, set VITE_API_URL (e.g. https://api.yourdomain.com)
const API_URL = import.meta.env.VITE_API_URL || "";

export class ApiService {
  async analyzeSkin(
    imageFile: File,
    prefs: SkinAnalysisRequest = {}
  ): Promise<SkinAnalysisResponse> {
    const formData = new FormData();
    formData.append("image", imageFile);

    if (prefs.goals) formData.append("goals", prefs.goals);

    // NEW
    if (typeof (prefs as any).age === "number")
      formData.append("age", String((prefs as any).age));

    // NEW (optional, defaults server-side too)
    if ((prefs as any).valueFocus)
      formData.append("valueFocus", String((prefs as any).valueFocus));

    if (typeof prefs.fragranceFree === "boolean")
      formData.append("fragranceFree", String(prefs.fragranceFree));
    if (typeof prefs.pregnancySafe === "boolean")
      formData.append("pregnancySafe", String(prefs.pregnancySafe));
    if (typeof prefs.sensitiveMode === "boolean")
      formData.append("sensitiveMode", String(prefs.sensitiveMode));

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

export const apiService = new ApiService();

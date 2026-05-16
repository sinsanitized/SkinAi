import type {
  ApiResponse,
  ErrorResponse,
  RoutineIntensity,
  SkinAnalysisRequest,
  SkinAnalysisResponse,
} from "@skinai/shared-types";

// In dev, use Vite proxy by default (same-origin).
// In prod, set VITE_API_URL (e.g. https://api.yourdomain.com)
const API_URL = import.meta.env.VITE_API_URL || "";

function parseApiResponse(
  text: string
): ApiResponse<SkinAnalysisResponse> | ErrorResponse | null {
  try {
    return JSON.parse(text) as ApiResponse<SkinAnalysisResponse> | ErrorResponse;
  } catch {
    return null;
  }
}

function getApiErrorMessage(
  data: ApiResponse<SkinAnalysisResponse> | ErrorResponse | null,
  fallback: string
): string {
  if (data && "error" in data && typeof data.error === "string") {
    return data.error;
  }

  return fallback;
}

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

    if (analysisOptions.routineIntensity) {
      formData.append(
        "routineIntensity",
        analysisOptions.routineIntensity satisfies RoutineIntensity
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
    const data = parseApiResponse(text);

    if (!response.ok) {
      throw new Error(getApiErrorMessage(data, text || `Request failed (${response.status})`));
    }

    if (!data || !("success" in data) || !data.success) {
      throw new Error(getApiErrorMessage(data, "Failed to analyze skin"));
    }

    if (!data.data) throw new Error("No data received from server");
    return data.data;
  }

  async healthCheck(): Promise<boolean> {
    try {
      const response = await fetch(`${API_URL}/api/health`);
      const data = (await response.json()) as ApiResponse<{
        status: string;
        pinecone: boolean;
        timestamp: string;
      }>;
      return data.success === true;
    } catch {
      return false;
    }
  }
}

export const skinAnalysisApi = new SkinAnalysisApi();

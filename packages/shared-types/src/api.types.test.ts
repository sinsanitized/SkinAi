import { describe, expect, it, expectTypeOf } from "vitest";
import type { ApiResponse, ErrorResponse } from "./api.types";

describe("api type contracts", () => {
  it("supports success payloads with typed data", () => {
    const response: ApiResponse<{ status: string }> = {
      success: true,
      data: { status: "ok" },
    };

    expect(response.data?.status).toBe("ok");
    expectTypeOf(response).toEqualTypeOf<ApiResponse<{ status: string }>>();
  });

  it("supports error payloads with details", () => {
    const response: ErrorResponse = {
      success: false,
      error: "Invalid request",
      details: "Missing image",
    };

    expect(response.details).toBe("Missing image");
    expectTypeOf(response).toEqualTypeOf<ErrorResponse>();
  });
});

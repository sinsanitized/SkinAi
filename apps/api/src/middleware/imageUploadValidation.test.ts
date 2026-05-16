import { describe, expect, it, vi } from "vitest";
import type { NextFunction, Request, Response } from "express";
import { validateImageUploadRequest } from "./imageUploadValidation";

function createResponse() {
  const json = vi.fn();
  const status = vi.fn().mockReturnValue({ json });

  return {
    json,
    status,
  };
}

describe("validateImageUploadRequest", () => {
  it("rejects requests without an uploaded file", () => {
    const response = createResponse();
    const next = vi.fn() as NextFunction;

    validateImageUploadRequest(
      {} as Request,
      response as unknown as Response,
      next
    );

    expect(response.status).toHaveBeenCalledWith(400);
    expect(response.json).toHaveBeenCalledWith({
      success: false,
      error: "No image file provided",
    });
    expect(next).not.toHaveBeenCalled();
  });

  it("accepts supported image uploads", () => {
    const response = createResponse();
    const next = vi.fn() as NextFunction;

    validateImageUploadRequest(
      {
        file: {
          size: 1024,
          mimetype: "image/jpeg",
        },
      } as Request,
      response as unknown as Response,
      next
    );

    expect(next).toHaveBeenCalledOnce();
    expect(response.status).not.toHaveBeenCalled();
  });
});

import { describe, expect, it } from "vitest";
import { imageProcessingService } from "./imageProcessing.service";

function createTinyPngBuffer(): Buffer {
  return Buffer.from(
    "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAusB9Wn9xAoAAAAASUVORK5CYII=",
    "base64"
  );
}

describe("imageProcessingService validation", () => {
  it("rejects images that are too small for reliable analysis", async () => {
    await expect(
      imageProcessingService.validateImage(createTinyPngBuffer(), "image/png")
    ).rejects.toThrow("Image too small for reliable skin analysis");
  });
});

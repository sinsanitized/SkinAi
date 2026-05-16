import sharp from 'sharp';

export class ImageProcessingService {
  private readonly MAX_FILE_SIZE = 10 * 1024 * 1024; // 10MB
  private readonly ALLOWED_FORMATS = ['jpeg', 'jpg', 'png', 'webp'];
  private readonly MAX_DIMENSION = 2048; // Max width/height
  private readonly MIN_DIMENSION = 96; // Small images do not provide usable skin detail

  /**
   * Validate image format and size
   */
  async validateImage(buffer: Buffer, mimetype: string): Promise<void> {
    // Check file size
    if (buffer.length > this.MAX_FILE_SIZE) {
      throw new Error(`Image too large. Max size is ${this.MAX_FILE_SIZE / 1024 / 1024}MB`);
    };

    // Check mimetype
    const format = mimetype.split('/')[1];
    if (!this.ALLOWED_FORMATS.includes(format)) {
      throw new Error(`Invalid image format. Allowed: ${this.ALLOWED_FORMATS.join(', ')}`);
    };

    try {
      const metadata = await sharp(buffer).metadata();
      if (!metadata.width || !metadata.height) {
        throw new Error("Image dimensions could not be read");
      }

      if (
        metadata.width < this.MIN_DIMENSION ||
        metadata.height < this.MIN_DIMENSION
      ) {
        throw new Error(
          `Image too small for reliable skin analysis. Minimum size is ${this.MIN_DIMENSION}x${this.MIN_DIMENSION}px`
        );
      }
    } catch (error) {
      if (error instanceof Error) {
        throw error;
      }

      throw new Error("Image could not be decoded for analysis");
    }
  }

  /**
   * Process and optimize image
   * - Resize if too large
   * - Convert to JPEG
   * - Compress
   */
  async processImage(buffer: Buffer): Promise<{ buffer: Buffer; mimeType: string }> {
    try {
      const image = sharp(buffer);
      const metadata = await image.metadata();

      let processedImage = image;

      // Resize if image is too large
      if (metadata.width && metadata.width > this.MAX_DIMENSION) {
        processedImage = processedImage.resize(this.MAX_DIMENSION, null, {
          withoutEnlargement: true,
          fit: 'inside',
        });
      }

      if (metadata.height && metadata.height > this.MAX_DIMENSION) {
        processedImage = processedImage.resize(null, this.MAX_DIMENSION, {
          withoutEnlargement: true,
          fit: 'inside',
        });
      }

      // Convert to JPEG and compress
      const processedBuffer = await processedImage
        .jpeg({ quality: 85 })
        .toBuffer();

      console.log(`📸 Image processed: ${buffer.length} → ${processedBuffer.length} bytes`);

      return {
        buffer: processedBuffer,
        mimeType: 'image/jpeg',
      };
    } catch (error) {
      console.error('Error processing image:', error);
      throw new Error('Failed to process image');
    }
  }

  /**
   * Convert buffer to base64
   */
  bufferToBase64(buffer: Buffer): string {
    return buffer.toString('base64');
  }

  /**
   * Convert base64 to buffer
   */
  base64ToBuffer(base64: string): Buffer {
    return Buffer.from(base64, 'base64');
  }
}

export const imageProcessingService = new ImageProcessingService();

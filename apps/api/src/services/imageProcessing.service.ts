import sharp from 'sharp';

export class ImageProcessingService {
  private readonly MAX_FILE_SIZE = 10 * 1024 * 1024; // 10MB
  private readonly ALLOWED_FORMATS = ['jpeg', 'jpg', 'png', 'webp'];
  private readonly MAX_DIMENSION = 2048; // Max width/height

  /**
   * Validate image format and size
   */
  validateImage(buffer: Buffer, mimetype: string): void {
    // Check file size
    if (buffer.length > this.MAX_FILE_SIZE) {
      throw new Error(`Image too large. Max size is ${this.MAX_FILE_SIZE / 1024 / 1024}MB`);
    };

    // Check mimetype
    const format = mimetype.split('/')[1];
    if (!this.ALLOWED_FORMATS.includes(format)) {
      throw new Error(`Invalid image format. Allowed: ${this.ALLOWED_FORMATS.join(', ')}`);
    };
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
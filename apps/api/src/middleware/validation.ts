import { Request, Response, NextFunction } from 'express';

export function validateImageUpload(
  req: Request,
  res: Response,
  next: NextFunction
): void {
  const file = (req as any).file;

  if (!file) {
    res.status(400).json({
      success: false,
      error: 'No image file provided',
    });
    return;
  }

  // Check file size (10MB max)
  const MAX_SIZE = 10 * 1024 * 1024;
  if (file.size > MAX_SIZE) {
    res.status(400).json({
      success: false,
      error: 'File too large. Maximum size is 10MB',
    });
    return;
  }

  // Check mime type
  const allowedTypes = ['image/jpeg', 'image/jpg', 'image/png', 'image/webp'];
  if (!allowedTypes.includes(file.mimetype)) {
    res.status(400).json({
      success: false,
      error: 'Invalid file type. Allowed: JPEG, PNG, WEBP',
    });
    return;
  }

  next();
};
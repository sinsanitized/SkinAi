import { Request, Response, NextFunction } from 'express';

// Simple in-memory rate limiter
const requestCounts = new Map<string, { count: number; resetTime: number }>();

export function rateLimiter(
  req: Request,
  res: Response,
  next: NextFunction
): void {
  const ip = req.ip || req.socket.remoteAddress || 'unknown';
  const now = Date.now();
  const limit = 10; // requests per window
  const windowMs = 60 * 1000; // 1 minute

  const record = requestCounts.get(ip);

  if (!record || now > record.resetTime) {
    // New window
    requestCounts.set(ip, {
      count: 1,
      resetTime: now + windowMs,
    });
    next();
    return;
  };

  if (record.count >= limit) {
    res.status(429).json({
      success: false,
      error: 'Too many requests. Please try again later.',
    });
    return;
  };

  record.count++;
  next();
}

// Clean up old entries every 5 minutes
setInterval(() => {
  const now = Date.now();
  for (const [ip, record] of requestCounts.entries()) {
    if (now > record.resetTime) {
      requestCounts.delete(ip);
    };
  };
}, 5 * 60 * 1000);
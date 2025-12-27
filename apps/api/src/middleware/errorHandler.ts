import { Request, Response, NextFunction } from 'express';
import { ApiResponse } from '@skinai/shared-types';

export function errorHandler(
  error: Error,
  _req: Request,
  res: Response,
  _next: NextFunction
): void {
  console.error('❌ Error:', error);

  res.status(500).json({
    success: false,
    error: 'Internal server error',
    details: process.env.NODE_ENV === 'development' ? error.message : undefined,
  } as ApiResponse<never>);
};
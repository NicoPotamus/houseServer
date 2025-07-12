/**
 * This file contains helpers for TypeScript to work correctly with Express routes
 */
import { Request, Response, NextFunction, RequestHandler } from 'express';

/**
 * Helper to wrap async route handlers and catch errors
 */
export function asyncHandler(handler: (req: Request, res: Response, next?: NextFunction) => Promise<any>): RequestHandler {
  return async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      await handler(req, res, next);
    } catch (err) {
      next(err);
    }
  };
}

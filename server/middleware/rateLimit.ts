import type { NextFunction, Request, Response } from 'express';
import { AppError } from './errorHandler.ts';

interface Bucket {
  timestamps: number[];
}

const buckets = new Map<string, Bucket>();

export function clearRateLimitBuckets() {
  buckets.clear();
}

export function createRateLimiter(options: {
  windowMs: number;
  maxRequests: number;
  keyPrefix: string;
}) {
  return (req: Request, res: Response, next: NextFunction) => {
    const now = Date.now();
    const clientIp = req.ip || req.socket.remoteAddress || 'unknown';
    const key = `${options.keyPrefix}:${clientIp}`;

    const bucket = buckets.get(key) || { timestamps: [] };
    bucket.timestamps = bucket.timestamps.filter((ts) => now - ts < options.windowMs);

    if (bucket.timestamps.length >= options.maxRequests) {
      const oldest = bucket.timestamps[0] ?? now;
      const retryAfterSec = Math.max(1, Math.ceil((options.windowMs - (now - oldest)) / 1000));
      res.setHeader('Retry-After', String(retryAfterSec));
      return next(
        new AppError(
          429,
          'RATE_LIMIT_EXCEEDED',
          `Too many requests. Please wait ${retryAfterSec} seconds before trying again.`
        )
      );
    }

    bucket.timestamps.push(now);
    buckets.set(key, bucket);

    if (buckets.size > 1000) {
      for (const [entryKey, entryBucket] of buckets.entries()) {
        const latest = entryBucket.timestamps[entryBucket.timestamps.length - 1] ?? 0;
        if (now - latest >= options.windowMs) {
          buckets.delete(entryKey);
        }
      }
    }

    next();
  };
}

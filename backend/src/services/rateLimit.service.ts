import { redis } from '../config/redis';
import { config } from '../config/env';
import { prisma } from '../config/prisma';

export function getHourWindowKey(senderEmail: string, date = new Date()): string {
  const yyyy = date.getUTCFullYear();
  const mm = String(date.getUTCMonth() + 1).padStart(2, '0');
  const dd = String(date.getUTCDate()).padStart(2, '0');
  const hh = String(date.getUTCHours()).padStart(2, '0');
  return `ratelimit:${senderEmail.toLowerCase()}:${yyyy}-${mm}-${dd}-${hh}`;
}

export function getNextHourWindow(): { delayMs: number; nextDate: Date } {
  const now = new Date();
  const nextDate = new Date(
    Date.UTC(
      now.getUTCFullYear(),
      now.getUTCMonth(),
      now.getUTCDate(),
      now.getUTCHours() + 1,
      0,
      5, // 5 second buffer to guarantee entering next window
      0
    )
  );
  const delayMs = Math.max(1000, nextDate.getTime() - now.getTime());
  return { delayMs, nextDate };
}

export async function getEffectiveLimitForSender(senderEmail: string): Promise<number> {
  try {
    const senderConfig = await prisma.senderConfig.findUnique({
      where: { senderEmail: senderEmail.toLowerCase() },
    });
    if (senderConfig && senderConfig.hourlyLimit > 0) {
      return senderConfig.hourlyLimit;
    }
  } catch (err) {
    // ignore, fall back to env
  }
  return config.MAX_EMAILS_PER_HOUR_PER_SENDER || config.MAX_EMAILS_PER_HOUR || 50;
}

export interface RateLimitCheckResult {
  allowed: boolean;
  currentCount: number;
  limit: number;
  delayUntilNextWindowMs: number;
  nextWindowDate: Date;
}

/**
 * Atomically checks and increments hourly rate limit counter in Redis.
 * Safe across distributed workers.
 */
export async function checkAndIncrementRateLimit(
  senderEmail: string,
  customLimit?: number
): Promise<RateLimitCheckResult> {
  const key = getHourWindowKey(senderEmail);
  const limit = customLimit || (await getEffectiveLimitForSender(senderEmail));

  // Atomic increment
  const currentCount = await redis.incr(key);

  // Set TTL on newly created key (2 hours to ensure clean expiration)
  if (currentCount === 1) {
    await redis.expire(key, 7200);
  }

  const { delayMs, nextDate } = getNextHourWindow();

  if (currentCount > limit) {
    // Decrement counter back so unsent email is not counted
    await redis.decr(key);
    return {
      allowed: false,
      currentCount: limit,
      limit,
      delayUntilNextWindowMs: delayMs,
      nextWindowDate: nextDate,
    };
  }

  return {
    allowed: true,
    currentCount,
    limit,
    delayUntilNextWindowMs: delayMs,
    nextWindowDate: nextDate,
  };
}

/**
 * Inspect current rate limit usage for a sender without incrementing
 */
export async function getRateLimitStatus(senderEmail: string) {
  const key = getHourWindowKey(senderEmail);
  const limit = await getEffectiveLimitForSender(senderEmail);
  const countStr = await redis.get(key);
  const currentCount = countStr ? parseInt(countStr, 10) : 0;
  const { delayMs, nextDate } = getNextHourWindow();

  return {
    senderEmail,
    currentCount,
    limit,
    remaining: Math.max(0, limit - currentCount),
    isLimitReached: currentCount >= limit,
    resetInSeconds: Math.ceil(delayMs / 1000),
    nextWindowDate: nextDate,
  };
}


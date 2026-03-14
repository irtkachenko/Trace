/**
 * Rate limiter для Server Actions
 * Використовує LRU cache для зберігання кількості запитів
 */

import { LRUCache } from 'lru-cache';

type RateLimitOptions = {
  windowMs: number;
  maxRequests: number;
};

// Cache для зберігання лічильників запитів
// Key: identifier, Value: кількість запитів
const rateLimitCache = new LRUCache<string, number>({
  max: 1000, // Максимальна кількість унікальних користувачів
  ttl: 60000, // TTL 1 хвилина
});

/**
 * Перевіряє, чи не перевищено ліміт запитів
 * @param identifier - Унікальний ідентифікатор (userId, IP, etc.)
 * @param options - Налаштування rate limiting
 * @returns true якщо дозволено, false якщо ліміт перевищено
 */
export function rateLimit(identifier: string, options: RateLimitOptions): boolean {
  const now = Date.now();
  const windowStart = now - options.windowMs;

  // Отримуємо поточну кількість запитів
  const currentRequests = rateLimitCache.get(identifier) || 0;

  // Перевіряємо ліміт
  if (currentRequests >= options.maxRequests) {
    return false; // Rate limit exceeded
  }

  // Збільшуємо лічильник
  rateLimitCache.set(identifier, currentRequests + 1);

  return true;
}

/**
 * Очищує застарілі записи (викликається періодично)
 */
export function cleanupRateLimitCache(): void {
  // LRU cache автоматично очищує застарілі записи через TTL
  // Але можна викликати для ручного очищення
  rateLimitCache.purgeStale();
}

/**
 * Отримує статистику по rate limiting
 */
export function getRateLimitStats(): {
  size: number;
  maxSize: number;
} {
  return {
    size: rateLimitCache.size,
    maxSize: rateLimitCache.max,
  };
}

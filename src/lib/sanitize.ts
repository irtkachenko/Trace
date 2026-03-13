/**
 * Утиліти для санітизації вхідних даних
 * Використовуються для захисту від SQL/ILIKE-ін'єкцій та XSS
 */

/**
 * Ескейпить спеціальні символи ILIKE-патерну в PostgreSQL.
 *
 * У SQL `ILIKE` є 3 спеціальні символи:
 * - `%` — відповідає будь-якій кількості символів (аналог `*` в glob)
 * - `_` — відповідає рівно одному символу (аналог `?` в glob)
 * - `\` — escape-символ
 *
 * Якщо їх не екранувати, зловмисник може:
 * 1. Ввести `%` і отримати ВСІ записи (bypassing search limits)
 * 2. Ввести `_` для pattern-matching атак
 * 3. Ввести `\` для зламу ескейпінгу
 *
 * @param input — рядок, що потрібно обезпечити для використання в ILIKE
 * @returns — безпечний рядок з екранованими спеціальними символами
 *
 * @example
 * ```ts
 * const safe = escapeIlike("john%doe");
 * // safe === "john\\%doe"
 * query.or(`name.ilike.%${safe}%`);
 * ```
 */
export function escapeIlike(input: string): string {
  return input.replace(/[%_\\]/g, '\\$&');
}

/**
 * Санітизує текст пошукового запиту:
 * 1. Обрізає пробіли з країв
 * 2. Обмежує максимальну довжину (захист від DoS)
 * 3. Ескейпить ILIKE-спеціальні символи
 *
 * @param input — оригінальний пошуковий запит від користувача
 * @param maxLength — максимальна довжина запиту (за замовчуванням 100)
 * @returns — безпечний для використання в ILIKE рядок
 *
 * @example
 * ```ts
 * const safe = sanitizeSearchQuery("  john%doe_test  ");
 * // safe === "john\\%doe\\_test"
 * ```
 */
export function sanitizeSearchQuery(input: string, maxLength = 100): string {
  const trimmed = input.trim().slice(0, maxLength);
  return escapeIlike(trimmed);
}

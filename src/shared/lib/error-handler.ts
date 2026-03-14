/**
 * Утиліти для обробки та логування помилок
 */

import { toast } from 'sonner';
import type { AppError } from './errors';
import { createErrorFromStatus, getErrorMessage, isAppError, isOperationalError } from './errors';

// Конфігурація логування
interface ErrorLogConfig {
  enableConsoleLog: boolean;
  enableToast: boolean;
  enableRemoteLogging: boolean;
  remoteEndpoint?: string;
}

const defaultConfig: ErrorLogConfig = {
  enableConsoleLog: process.env.NODE_ENV === 'development',
  enableToast: true,
  enableRemoteLogging: process.env.NODE_ENV === 'production',
};

// Локальне сховище для помилок (для дебагінгу)
const errorHistory: Array<{
  error: AppError;
  timestamp: Date;
  context?: string;
}> = [];

// Отримання історії помилок
export function getErrorHistory() {
  return [...errorHistory];
}

// Очищення історії помилок
export function clearErrorHistory() {
  errorHistory.length = 0;
}

// Основний обробник помилок
export function handleError(
  error: unknown,
  context?: string,
  config: Partial<ErrorLogConfig> = {},
): AppError {
  const finalConfig = { ...defaultConfig, ...config };

  // Перетворюємо помилку в AppError
  let appError: AppError;

  if (isAppError(error)) {
    appError = error;
  } else if (error instanceof Error) {
    appError = createErrorFromStatus(500, error.message, 'UNKNOWN_ERROR');
  } else {
    appError = createErrorFromStatus(500, String(error), 'UNKNOWN_ERROR');
  }

  // Додаємо контекст до повідомлення
  if (context) {
    appError.message = `[${context}] ${appError.message}`;
  }

  // Логуємо в консоль (dev)
  if (finalConfig.enableConsoleLog) {
    console.group(`🚨 ${appError.name}: ${appError.code}`);
    console.error(appError);
    console.groupEnd();
  }

  // Показуємо toast користувачу
  if (finalConfig.enableToast) {
    showErrorToast(appError);
  }

  // Відправляємо на remote logging (prod)
  if (finalConfig.enableRemoteLogging && finalConfig.remoteEndpoint) {
    logErrorRemotely(appError, context).catch(console.warn);
  }

  // Зберігаємо в історію
  errorHistory.push({
    error: appError,
    timestamp: new Date(),
    context,
  });

  // Обмежуємо історію до 50 помилок
  if (errorHistory.length > 50) {
    errorHistory.shift();
  }

  return appError;
}

// Показ toast повідомлення на основі типу помилки
function showErrorToast(error: AppError) {
  const title = getToastTitle(error);
  const description = getToastDescription(error);

  if (error.isCritical) {
    toast.error(title, { description });
  } else if (error.status && error.status >= 400 && error.status < 500) {
    toast.warning(title, { description });
  } else {
    toast.error(title, { description });
  }
}

// Отримання заголовка для toast
function getToastTitle(error: AppError): string {
  switch (error.constructor.name) {
    case 'AuthError':
      return 'Помилка авторизації';
    case 'PermissionError':
      return 'Доступ заборонено';
    case 'ValidationError':
      return 'Помилка валідації';
    case 'NetworkError':
      return 'Мережева помилка';
    case 'NotFoundError':
      return 'Не знайдено';
    case 'DatabaseError':
      return 'Помилка бази даних';
    case 'ConfigError':
      return 'Помилка конфігурації';
    default:
      return 'Помилка';
  }
}

// Отримання опису для toast
function getToastDescription(error: AppError): string {
  // Для операційних помилок показуємо детальне повідомлення
  if (error.isOperational) {
    return error.message;
  }

  // Для критичних помилок показуємо загальне повідомлення
  return 'Сталася неочікувана помилка. Спробуйте ще раз.';
}

// Відправка помилки на remote logging
async function logErrorRemotely(error: AppError, context?: string) {
  try {
    const response = await fetch('/api/errors', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        error: error.toJSON(),
        context,
        userAgent: navigator.userAgent,
        timestamp: new Date().toISOString(),
        url: window.location.href,
      }),
    });

    if (!response.ok) {
      console.warn('Failed to log error remotely:', response.statusText);
    }
  } catch (remoteError) {
    console.warn('Remote logging failed:', remoteError);
  }
}

// Обробник для async функцій
export function withErrorHandling<T extends any[], R>(
  fn: (...args: T) => Promise<R>,
  context?: string,
) {
  return async (...args: T): Promise<R> => {
    try {
      return await fn(...args);
    } catch (error) {
      handleError(error, context);
      throw error; // Прокидаємо помилку далі
    }
  };
}

// Обробник для React Query
export function createQueryErrorHandler(context?: string) {
  return (error: unknown) => {
    handleError(error, context);
  };
}

// Обробник для React Error Boundary
export function createBoundaryErrorHandler(context?: string) {
  return (error: Error, errorInfo: React.ErrorInfo) => {
    const enhancedError = handleError(error, context);

    // Додаємо React Error Info
    if (process.env.NODE_ENV === 'development') {
      console.group('React Error Info');
      console.error(errorInfo);
      console.groupEnd();
    }

    return enhancedError;
  };
}

// Валідація помилки для retry логіки
export function shouldRetry(error: unknown): boolean {
  if (!isAppError(error)) {
    return false;
  }

  // Retry для мережевих помилок та серверних помилок (5xx)
  return (
    error.constructor.name === 'NetworkError' || (error.status !== undefined && error.status >= 500)
  );
}

// Отримання затримки для retry з exponential backoff
export function getRetryDelay(attemptNumber: number, error: unknown): number {
  if (!shouldRetry(error)) {
    return 0;
  }

  // Exponential backoff: 1s, 2s, 4s, 8s, 16s (max 30s)
  const delay = Math.min(1000 * 2 ** (attemptNumber - 1), 30000);

  // Додаємо jitter для уникнення thundering herd
  return delay + Math.random() * 1000;
}

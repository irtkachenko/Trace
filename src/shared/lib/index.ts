/**
 * Централізована система обробки помилок - Public API
 */

// Експортуємо утиліти для обробки помилок
export {
  clearErrorHistory,
  createBoundaryErrorHandler,
  createQueryErrorHandler,
  getErrorHistory,
  getRetryDelay,
  handleError,
  shouldRetry,
  withErrorHandling,
} from './error-handler';
// Експортуємо всі класи помилок
export {
  AppError,
  AuthError,
  ConfigError,
  createErrorFromStatus,
  DatabaseError,
  getErrorMessage,
  isAppError,
  isOperationalError,
  NetworkError,
  NotFoundError,
  PermissionError,
  ValidationError,
} from './errors';

// Типи для TypeScript
export interface ErrorLogConfig {
  enableConsoleLog: boolean;
  enableToast: boolean;
  enableRemoteLogging: boolean;
  remoteEndpoint?: string;
}

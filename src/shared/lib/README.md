# Централізована система обробки помилок

Ця система забезпечує єдиний підхід до обробки помилок у всьому додатку Trace Messenger.

## 📁 Структура

```
src/shared/lib/
├── errors.ts          # Класи помилок
├── error-handler.ts   # Утиліти обробки
├── index.ts          # Public API
└── README.md         # Документація
```

## 🚀 Швидкий старт

```typescript
import { AuthError, ValidationError, NetworkError, handleError } from '@/shared/lib';

// Створення специфічних помилок
if (!user) {
  throw new AuthError('Користувач не авторизований', 'AUTH_REQUIRED', 401);
}

if (!isValidEmail(email)) {
  throw new ValidationError('Некоректний email', 'email', 'INVALID_EMAIL', 400);
}

// Централізована обробка
try {
  await someAsyncOperation();
} catch (error) {
  handleError(error, 'UserRegistration');
}
```

## 📋 Класи помилок

### AppError (базовий клас)
```typescript
export class AppError extends Error {
  constructor(
    message: string,
    public code: string,
    public status?: number,
    public isOperational = true
  )
}
```

### Спеціалізовані класи

| Клас | Призначення | HTTP статус |
|------|-------------|-------------|
| `AuthError` | Помилки авторизації | 401 |
| `PermissionError` | Помилки доступу | 403 |
| `ValidationError` | Помилки валідації | 400 |
| `NetworkError` | Мережеві помилки | 500 |
| `NotFoundError` | Ресурс не знайдено | 404 |
| `ConfigError` | Помилки конфігурації | 500 |
| `DatabaseError` | Помилки бази даних | 500 |

## 🔧 Утиліти обробки

### handleError()
Основна функція для обробки будь-яких помилок:
```typescript
handleError(error: unknown, context?: string, config?: Partial<ErrorLogConfig>): AppError
```

**Приклад:**
```typescript
try {
  await apiCall();
} catch (error) {
  const appError = handleError(error, 'UserProfile');
  // Автоматично логується, показується toast, зберігається в історію
}
```

### withErrorHandling()
Обгортка для async функцій:
```typescript
const safeApiCall = withErrorHandling(apiCall, 'ApiService');
```

### createQueryErrorHandler()
Для TanStack Query:
```typescript
const queryClient = new QueryClient({
  mutationCache: new MutationCache({
    onError: createQueryErrorHandler('MutationHandler'),
  }),
});
```

### shouldRetry() та getRetryDelay()
Для retry логіки з exponential backoff:
```typescript
retry: (failureCount, error) => shouldRetry(error) && failureCount < 3,
retryDelay: (attemptIndex, error) => getRetryDelay(attemptIndex + 1, error),
```

## 🎯 Інтеграція з React

### Error Boundary
```typescript
import { createBoundaryErrorHandler } from '@/shared/lib';

class MyErrorBoundary extends Component {
  componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    createBoundaryErrorHandler('MyComponent')(error, errorInfo);
  }
}
```

### React Hooks
```typescript
import { handleError } from '@/shared/lib';

const useMyHook = () => {
  const [error, setError] = useState();
  
  const doSomething = async () => {
    try {
      await operation();
    } catch (err) {
      const appError = handleError(err, 'MyHook');
      setError(appError);
    }
  };
  
  return { doSomething, error };
};
```

## 📊 Конфігурація

```typescript
const config: ErrorLogConfig = {
  enableConsoleLog: true,        // Логування в консоль (dev)
  enableToast: true,             // Показ toast користувачу
  enableRemoteLogging: false,    // Відправка на сервер (prod)
  remoteEndpoint: '/api/errors', // Endpoint для remote logging
};

handleError(error, 'Context', config);
```

## 🔍 Дебагінг

### Історія помилок
```typescript
import { getErrorHistory, clearErrorHistory } from '@/shared/lib';

// Отримати всі помилки
const errors = getErrorHistory();

// Очистити історію
clearErrorHistory();
```

### Development mode
У режимі розробки:
- Детальне логування в консоль
- JSON-деталі помилок в Error Boundary
- Стек траси для дебагінгу

## 📝 Best Practices

### 1. Використовуйте специфічні класи помилок
```typescript
// ❌ Погано
throw new Error('User not found');

// ✅ Добре
throw new NotFoundError('User not found', 'user', 'USER_NOT_FOUND', 404);
```

### 2. Додавайте контекст
```typescript
// ❌ Погано
handleError(error);

// ✅ Добре
handleError(error, 'UserService.createUser');
```

### 3. Використовуйте operational flag для критичних помилок
```typescript
// Операційна помилка (очікувана)
throw new ValidationError('Invalid email', 'email', 'INVALID_EMAIL', 400);

// Критична помилка (неочікувана)
const criticalError = new AppError('Database connection failed', 'DB_ERROR', 500, false);
```

### 4. Валідуйте вхідні дані
```typescript
const validateUser = (data: unknown) => {
  const schema = z.object({
    email: z.string().email(),
    name: z.string().min(2),
  });
  
  const result = schema.safeParse(data);
  if (!result.success) {
    throw new ValidationError(
      result.error.issues[0]?.message || 'Invalid data',
      'user',
      'VALIDATION_FAILED',
      400
    );
  }
  
  return result.data;
};
```

## 🔄 Міграція з існуючого коду

### До:
```typescript
if (!user) {
  throw new Error('Unauthorized');
}

try {
  await apiCall();
} catch (err) {
  console.error('API call failed:', err);
  toast.error('Something went wrong');
}
```

### Після:
```typescript
if (!user) {
  throw new AuthError('Unauthorized', 'AUTH_REQUIRED', 401);
}

try {
  await apiCall();
} catch (err) {
  handleError(err, 'ApiService');
}
```

## 🎯 Переваги

1. **Єдина система** - всі помилки обробляються однаково
2. **Типізація** - повна TypeScript підтримка
3. **Контекст** - кожна помилка має контекст виклику
4. **Логування** - автоматичне логування та історія
5. **UX** - консистентні повідомлення для користувачів
6. **Retry логіка** - вбудована підтримка exponential backoff
7. **Debbugінг** - детальна інформація в development режимі

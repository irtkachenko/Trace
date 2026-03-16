# Trace

Веб-додаток на базі Next.js 16 та React 19. Шаблон для створення веб-проєктів з функціоналом авторизації та роботи з даними.

## Опис проєкту

Шаблон веб-додатку, який включає:
- Авторизацію через Google
- Інтерфейс для роботи з даними
- Підключення до бази даних Supabase
- Реалізацію чату в реальному часі (Realtime)

## Технології

- **Frontend:** Next.js 16, React 19, TypeScript
- **База даних:** Supabase (PostgreSQL)
- **Стилі:** Tailwind CSS 4
- **Пакетний менеджер:** PNPM

## Як запустити

### Варіант 1: Без Docker (простіший)

1. Встановіть залежності:
```bash
pnpm install
```

2. Створіть файл `.env.local` з налаштуваннями (див. нижче)

3. Запустіть проєкт:
```bash
pnpm dev
```

### Варіант 2: З Docker

1. Запустіть контейнер:
```bash
docker-compose up -d --build
```

2. Встановіть залежності в контейнері:
```bash
docker exec -it trace-app pnpm install
```

3. Зупиніть проєкт:
```bash
docker-compose down
```

## Корисні команди

| Команда | Опис |
| :--- | :--- |
| `pnpm dev` | Запуск сервера розробки |
| `pnpm build` | Збірка проєкту |
| `pnpm format` | Форматування коду |
| `pnpm lint` | Перевірка коду на помилки |

## Налаштування

Створіть файл `.env.local` у корені проєкту з такими змінними:

```env
# Supabase
NEXT_PUBLIC_SUPABASE_URL=your_supabase_url
NEXT_PUBLIC_SUPABASE_ANON_KEY=your_supabase_key

# Google OAuth (якщо потрібна авторизація через Google)
AUTH_GOOGLE_ID=your_google_client_id
AUTH_GOOGLE_SECRET=your_google_client_secret
AUTH_SECRET=your_auth_secret
NEXTAUTH_URL=http://localhost:3000
```

### Як налаштувати Google OAuth

1. Перейдіть в [Google Cloud Console](https://console.cloud.google.com/)
2. Створіть новий проєкт
3. Налаштуйте OAuth consent screen (External тип)
4. Створіть OAuth client ID для Web application
5. Додайте redirect URI: `http://localhost:3000/api/auth/callback/google`


## Міграції Supabase

### Як запустити push-міграції

1. Переконайтеся, що ваш Supabase-проєкт залінкований (або вкажіть project ref).
2. Запустіть команду:
```bash
pnpm push-migrations
```

### На замітку

Скрипт `push-migrations` спробує знайти project ref у:
1. `SUPABASE_PROJECT_REF` (env)
2. `supabase/.temp/project-ref` (після `supabase link`)
3. `.env.local` (поля `NEXT_PUBLIC_SUPABASE_URL`)

### SUPABASE_SERVICE_ROLE_KEY (server-only)

Для коректного читання конфігу Storage bucket на сервері додайте змінну:

```env
SUPABASE_SERVICE_ROLE_KEY=your-service-role-key-here
```

Важливо: цей ключ **не можна** використовувати на клієнті й **не можна** робити `NEXT_PUBLIC_`.

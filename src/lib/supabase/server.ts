import { createServerClient } from '@supabase/ssr';
import { cookies } from 'next/headers';
import { cache } from 'react';

/**
 * Створює інстанс клієнта Supabase для використання на сервері.
 * Використовує React cache для забезпечення "сінглтона" в межах одного запиту.
 */
export const createClient = cache(async () => {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
  const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;

  if (!supabaseUrl || !supabaseAnonKey) {
    throw new Error('Supabase environment variables are missing');
  }

  const cookieStore = await cookies();

  return createServerClient(supabaseUrl, supabaseAnonKey, {
    cookies: {
      getAll() {
        return cookieStore.getAll();
      },
      setAll(cookiesToSet) {
        try {
          for (const { name, value, options } of cookiesToSet) {
            cookieStore.set(name, value, options);
          }
        } catch {
          // Це виключення виникає, коли ми намагаємося встановити куки в Server Component,
          // де хедери вже відправлені. Це нормальна поведінка для Next.js App Router.
        }
      },
    },
  });
});

'use client';

import { useMutation } from '@tanstack/react-query';
import { useSupabaseAuth } from '@/components/auth/AuthProvider';
import { supabase } from '@/lib/supabase/client';

/**
 * Хук для оновлення статусу "востаннє в мережі".
 */
export function useUpdateLastSeen() {
  const { user } = useSupabaseAuth();

  return useMutation({
    mutationFn: async () => {
      if (!user) return;
      const { error } = await supabase.rpc('update_last_seen');
      if (error) throw error;
    },
    onError: (error) => {
      console.error('Помилка оновлення статусу присутності:', error);
    },
  });
}

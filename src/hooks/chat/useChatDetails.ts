'use client';

import { useQuery } from '@tanstack/react-query';
import { useSupabaseAuth } from '@/components/auth/AuthProvider';
import { supabase } from '@/lib/supabase/client';
import type { FullChat, User } from '@/types';

/**
 * Хук для отримання детальної інформації про конкретний чат.
 */
export function useChatDetails(chatId: string) {
  const { user } = useSupabaseAuth();

  return useQuery({
    queryKey: ['chat', chatId],
    queryFn: async () => {
      if (!user) throw new Error('Unauthorized');

      const { data, error } = await supabase
        .from('chats')
        .select(`
          *,
          user:user_id(*),
          recipient:recipient_id(*)
        `)
        .eq('id', chatId)
        .single();

      if (error) throw error;

      const normalizedData = data as FullChat;

      // Нормалізуємо учасників для зручності UI
      const participants = [normalizedData.user, normalizedData.recipient].filter(
        Boolean,
      ) as User[];

      return { ...normalizedData, participants } as FullChat;
    },
    enabled: !!chatId && !!user,
  });
}

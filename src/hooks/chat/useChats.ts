'use client';

import { useQuery } from '@tanstack/react-query';
import { useSupabaseAuth } from '@/components/auth/AuthProvider';
import { supabase } from '@/lib/supabase/client';
import type { FullChat } from '@/types';

/**
 * Хук для отримання списку чатів поточного користувача.
 * Реалізовано як сінглтон через React Query кеш.
 */
export function useChats() {
  const { user } = useSupabaseAuth();

  return useQuery({
    queryKey: ['chats'],
    queryFn: async () => {
      if (!user) return [];

      const { data, error } = await supabase
        .from('chats')
        .select(`
          *,
          user:user_id(*),      
          recipient:recipient_id(*),
          messages!messages_chat_id_chats_id_fk(
            id, 
            content, 
            created_at, 
            sender_id, 
            chat_id, 
            attachments
          )
        `)
        .or(`user_id.eq.${user.id},recipient_id.eq.${user.id}`)
        .order('created_at', { foreignTable: 'messages', ascending: false })
        .limit(1, { foreignTable: 'messages' });

      if (error) {
        console.error('Помилка запиту чатів:', error.message);
        throw error;
      }

      const normalizedChats = data as FullChat[];

      // Сортуємо: чати з найновішими повідомленнями зверху
      return normalizedChats.sort((a, b) => {
        const dateA = a.messages?.[0]?.created_at || a.created_at;
        const dateB = b.messages?.[0]?.created_at || b.created_at;
        return new Date(dateB).getTime() - new Date(dateA).getTime();
      });
    },
    enabled: !!user,
  });
}

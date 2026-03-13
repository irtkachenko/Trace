'use client';

import { useMutation, useQueryClient } from '@tanstack/react-query';
import { useSupabaseAuth } from '@/components/auth/AuthProvider';
import type { FullChat } from '@/types';

/**
 * Хук для відмітки повідомлень як прочитаних.
 */
export function useMarkAsRead() {
  const queryClient = useQueryClient();
  const { user } = useSupabaseAuth();

  return useMutation({
    mutationFn: async ({ chatId, messageId }: { chatId: string; messageId: string }) => {
      if (!user?.id) throw new Error('User not authenticated');

      const { markAsReadAction } = await import('@/actions/chat-actions');
      const result = await markAsReadAction(chatId, messageId);

      if (!result.success) {
        throw new Error(result.error || 'Failed to mark as read');
      }

      return result;
    },
    onMutate: async ({ chatId, messageId }) => {
      await queryClient.cancelQueries({ queryKey: ['chats'] });
      const previousChats = queryClient.getQueryData(['chats']);

      queryClient.setQueryData(['chats'], (old: FullChat[] | undefined) => {
        if (!old) return old;

        return old.map((chat) => {
          if (chat.id === chatId) {
            const isCurrentUser = chat.user_id === user?.id;
            const readField = isCurrentUser ? 'user_last_read' : 'recipient_last_read';

            return {
              ...chat,
              [readField]: {
                id: messageId,
                created_at: new Date().toISOString(),
              },
            };
          }
          return chat;
        });
      });

      return { previousChats };
    },
    onError: (_err, _variables, context) => {
      if (context?.previousChats) {
        queryClient.setQueryData(['chats'], context.previousChats);
      }
    },
    onSuccess: (_, { chatId }) => {
      queryClient.invalidateQueries({ queryKey: ['chats'] });
      queryClient.invalidateQueries({ queryKey: ['chat', chatId] });
    },
  });
}

'use client';

import { useMutation, useQueryClient } from '@tanstack/react-query';
import { useRouter } from 'next/navigation';
import { toast } from 'sonner';
import { chatsApi } from '@/api';
import { handleError } from '@/shared/lib/error-handler';
import { NetworkError } from '@/shared/lib/errors';
import type { FullChat } from '@/types';

/**
 * Хук для видалення чату.
 */
export function useDeleteChat() {
  const router = useRouter();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (chatId: string) => {
      return await chatsApi.deleteChat(chatId);
    },
    onSuccess: (chatId) => {
      queryClient.removeQueries({ queryKey: ['chat', chatId] });
      queryClient.removeQueries({ queryKey: ['messages', chatId] });

      queryClient.setQueryData(['chats'], (old: FullChat[] | undefined) => {
        if (!old) return old;
        return old.filter((chat) => chat.id !== chatId);
      });

      toast.success('Чат видалено');
      router.push('/chat');
    },
    onError: (error: Error & { status?: number }) => {
      handleError(
        new NetworkError(error.message, 'deleteChat', 'DELETE_CHAT_ERROR', error.status || 500),
        'DeleteChat',
      );
    },
  });
}

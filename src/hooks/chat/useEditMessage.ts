'use client';

import { type InfiniteData, useMutation, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { supabase } from '@/lib/supabase/client';
import { handleError } from '@/shared/lib/error-handler';
import { NetworkError } from '@/shared/lib/errors';
import type { Message } from '@/types';

/**
 * Хук для редагування повідомлення.
 */
export function useEditMessage(chatId: string) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ messageId, content }: { messageId: string; content: string }) => {
      const { data, error } = await supabase
        .from('messages')
        .update({ content, updated_at: new Date().toISOString() })
        .eq('id', messageId)
        .select('*, reply_to:reply_to_id(*)')
        .single();

      if (error)
        throw new NetworkError(
          error.message,
          'messages',
          'EDIT_MESSAGE_ERROR',
          error.status || 500,
        );
      return data;
    },
    onMutate: async (newEdit) => {
      await queryClient.cancelQueries({ queryKey: ['messages', chatId] });
      const previousData = queryClient.getQueryData(['messages', chatId]);

      queryClient.setQueryData(['messages', chatId], (old: InfiniteData<Message[]> | undefined) => {
        if (!old) return old;
        return {
          ...old,
          pages: old.pages.map((page) =>
            page.map((msg) =>
              msg.id === newEdit.messageId
                ? { ...msg, content: newEdit.content, updated_at: new Date().toISOString() }
                : msg,
            ),
          ),
        };
      });

      return { previousData };
    },
    onError: (error: Error & { status?: number }) => {
      handleError(
        new NetworkError(error.message, 'editMessage', 'EDIT_MESSAGE_ERROR', error.status || 500),
        'EditMessage',
      );
    },
    onSuccess: () => {
      toast.success('Повідомлення відредаговано');
    },
  });
}

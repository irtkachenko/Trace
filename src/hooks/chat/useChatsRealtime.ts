'use client';

import type { RealtimeChannel, User } from '@supabase/supabase-js';
import { type InfiniteData, useQueryClient } from '@tanstack/react-query';
import { useEffect, useRef } from 'react';
import { type RealtimeMessagePayload, realtimeApi, messagesApi } from '@/services';
import { handleError } from '@/shared/lib/error-handler';
import { NetworkError } from '@/shared/lib/errors';
import type { FullChat, Message } from '@/types';
import { updateChatMessageIfMatches, upsertChatLastMessage } from './chats-cache';

export function useChatsRealtime(user: User | null) {
  const queryClient = useQueryClient();
  const channelRef = useRef<RealtimeChannel | null>(null);

  useEffect(() => {
    if (!user?.id) return;

    // Cleanup existing channel first
    if (channelRef.current) {
      try {
        realtimeApi.unsubscribe(channelRef.current);
      } catch (error) {
      if (process.env.NODE_ENV === 'development') {
        console.warn('Error unsubscribing from existing channel:', error);
      }
      }
      channelRef.current = null;
    }

    const channel = realtimeApi.createMessagesChannel();
    channelRef.current = channel;

    const handleInsert = async (payload: RealtimeMessagePayload) => {
      if (!payload.new || typeof payload.new !== 'object' || !('id' in payload.new)) return;

      const nakedMessage = payload.new as Message;
      
      // 1. Helper to update cache
      const updateMessageInCache = (msg: Message) => {
        // Update chat list (last message preview)
        queryClient.setQueryData(['chats'], (old: InfiniteData<FullChat[]> | undefined) =>
          upsertChatLastMessage(old, msg.chat_id, msg),
        );

        // Update specific chat messages cache
        queryClient.setQueryData<InfiniteData<Message[]>>(
          ['messages', msg.chat_id],
          (old) => {
            if (!old) return old;

            // Check for existing message by ID or client_id (optimistic check)
            const existingPageIdx = old.pages.findIndex((page) =>
              page.some((m) => m.id === msg.id || (m.client_id && m.client_id === msg.client_id)),
            );

            if (existingPageIdx !== -1) {
              const newPages = [...old.pages];
              newPages[existingPageIdx] = newPages[existingPageIdx].map((m) => {
                if (m.id === msg.id || (m.client_id && m.client_id === msg.client_id)) {
                  // MERGE: Зберігаємо ідентичність (client_id та created_at)
                  return {
                    ...m,
                    ...msg,
                    // Гарантуємо, що client_id не затреться, бо це наш КЛЮЧ
                    client_id: m.client_id || msg.client_id,
                    created_at: m.created_at || msg.created_at,
                    id: m.id.startsWith('temp-') ? msg.id : m.id,
                    reply_details: msg.reply_details || m.reply_details,
                    reply_to: msg.reply_to || m.reply_to,
                    is_optimistic: false,
                  };
                }
                return m;
              });
              return { ...old, pages: newPages };
            }

            // Append new message
            const newPages = [...old.pages];
            const lastPageIdx = newPages.length - 1;
            newPages[lastPageIdx] = [...newPages[lastPageIdx], msg];

            return { ...old, pages: newPages };
          },
        );
      };

      // 3. Hydrate message if it's from another user or missing reply details
      const isFromMe = nakedMessage.sender_id === user?.id;
      const needsHydration = !!nakedMessage.reply_to_id && !nakedMessage.reply_to;

      // UX Optimization: If it's a message from someone else and NEEDS hydration (like a reply),
      // we DON'T show the "naked" version first to avoid the "flashing" effect 
      // where the reply block appears and disappears.
      if (!isFromMe && needsHydration) {
        try {
          const fullMessage = await messagesApi.getMessage(nakedMessage.id);
          updateMessageInCache(fullMessage);
        } catch (err) {
          console.warn('Failed to fetch hydrated message for realtime insert:', err);
          // Fallback to naked if hydration fails
          updateMessageInCache(nakedMessage);
        }
      } else {
        // Just show it immediately if it's from us or doesn't need complex data
        updateMessageInCache(nakedMessage);
      }
    };

    const handleUpdate = async (payload: RealtimeMessagePayload) => {
      if (!payload.new || typeof payload.new !== 'object' || !('id' in payload.new)) return;

      const nakedMessage = payload.new as Message;
      if (!nakedMessage?.id || !nakedMessage?.chat_id) return;

      // 1. Helper to update cache
      const updateMessageInCache = (msg: Message) => {
        const normalizedMessage = {
          ...msg,
          attachments: msg.attachments || [],
        } as Message;

        // Update chat list
        queryClient.setQueryData(['chats'], (old: InfiniteData<FullChat[]> | undefined) =>
          updateChatMessageIfMatches(
            old,
            msg.chat_id,
            (last) => last?.id === msg.id,
            (chat) => ({ ...chat, messages: [normalizedMessage] }),
          ),
        );

        // Update specific message in chat messages cache
        queryClient.setQueryData<InfiniteData<Message[]>>(
          ['messages', msg.chat_id],
          (old) => {
            if (!old) return old;
            return {
              ...old,
              pages: old.pages.map((page: Message[]) =>
                page.map((m) => {
                  if (m.id === normalizedMessage.id) {
                    return {
                      ...m,
                      ...normalizedMessage,
                      reply_details: normalizedMessage.reply_details || m.reply_details,
                      reply_to: normalizedMessage.reply_to || m.reply_to,
                    };
                  }
                  return m;
                }),
              ),
            };
          },
        );
      };

      // 2. Update with naked message immediately
      updateMessageInCache(nakedMessage);

      // 3. Hydrate message if edits might have affected content/replies
      // Usually updates don't change reply_to_id, but they change content
      try {
        const fullMessage = await messagesApi.getMessage(nakedMessage.id);
        updateMessageInCache(fullMessage);
      } catch (err) {
        console.warn('Failed to fetch hydrated message for realtime update:', err);
      }
    };

    const handleDelete = (payload: RealtimeMessagePayload) => {
      if (!payload.old || typeof payload.old !== 'object' || !('id' in payload.old)) return;

      const deletedId = payload.old.id as string;
      const deletedChatId = payload.old.chat_id as string;
      if (!deletedId || !deletedChatId) return;

      // 1. Update chat list
      queryClient.setQueryData(['chats'], (old: InfiniteData<FullChat[]> | undefined) =>
        updateChatMessageIfMatches(
          old,
          deletedChatId,
          (last) => last?.id === deletedId,
          (chat) => ({
            ...chat,
            messages: chat.messages?.filter((m) => m.id !== deletedId) || [],
          }),
        ),
      );

      // 2. Remove from messages cache
      queryClient.setQueryData<InfiniteData<Message[]>>(
        ['messages', deletedChatId],
        (old) => {
          if (!old) return old;
          return {
            ...old,
            pages: old.pages.map((page: Message[]) => page.filter((m) => m.id !== deletedId)),
          };
        },
      );
    };

    realtimeApi.subscribeToAllMessages(channel, (payload: RealtimeMessagePayload) => {
      try {
        switch (payload.eventType) {
          case 'INSERT':
            handleInsert(payload);
            break;
          case 'UPDATE':
            handleUpdate(payload);
            break;
          case 'DELETE':
            handleDelete(payload);
            break;
        }
      } catch (_error) {
        handleError(
          new NetworkError(
            'Failed to process realtime message',
            'realtime',
            'REALTIME_MESSAGE_ERROR',
            500,
          ),
          'useChatsRealtime',
        );
      }
    });

    channel.subscribe((status) => {
      if (status === 'CHANNEL_ERROR') {
        handleError(
          new NetworkError('Realtime channel error', 'realtime', 'REALTIME_CHANNEL_ERROR', 500),
          'ChatsRealtime',
          { enableToast: false },
        );
      }
    });

    channelRef.current = channel;

    return () => {
      // Add null check and error handling for cleanup
      if (channelRef.current) {
        try {
          realtimeApi.unsubscribe(channelRef.current);
        } catch (error) {
        if (process.env.NODE_ENV === 'development') {
          console.warn('Error during channel cleanup:', error);
        }
        }
        channelRef.current = null;
      }
    };
  }, [user?.id, queryClient]);
}


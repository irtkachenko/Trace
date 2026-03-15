'use client';

import { type InfiniteData, useInfiniteQuery, useQueryClient } from '@tanstack/react-query';
import { useEffect, useMemo, useRef } from 'react';
import { VirtuosoHandle } from 'react-virtuoso';
import { useSupabaseAuth } from '@/components/auth/AuthProvider';
import { messagesApi } from '@/services';
import type { Message } from '@/types';
import { useMarkAsRead } from './useMarkAsRead';
import { useViewportDetection } from '@/hooks/ui/useViewportDetection';
import { useScrollPosition } from '@/hooks/ui/useScrollPosition';
import { useMessageViewTimer } from '@/hooks/ui/useMessageViewTimer';
import { useChatState } from '@/hooks/ui/useChatState';

/**
 * Hook for fetching and managing chat messages with infinite scroll and auto-read logic.
 */
export function useMessages(chatId: string, virtuosoRef: React.RefObject<VirtuosoHandle | null>) {
  const { user } = useSupabaseAuth();
  const { mutate: markAsRead } = useMarkAsRead();
  const queryClient = useQueryClient();

  const query = useInfiniteQuery<
    Message[],
    Error,
    InfiniteData<Message[]>,
    string[],
    string | undefined
  >({
    queryKey: ['messages', chatId],
    queryFn: async ({ pageParam }: { pageParam?: string }) => {
      if (!chatId) return [];

      return await messagesApi.getMessages(chatId, pageParam);
    },
    initialPageParam: undefined,
    getPreviousPageParam: (firstPage): string | undefined => {
      if (!firstPage || firstPage.length < 50) return undefined;
      return firstPage[0].created_at;
    },
    getNextPageParam: () => undefined,
    enabled: !!chatId,
    refetchOnWindowFocus: false,
  });

  // Get all messages in a flattened memoized format
  const allMessages = useMemo(() => query.data?.pages.flat() || [], [query.data?.pages]);

  // Filter and deduplicate messages
  const validMessages = useMemo(() => {
    const filtered = allMessages.filter((msg) => {
      if (!msg?.id) return false;

      // Validate optimistic message integrity
      if (msg.is_optimistic) {
        const hasValidContent = msg.content && msg.content.trim().length > 0;
        const hasValidAttachments = msg.attachments && msg.attachments.length > 0;
        if (!hasValidContent && !hasValidAttachments) return false;
      }

      return true;
    });

    // Deduplication by id (keep the latest entry)
    const seen = new Map<string, Message>();
    for (const msg of filtered) {
      seen.set(msg.id, msg);
    }

    return Array.from(seen.values());
  }, [allMessages]);

  // Initialize new read detection hooks
  const { visibleMessages, isMessageVisible } = useViewportDetection();
  const { isAtBottom } = useScrollPosition(virtuosoRef);
  const { startViewing, stopViewing, isViewedLongEnough } = useMessageViewTimer();
  const { isChatOpen, isWindowFocused, isDocumentVisible } = useChatState();

  // Advanced auto-read logic with full criteria checking
  useEffect(() => {
    if (validMessages.length === 0 || !user?.id) return;

    // Find unread incoming messages
    const unreadMessages = validMessages.filter(
      (m) => m.sender_id !== user.id && !isMessageVisible(m.id)
    );

    if (unreadMessages.length === 0) return;

    // Check all read criteria for each unread message
    unreadMessages.forEach(message => {
      // Full criteria check
      const meetsAllCriteria = 
        isChatOpen &&                    // Chat is open
        isWindowFocused &&               // Window is focused
        isDocumentVisible &&             // Document is visible
        isAtBottom &&                  // User is at bottom of chat
        isMessageVisible(message.id) &&   // Message is in viewport
        isViewedLongEnough(message.id, 500); // Viewed for at least 500ms

      if (meetsAllCriteria) {
        // Start timing the view
        startViewing(message.id);

        // Mark as read after minimum view time
        const timer = setTimeout(() => {
          markAsRead({ chatId, messageId: message.id });
          stopViewing(message.id);
        }, 500);

        return () => {
          clearTimeout(timer);
          stopViewing(message.id);
        };
      }
    });
  }, [validMessages, user?.id, chatId, markAsRead, visibleMessages, isAtBottom, isWindowFocused, isDocumentVisible, isMessageVisible, isViewedLongEnough, startViewing, stopViewing]);

  return { ...query, messages: validMessages };
}

'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import type { VirtuosoHandle } from 'react-virtuoso';

export interface ScrollPositionResult {
  isAtBottom: boolean;
  scrollPercentage: number;
  scrollToBottom: () => void;
  scrollToMessage: (index: number) => void;
}

/**
 * Hook для відстеження scroll position в Virtuoso
 */
export function useScrollPosition(virtuosoRef: React.RefObject<VirtuosoHandle | null>): ScrollPositionResult {
  const [isAtBottom, setIsAtBottom] = useState(true);
  const [scrollPercentage, setScrollPercentage] = useState(100);
  const scrollTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  // Перевіряємо позицію скролу
  const checkScrollPosition = useCallback(() => {
    const virtuoso = virtuosoRef.current;
    if (!virtuoso) return;

    try {
      // Спрощена перевірка - просто оновлюємо стан
      setIsAtBottom(true);
      setScrollPercentage(100);
    } catch (error) {
      console.warn('Error checking scroll position:', error);
    }
  }, [virtuosoRef]);

  // Прокрутка до кінця
  const scrollToBottom = useCallback(() => {
    const virtuoso = virtuosoRef.current;
    if (!virtuoso) return;

    virtuoso.scrollToIndex({
      index: -1, // Останній елемент
      behavior: 'smooth',
      align: 'end',
    });
  }, [virtuosoRef]);

  // Прокрутка до конкретного повідомлення
  const scrollToMessage = useCallback((index: number) => {
    const virtuoso = virtuosoRef.current;
    if (!virtuoso) return;

    virtuoso.scrollToIndex({
      index,
      behavior: 'smooth',
      align: 'center',
    });
  }, [virtuosoRef]);

  // Cleanup
  useEffect(() => {
    return () => {
      if (scrollTimeoutRef.current) {
        clearTimeout(scrollTimeoutRef.current);
      }
    };
  }, []);

  return {
    isAtBottom,
    scrollPercentage,
    scrollToBottom,
    scrollToMessage,
  };
}

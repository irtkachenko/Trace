'use client';

import { useCallback, useEffect, useState } from 'react';

export interface ChatStateResult {
  isChatOpen: boolean;
  isWindowFocused: boolean;
  isDocumentVisible: boolean;
  openChat: (chatId: string) => void;
  closeChat: (chatId: string) => void;
  getCurrentChat: () => string | null;
}

/**
 * Hook для управління станом чатів (відкриті, сфокусовані)
 */
export function useChatState(): ChatStateResult {
  const [openChats, setOpenChats] = useState<Set<string>>(new Set());
  const [currentChat, setCurrentChat] = useState<string | null>(null);
  const [isWindowFocused, setIsWindowFocused] = useState(true);
  const [isDocumentVisible, setIsDocumentVisible] = useState(true);

  // Відстежуємо фокус вікна
  useEffect(() => {
    const handleFocus = () => setIsWindowFocused(true);
    const handleBlur = () => setIsWindowFocused(false);

    window.addEventListener('focus', handleFocus);
    window.addEventListener('blur', handleBlur);

    return () => {
      window.removeEventListener('focus', handleFocus);
      window.removeEventListener('blur', handleBlur);
    };
  }, []);

  // Відстежуємо видимість документа
  useEffect(() => {
    const handleVisibilityChange = () => {
      setIsDocumentVisible(document.visibilityState === 'visible');
    };

    document.addEventListener('visibilitychange', handleVisibilityChange);
    
    // Встановлюємо початковий стан
    setIsDocumentVisible(document.visibilityState === 'visible');

    return () => {
      document.removeEventListener('visibilitychange', handleVisibilityChange);
    };
  }, []);

  // Відкриваємо чат
  const openChat = useCallback((chatId: string) => {
    setOpenChats(prev => new Set(prev).add(chatId));
    setCurrentChat(chatId);
  }, []);

  // Закриваємо чат
  const closeChat = useCallback((chatId: string) => {
    setOpenChats(prev => {
      const newSet = new Set(prev);
      newSet.delete(chatId);
      return newSet;
    });
    
    if (currentChat === chatId) {
      setCurrentChat(null);
    }
  }, [currentChat]);

  // Отримуємо поточний чат
  const getCurrentChat = useCallback(() => currentChat, [currentChat]);

  // Автоматично закриваємо чати коли вікно неактивне
  useEffect(() => {
    if (!isWindowFocused || !isDocumentVisible) {
      // Закриваємо всі чати коли вікно неактивне
      setOpenChats(new Set());
      setCurrentChat(null);
    }
  }, [isWindowFocused, isDocumentVisible]);

  // Перевіряємо чи конкретний чат відкритий
  const isChatOpen = useCallback((chatId: string) => {
    return openChats.has(chatId);
  }, [openChats]);

  return {
    isChatOpen: currentChat !== null,
    isWindowFocused,
    isDocumentVisible,
    openChat,
    closeChat,
    getCurrentChat,
  };
}

'use client';

import { usePresenceStore } from '@/store/usePresenceStore';

/**
 * Хук для отримання списку онлайн-користувачів.
 */
export function usePresence() {
  const onlineUsers = usePresenceStore((state) => state.onlineUsers);
  return { onlineUsers };
}

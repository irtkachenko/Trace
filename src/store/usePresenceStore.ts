'use client';

import { create } from 'zustand';
import { supabase } from '@/lib/supabase/client';
import { queryClient } from '@/lib/query-client';
import type { User } from '@supabase/supabase-js';

interface PresenceState {
  onlineUsers: Set<string>;
  setOnlineUsers: (users: Set<string>) => void;
  connectionState: 'CONNECTED' | 'DISCONNECTED' | 'RECONNECTING';
  setConnectionState: (state: 'CONNECTED' | 'DISCONNECTED' | 'RECONNECTING') => void;
}

interface PresenceManager {
  channel: any;
  userId: string | null;
  subscribers: number;
  heartbeatInterval: NodeJS.Timeout | null;
  reconnectAttempts: number;
  maxReconnectAttempts: number;
}

// Global singleton manager for presence channel
let presenceManager: PresenceManager | null = null;

const MAX_RECONNECT_ATTEMPTS = 5;
const RECONNECT_DELAY = 2000; // 2 seconds
const HEARTBEAT_INTERVAL = 1000 * 60 * 5; // 5 minutes

function createPresenceManager(): PresenceManager {
  return {
    channel: null,
    userId: null,
    subscribers: 0,
    heartbeatInterval: null,
    reconnectAttempts: 0,
    maxReconnectAttempts: MAX_RECONNECT_ATTEMPTS,
  };
}

function updateLastSeen(): Promise<void> {
  return supabase.rpc('update_last_seen');
}

function handleVisibilityChange(): void {
  if (document.visibilityState === 'hidden') {
    updateLastSeen();
  }
}

function startHeartbeat(manager: PresenceManager): void {
  if (manager.heartbeatInterval) {
    clearInterval(manager.heartbeatInterval);
  }

  manager.heartbeatInterval = setInterval(() => {
    if (document.visibilityState === 'visible') {
      updateLastSeen();
    }
  }, HEARTBEAT_INTERVAL);
}

function stopHeartbeat(manager: PresenceManager): void {
  if (manager.heartbeatInterval) {
    clearInterval(manager.heartbeatInterval);
    manager.heartbeatInterval = null;
  }
}

function setupChannel(manager: PresenceManager, userId: string, setOnlineUsers: (users: Set<string>) => void, setConnectionState: (state: 'CONNECTED' | 'DISCONNECTED' | 'RECONNECTING') => void): void {
  manager.channel = supabase.channel('db-global-updates', {
    config: { presence: { key: userId } },
  });

  manager.channel
    .on('presence', { event: 'sync' }, () => {
      const state = manager.channel.presenceState();
      const onlineIds = new Set<string>();
      for (const key of Object.keys(state)) {
        onlineIds.add(key);
      }
      setOnlineUsers(onlineIds);
    })
    .on(
      'postgres_changes',
      { event: '*', schema: 'public', table: 'user' },
      () => {
        // Invalidate contacts queries when users change
        queryClient.invalidateQueries({ queryKey: ['contacts'], exact: false });
      },
    )
    .on(
      'postgres_changes',
      { event: '*', schema: 'public', table: 'chats' },
      () => {
        // Invalidate chats queries when chats change
        queryClient.invalidateQueries({ queryKey: ['chats'], exact: false });
      },
    )
    .subscribe(async (status: string) => {
      console.log('Presence channel status:', status);
      
      switch (status) {
        case 'SUBSCRIBED':
          setConnectionState('CONNECTED');
          manager.reconnectAttempts = 0;
          await manager.channel.track({
            user_id: userId,
            online_at: new Date().toISOString(),
          });
          startHeartbeat(manager);
          break;
          
        case 'CLOSED':
        case 'CHANNEL_ERROR':
        case 'TIMED_OUT':
          setConnectionState('DISCONNECTED');
          await updateLastSeen();
          stopHeartbeat(manager);
          
          // Attempt reconnection if we haven't exceeded max attempts
          if (manager.reconnectAttempts < manager.maxReconnectAttempts && manager.subscribers > 0) {
            manager.reconnectAttempts++;
            setConnectionState('RECONNECTING');
            
            setTimeout(() => {
              console.log(`Attempting to reconnect presence (${manager.reconnectAttempts}/${manager.maxReconnectAttempts})`);
              if (manager.channel && manager.subscribers > 0) {
                setupChannel(manager, userId, setOnlineUsers, setConnectionState);
              }
            }, RECONNECT_DELAY * manager.reconnectAttempts);
          }
          break;
      }
    });
}

export const usePresenceStore = create<PresenceState>((set) => ({
  onlineUsers: new Set(),
  setOnlineUsers: (users) => set({ onlineUsers: users }),
  connectionState: 'DISCONNECTED',
  setConnectionState: (state) => set({ connectionState: state }),
}));

// Hook for managing presence subscription with singleton pattern
export function usePresenceSubscription(user: User | null) {
  const setOnlineUsers = usePresenceStore((state) => state.setOnlineUsers);
  const setConnectionState = usePresenceStore((state) => state.setConnectionState);

  return {
    subscribe: () => {
      if (!user?.id) {
        console.warn('Cannot subscribe to presence: no user ID');
        return;
      }

      // Initialize manager if it doesn't exist
      if (!presenceManager) {
        presenceManager = createPresenceManager();
      }

      // If this is a new user, clean up the old channel
      if (presenceManager.userId && presenceManager.userId !== user.id) {
        cleanupPresence();
        presenceManager = createPresenceManager();
      }

      presenceManager.userId = user.id;
      presenceManager.subscribers++;

      // Setup channel if not already done
      if (!presenceManager.channel && presenceManager.subscribers === 1) {
        console.log('Setting up presence channel for user:', user.id);
        setupChannel(presenceManager, user.id, setOnlineUsers, setConnectionState);
        
        // Add global event listeners
        window.addEventListener('visibilitychange', handleVisibilityChange);
        window.addEventListener('beforeunload', updateLastSeen);
      }

      console.log(`Presence subscribers: ${presenceManager.subscribers}`);
    },
    
    unsubscribe: () => {
      if (!presenceManager) return;

      presenceManager.subscribers--;
      console.log(`Presence subscribers: ${presenceManager.subscribers}`);

      // Cleanup when no more subscribers
      if (presenceManager.subscribers <= 0) {
        cleanupPresence();
      }
    },
    
    getConnectionState: () => {
      return usePresenceStore.getState().connectionState;
    },
  };
}

// Global cleanup function
function cleanupPresence(): void {
  if (!presenceManager) return;

  console.log('Cleaning up presence channel');
  
  // Update last seen before disconnecting
  updateLastSeen();
  
  // Stop heartbeat
  stopHeartbeat(presenceManager);
  
  // Remove channel
  if (presenceManager.channel) {
    supabase.removeChannel(presenceManager.channel);
    presenceManager.channel = null;
  }
  
  // Remove global event listeners
  window.removeEventListener('visibilitychange', handleVisibilityChange);
  window.removeEventListener('beforeunload', updateLastSeen);
  
  // Reset manager
  presenceManager = null;
  
  // Update store state
  usePresenceStore.getState().setConnectionState('DISCONNECTED');
}

// Export cleanup function for manual cleanup if needed
export { cleanupPresence };

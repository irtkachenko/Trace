'use client';

import { useEffect } from 'react';
import { cleanupPresence } from '@/store/usePresenceStore';

interface GlobalCleanupProps {
  children: React.ReactNode;
}

export default function GlobalCleanup({ children }: GlobalCleanupProps) {
  useEffect(() => {
    // Cleanup on page unload
    const handleBeforeUnload = () => {
      cleanupPresence();
    };

    // Cleanup on visibility change to hidden
    const handleVisibilityChange = () => {
      if (document.visibilityState === 'hidden') {
        cleanupPresence();
      }
    };

    window.addEventListener('beforeunload', handleBeforeUnload);
    window.addEventListener('visibilitychange', handleVisibilityChange);

    return () => {
      // Cleanup on component unmount
      cleanupPresence();
      window.removeEventListener('beforeunload', handleBeforeUnload);
      window.removeEventListener('visibilitychange', handleVisibilityChange);
    };
  }, []);

  return <>{children}</>;
}

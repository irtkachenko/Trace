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

    window.addEventListener('beforeunload', handleBeforeUnload);

    return () => {
      // Cleanup on component unmount
      cleanupPresence();
      window.removeEventListener('beforeunload', handleBeforeUnload);
    };
  }, []);

  return <>{children}</>;
}

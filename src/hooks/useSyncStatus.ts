'use client';

import { useState, useEffect, useCallback } from 'react';
import { syncService, SyncState } from '@/lib/syncService';
import { isSupabaseConfigured } from '@/lib/supabase';

export function useSyncStatus() {
  const [syncState, setSyncState] = useState<{
    status: SyncState;
    lastSyncTime: number | null;
    errorMessage?: string;
  }>(syncService.getStatus());

  const [isConfigured, setIsConfigured] = useState<boolean>(false);

  useEffect(() => {
    setIsConfigured(isSupabaseConfigured());

    const unsubscribe = syncService.subscribe((state) => {
      setSyncState(state);
      setIsConfigured(isSupabaseConfigured());
    });

    // Tự động kiểm tra và đồng bộ khi mở trang nếu đã cấu hình Supabase
    if (isSupabaseConfigured()) {
      syncService.triggerSync(1200);
    }

    return () => {
      unsubscribe();
    };
  }, []);

  const triggerSync = useCallback((delayMs?: number) => {
    syncService.triggerSync(delayMs);
  }, []);

  const runFullSync = useCallback(async () => {
    return await syncService.runFullSync();
  }, []);

  return {
    status: syncState.status,
    lastSyncTime: syncState.lastSyncTime,
    errorMessage: syncState.errorMessage,
    isConfigured,
    triggerSync,
    runFullSync,
  };
}

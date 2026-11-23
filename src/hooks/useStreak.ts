'use client';

import { useState, useEffect, useCallback } from 'react';
import { getStreakData, StreakData } from '@/lib/heatmapService';

export function useStreak() {
  const [streak, setStreak] = useState<StreakData>({
    currentStreak: 0,
    longestStreak: 0,
    learnedToday: false,
    todayCount: 0,
  });
  const [loading, setLoading] = useState(true);

  const refresh = useCallback(async () => {
    try {
      const data = await getStreakData();
      setStreak(data);
    } catch (e) {
      console.warn('Lỗi cập nhật streak:', e);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    refresh();

    const handleUpdate = () => {
      refresh();
    };

    window.addEventListener('lyngo_streak_updated', handleUpdate);
    window.addEventListener('storage', handleUpdate);

    return () => {
      window.removeEventListener('lyngo_streak_updated', handleUpdate);
      window.removeEventListener('storage', handleUpdate);
    };
  }, [refresh]);

  return { ...streak, loading, refresh };
}

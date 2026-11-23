'use client';

import React, { useState, useRef, useEffect } from 'react';
import Link from 'next/link';
import { Flame, Trophy, Sparkles, ArrowRight } from 'lucide-react';
import { useStreak } from '@/hooks/useStreak';

interface StreakBadgeProps {
  variant?: 'navbar' | 'banner' | 'card';
  className?: string;
}

export default function StreakBadge({ variant = 'navbar', className = '' }: StreakBadgeProps) {
  const { currentStreak, longestStreak, learnedToday, todayCount, loading } = useStreak();
  const [showTooltip, setShowTooltip] = useState(false);
  const badgeRef = useRef<HTMLDivElement>(null);

  // Đóng tooltip khi bấm ra ngoài
  useEffect(() => {
    if (!showTooltip) return;
    const handleOutside = (e: MouseEvent | TouchEvent) => {
      if (badgeRef.current && !badgeRef.current.contains(e.target as Node)) {
        setShowTooltip(false);
      }
    };
    document.addEventListener('mousedown', handleOutside, true);
    return () => document.removeEventListener('mousedown', handleOutside, true);
  }, [showTooltip]);

  const hasStreak = currentStreak > 0;

  // 1. DẠNG NAVBAR: Nổi bật ngay trên thanh điều hướng toàn trang
  if (variant === 'navbar') {
    return (
      <div ref={badgeRef} className={`relative shrink-0 ${className}`}>
        <button
          type="button"
          onClick={() => setShowTooltip(!showTooltip)}
          title={`Chuỗi học tập: ${currentStreak} ngày liên tiếp (Kỷ lục: ${longestStreak} ngày)`}
          className={`px-2.5 sm:px-3 py-1.5 rounded-2xl border-2 flex items-center gap-1 sm:gap-1.5 font-black text-xs transition-all shadow-2xs press-spring cursor-pointer select-none ${
            hasStreak
              ? learnedToday
                ? 'bg-gradient-to-r from-amber-400/20 via-orange-500/20 to-amber-500/20 border-orange-400 text-orange-950 hover:border-orange-500 hover:scale-105'
                : 'bg-orange-50 border-orange-300 text-orange-900 hover:border-orange-400 hover:bg-orange-100/80'
              : 'bg-stone-50 border-stone-200 text-stone-600 hover:bg-stone-100 hover:border-stone-300'
          }`}
        >
          <span
            className={`text-base leading-none transition-transform ${
              hasStreak ? 'animate-bounce-slow text-orange-600 drop-shadow-xs' : 'grayscale opacity-60'
            }`}
          >
            🔥
          </span>

          <span className="font-sans font-black text-xs sm:text-sm text-orange-950 leading-none">
            {loading ? '...' : currentStreak}
          </span>

          <span className="text-[11px] font-bold text-orange-800 hidden lg:inline leading-none">
            ngày
          </span>

          {/* Dấu chấm xanh nhỏ báo hiệu hôm nay đã học */}
          {learnedToday && (
            <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 ring-2 ring-emerald-200 shrink-0" title="Đã học hôm nay" />
          )}
        </button>

        {/* Popover chi tiết Streak khi bấm vào */}
        {showTooltip && (
          <div className="absolute right-0 top-full mt-2.5 z-50 w-64 p-3.5 bg-[#fffdfa] rounded-3xl border-2 border-orange-300 shadow-modal backdrop-blur-md animate-in fade-in zoom-in-95 duration-150 text-slate-900 space-y-2.5">
            <div className="flex items-center justify-between pb-2 border-b border-orange-100">
              <span className="text-xs font-black text-orange-950 flex items-center gap-1.5">
                <Flame className="w-4 h-4 text-orange-600 fill-orange-500" />
                Chuỗi Học Tập (Streak)
              </span>
              <span className="text-[11px] font-mono font-black text-orange-800 bg-orange-100 px-2 py-0.5 rounded-lg border border-orange-200">
                {currentStreak} ngày 🔥
              </span>
            </div>

            <div className="space-y-1.5 text-xs text-slate-700">
              <div className="flex items-center justify-between py-1 px-2 rounded-xl bg-orange-50/70">
                <span className="flex items-center gap-1 text-orange-900 font-medium">
                  <Flame className="w-3.5 h-3.5 text-orange-500" /> Chuỗi hiện tại:
                </span>
                <span className="font-extrabold text-orange-950">{currentStreak} ngày</span>
              </div>

              <div className="flex items-center justify-between py-1 px-2 rounded-xl bg-amber-50/70">
                <span className="flex items-center gap-1 text-amber-900 font-medium">
                  <Trophy className="w-3.5 h-3.5 text-amber-500" /> Kỷ lục dài nhất:
                </span>
                <span className="font-extrabold text-amber-950">{longestStreak} ngày</span>
              </div>
            </div>

            {/* Trạng thái hôm nay */}
            <div className={`p-2 rounded-2xl text-[11px] font-medium leading-relaxed border ${
              learnedToday
                ? 'bg-emerald-50 border-emerald-200 text-emerald-900'
                : 'bg-amber-50 border-amber-200 text-amber-900'
            }`}>
              {learnedToday ? (
                <p className="flex items-center gap-1 font-bold text-emerald-800">
                  <span>✨</span> Hôm nay cô Ly đã ôn {todayCount > 0 ? `${todayCount} thẻ` : 'bài'} để giữ lửa!
                </p>
              ) : (
                <p className="flex items-center gap-1">
                  <span>⏰</span> Hôm nay cô Ly chưa ôn bài, hãy ôn 1 thẻ để giữ lửa nhé meow~
                </p>
              )}
            </div>

            <Link
              href="/review"
              onClick={() => setShowTooltip(false)}
              className="w-full flex items-center justify-center gap-1.5 py-2 px-3 rounded-xl bg-gradient-to-r from-orange-500 to-amber-500 text-white font-black text-xs shadow-sm hover:from-orange-600 hover:to-amber-600 transition-all active:scale-95"
            >
              <span>Vào ôn tập Anki 🐾</span>
              <ArrowRight className="w-3.5 h-3.5" />
            </Link>
          </div>
        )}
      </div>
    );
  }

  // 2. DẠNG BANNER: Hiển thị lớn, bắt mắt ở trang chủ (Home) hoặc trang ôn tập (Review)
  return (
    <div
      className={`rounded-3xl p-4 sm:p-5 border-2 border-orange-200 bg-gradient-to-r from-amber-50/90 via-orange-50/70 to-amber-50/90 shadow-sm flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 select-none ${className}`}
    >
      <div className="flex items-center gap-3.5">
        <div className="relative p-3 rounded-2xl bg-gradient-to-br from-orange-500 to-amber-500 text-white shadow-md shadow-orange-500/25 shrink-0">
          <Flame className="w-7 h-7 fill-amber-200 text-white animate-bounce-slow" />
          <span className="absolute -top-1 -right-1 text-xs">✨</span>
        </div>

        <div className="space-y-0.5">
          <div className="flex items-center gap-2 flex-wrap">
            <h3 className="font-serif font-black text-lg sm:text-xl text-orange-950 flex items-center gap-1.5">
              <span>Chuỗi Học Tập:</span>
              <span className="text-orange-600 font-sans">{currentStreak} Ngày Liên Tiếp 🔥</span>
            </h3>
            {learnedToday && (
              <span className="px-2 py-0.5 rounded-full text-[10px] font-black uppercase tracking-wider bg-emerald-100 text-emerald-800 border border-emerald-300 flex items-center gap-0.5">
                <span>✓</span> Đã giữ lửa hôm nay
              </span>
            )}
          </div>

          <p className="text-xs text-orange-900/80 font-medium">
            {learnedToday
              ? 'Tuyệt vời meow! Ngọn lửa học tập của Cô Ly đang rực sáng. Kỷ lục cao nhất: ' + longestStreak + ' ngày!'
              : 'Hãy hoàn thành 1 bài ôn tập hôm nay để duy trì chuỗi học tập và đạt kỷ lục mới meow~'}
          </p>
        </div>
      </div>

      <div className="flex items-center gap-2.5 w-full sm:w-auto shrink-0">
        <div className="px-3 py-1.5 rounded-2xl bg-white/80 border border-orange-200 text-center shrink-0">
          <span className="text-[10px] text-orange-700 font-bold block uppercase tracking-wider">Kỷ lục cao nhất</span>
          <span className="text-xs font-black text-orange-950 flex items-center justify-center gap-1">
            <Trophy className="w-3.5 h-3.5 text-amber-500" /> {longestStreak} ngày
          </span>
        </div>

        <Link
          href="/review"
          className="flex-1 sm:flex-none px-4 py-2 rounded-2xl bg-gradient-to-r from-orange-500 to-amber-500 hover:from-orange-600 hover:to-amber-600 text-white font-black text-xs shadow-md shadow-orange-500/20 flex items-center justify-center gap-1.5 transition-all active:scale-95 cursor-pointer"
        >
          <Sparkles className="w-3.5 h-3.5" />
          <span>Ôn tập ngay 🐾</span>
        </Link>
      </div>
    </div>
  );
}

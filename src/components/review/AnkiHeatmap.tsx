'use client';

import React, { useState, useEffect, useCallback } from 'react';
import {
  ChevronLeft,
  ChevronRight,
  Circle,
  SlidersHorizontal,
  Heart
} from 'lucide-react';
import { getHeatmapStats, HeatmapStats, HeatmapDay } from '@/lib/heatmapService';

interface AnkiHeatmapProps {
  onRefreshNeeded?: () => void;
  className?: string;
  defaultTheme?: 'meo-cam' | 'dark-anki' | 'classic-anki';
}

type ColorTheme = 'meo-cam' | 'dark-anki' | 'classic-anki';

const THEME_STORAGE_KEY = 'lyngo_heatmap_theme';

export default function AnkiHeatmap({ className = '', defaultTheme = 'meo-cam' }: AnkiHeatmapProps) {
  const currentYear = new Date().getFullYear();
  const [selectedYear, setSelectedYear] = useState<number>(currentYear);
  const [stats, setStats] = useState<HeatmapStats | null>(null);
  const [colorTheme, setColorTheme] = useState<ColorTheme>(defaultTheme);
  const [hoveredDay, setHoveredDay] = useState<{ day: HeatmapDay; x: number; y: number } | null>(null);

  // Đọc theme đã lưu từ localStorage để luôn duy trì màu cam khi F5 hoặc đổi trang
  useEffect(() => {
    try {
      const savedTheme = localStorage.getItem(THEME_STORAGE_KEY) as ColorTheme | null;
      if (savedTheme && (savedTheme === 'meo-cam' || savedTheme === 'dark-anki' || savedTheme === 'classic-anki')) {
        setColorTheme(savedTheme);
      }
    } catch (e) {
      console.warn('Lỗi đọc theme từ localStorage:', e);
    }
  }, []);

  // Chuyển đổi và lưu vĩnh viễn theme được chọn
  const handleToggleTheme = () => {
    setColorTheme((prev) => {
      let next: ColorTheme = 'meo-cam';
      if (prev === 'meo-cam') next = 'dark-anki';
      else if (prev === 'dark-anki') next = 'classic-anki';
      else next = 'meo-cam';

      try {
        localStorage.setItem(THEME_STORAGE_KEY, next);
      } catch (e) {
        console.warn('Lỗi ghi theme vào localStorage:', e);
      }
      return next;
    });
  };

  const loadStats = useCallback(async () => {
    // Tải dữ liệu ôn tập thực tế 100% của Cô Ly (từ log ôn tập + từ vựng hiện có)
    const data = await getHeatmapStats(selectedYear);
    setStats(data);
  }, [selectedYear]);

  useEffect(() => {
    loadStats();
  }, [loadStats]);

  const isDark = colorTheme === 'dark-anki';

  const getColorClass = (level: 0 | 1 | 2 | 3 | 4) => {
    if (colorTheme === 'meo-cam') {
      // Mèo Cam Warm Palette
      switch (level) {
        case 0:
          return 'bg-orange-100/50 hover:bg-orange-200/70 border border-orange-200/40';
        case 1:
          return 'bg-amber-200 hover:bg-amber-300';
        case 2:
          return 'bg-orange-400 hover:bg-orange-500';
        case 3:
          return 'bg-orange-500 hover:bg-orange-600';
        case 4:
          return 'bg-amber-500 hover:bg-amber-600';
      }
    } else if (colorTheme === 'classic-anki') {
      // Light Anki Green
      switch (level) {
        case 0:
          return 'bg-slate-100 hover:bg-slate-200 border border-slate-200/60';
        case 1:
          return 'bg-emerald-200 hover:bg-emerald-300';
        case 2:
          return 'bg-emerald-400 hover:bg-emerald-500';
        case 3:
          return 'bg-emerald-600 hover:bg-emerald-700';
        case 4:
          return 'bg-emerald-800 hover:bg-emerald-900';
      }
    } else {
      // Chuẩn 100% Dark Anki Heatmap (Image 1 Benchmark)
      switch (level) {
        case 0:
          return 'bg-[#33373d] hover:bg-[#3d424a]';
        case 1:
          return 'bg-[#558b2f] hover:bg-[#689f38]';
        case 2:
          return 'bg-[#7cb342] hover:bg-[#8bc34a]';
        case 3:
          return 'bg-[#8bc34a] hover:bg-[#9ccc65]';
        case 4:
          return 'bg-[#aed581] hover:bg-[#c5e1a5]';
      }
    }
  };

  return (
    <div
      className={`rounded-2xl p-4 sm:p-5 transition-colors duration-200 space-y-3 select-none relative font-sans ${
        isDark
          ? 'bg-[#2b2d30] text-zinc-200 shadow-xl border border-zinc-700/50'
          : colorTheme === 'meo-cam'
          ? 'bg-[#fffdfa] text-orange-950 border-2 border-orange-200/90 shadow-card'
          : 'bg-white text-slate-900 border border-slate-200 shadow-md'
      } ${className}`}
    >
      {/* 1. Header & Navigation (Chuẩn Anki: Trái < O >, Phải: Sliders + Heart, Ở giữa trống) */}
      <div className="flex items-center justify-between pb-1">
        {/* Nhóm điều hướng năm: < O > */}
        <div
          className={`flex items-center gap-0.5 p-0.5 rounded-lg border ${
            isDark
              ? 'bg-[#383b40] border-zinc-600/70 text-zinc-300'
              : 'bg-orange-100/70 border-orange-200/80 text-orange-950'
          }`}
        >
          <button
            type="button"
            onClick={() => setSelectedYear((prev) => prev - 1)}
            title="Năm trước"
            className="p-1 rounded-md hover:bg-white/10 transition-colors cursor-pointer"
          >
            <ChevronLeft className="w-3.5 h-3.5" />
          </button>
          <button
            type="button"
            onClick={() => setSelectedYear(currentYear)}
            title="Về năm hiện tại"
            className="p-1 rounded-md hover:bg-white/10 transition-colors cursor-pointer"
          >
            <Circle className="w-2.5 h-2.5 fill-current opacity-80" />
          </button>
          <button
            type="button"
            onClick={() => setSelectedYear((prev) => prev + 1)}
            title="Năm sau"
            className="p-1 rounded-md hover:bg-white/10 transition-colors cursor-pointer"
          >
            <ChevronRight className="w-3.5 h-3.5" />
          </button>
        </div>

        {/* Nút Phải: Sliders (Đổi Theme) + Heart (Yêu thích) */}
        <div className="flex items-center gap-1.5">
          <button
            type="button"
            onClick={handleToggleTheme}
            title={`Đang hiển thị: ${
              colorTheme === 'meo-cam'
                ? 'Tone Mèo Cam (Đã lưu) 🐾'
                : colorTheme === 'dark-anki'
                ? 'Anki Dark Chuẩn (Đã lưu) 🌙'
                : 'Anki Classic Sáng (Đã lưu) 🌿'
            }. Bấm để đổi chủ đề!`}
            className={`p-1.5 rounded-lg border transition-all cursor-pointer ${
              isDark
                ? 'bg-[#383b40] hover:bg-[#43474e] border-zinc-600/70 text-zinc-300'
                : 'bg-orange-100/70 hover:bg-orange-200 border-orange-200 text-orange-900'
            }`}
          >
            <SlidersHorizontal className="w-3.5 h-3.5" />
          </button>

          <button
            type="button"
            title="LyngoCat Streak System 🐾"
            className={`p-1.5 rounded-lg border transition-all cursor-pointer ${
              isDark
                ? 'bg-[#2a384c] border-sky-800/60 text-sky-400 hover:bg-[#32435b]'
                : 'bg-rose-100/70 hover:bg-rose-200 border-rose-200 text-rose-600'
            }`}
          >
            <Heart className="w-3.5 h-3.5 fill-current" />
          </button>
        </div>
      </div>

      {/* 2. Ma Trận Heatmap 53 tuần x 7 ngày (Không thanh cuộn cam, tự động căn giữa) */}
      <div className="overflow-x-auto no-scrollbar pb-1">
        <div className="w-max mx-auto space-y-1.5">
          {/* Lưới 7 ngày x 53 tuần */}
          <div className="flex gap-[3px]">
            {stats?.weeks.map((week) => (
              <div key={week.weekIndex} className="flex flex-col gap-[3px]">
                {week.days.map((day, dIdx) => {
                  if (!day) {
                    return <div key={dIdx} className="w-[11px] h-[11px] opacity-0" />;
                  }

                  const colorClass = getColorClass(day.level);
                  const isTodayClass = day.isToday
                    ? isDark
                      ? 'border border-black ring-1 ring-zinc-400 z-10'
                      : 'border border-black ring-1 ring-orange-500 z-10'
                    : '';

                  return (
                    <div
                      key={day.dateStr}
                      onMouseEnter={(e) => {
                        const rect = e.currentTarget.getBoundingClientRect();
                        setHoveredDay({
                          day,
                          x: rect.left + rect.width / 2,
                          y: rect.top,
                        });
                      }}
                      onMouseLeave={() => setHoveredDay(null)}
                      className={`w-[11px] h-[11px] rounded-[1.5px] transition-all cursor-pointer ${colorClass} ${isTodayClass}`}
                    />
                  );
                })}
              </div>
            ))}
          </div>

          {/* Năm hiển thị ở giữa dưới biểu đồ */}
          <div
            className={`text-center text-xs font-mono pt-0.5 ${
              isDark ? 'text-zinc-500' : 'text-orange-800/60'
            }`}
          >
            {selectedYear}
          </div>
        </div>
      </div>

      {/* Tooltip khi di chuột qua ô */}
      {hoveredDay && (
        <div
          style={{
            left: `${hoveredDay.x}px`,
            top: `${hoveredDay.y - 8}px`,
            transform: 'translate(-50%, -100%)',
          }}
          className={`fixed z-50 pointer-events-none px-3 py-1.5 rounded-lg border shadow-xl text-xs font-sans space-y-0.5 animate-in fade-in zoom-in-95 duration-100 ${
            isDark
              ? 'bg-zinc-900/95 border-zinc-700 text-white'
              : 'bg-orange-950/95 border-orange-800 text-white'
          }`}
        >
          <p className="font-bold text-[11px] text-amber-300 flex items-center gap-1">
            <span>🐾</span>
            <span>
              {hoveredDay.day.date.toLocaleDateString('vi-VN', {
                weekday: 'short',
                year: 'numeric',
                month: 'numeric',
                day: 'numeric',
              })}
            </span>
          </p>
          <p className="text-[11px] text-zinc-100">
            {hoveredDay.day.count > 0 ? (
              <span>
                Đã ôn <b>{hoveredDay.day.count} thẻ</b> từ vựng ✨
              </span>
            ) : (
              <span className="text-zinc-400 italic">Chưa có lượt ôn nào</span>
            )}
          </p>
        </div>
      )}

      {/* 3. Dòng Thống Kê Chuẩn 100% Anki Heatmap (1 hàng duy nhất: Daily average, Days learned, Longest streak, Current streak) */}
      <div
        className={`pt-2.5 flex items-center justify-between gap-2 text-xs sm:text-sm font-bold tracking-tight select-text ${
          isDark ? 'border-t border-zinc-700/40 text-white' : 'border-t border-orange-200/80 text-orange-950'
        }`}
      >
        <div className="flex items-center gap-1 whitespace-nowrap">
          <span>Daily average:</span>
          <span className={`font-black ${isDark ? 'text-[#55a630]' : 'text-orange-600'}`}>
            {stats?.dailyAverage ?? 0} cards
          </span>
        </div>

        <div className="flex items-center gap-1 whitespace-nowrap">
          <span>Days learned:</span>
          <span className={`font-black ${isDark ? 'text-[#55a630]' : 'text-amber-600'}`}>
            {stats?.daysLearnedPercent ?? 0}%
          </span>
        </div>

        <div className="flex items-center gap-1 whitespace-nowrap">
          <span>Longest streak:</span>
          <span className={`font-black ${isDark ? 'text-[#55a630]' : 'text-orange-600'}`}>
            {stats?.longestStreak ?? 0} days
          </span>
        </div>

        <div className="flex items-center gap-1 whitespace-nowrap">
          <span>Current streak:</span>
          <span className={`font-black ${isDark ? 'text-[#55a630]' : 'text-amber-600'}`}>
            {stats?.currentStreak ?? 0} {stats?.currentStreak === 1 ? 'day' : 'days'}
          </span>
        </div>
      </div>
    </div>
  );
}

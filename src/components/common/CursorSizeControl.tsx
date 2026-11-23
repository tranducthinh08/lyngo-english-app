'use client';

import React, { useState, useEffect } from 'react';
import { MousePointer2, Sparkles, X } from 'lucide-react';
import { getCursorSize, setCursorSize, MIN_CURSOR_SIZE, MAX_CURSOR_SIZE } from '@/lib/settings';

const PRESET_SIZES = [
  { size: 24, label: 'Nhỏ', icon: '🐾' },
  { size: 32, label: 'Vừa', icon: '🐱', isDefault: true },
  { size: 40, label: 'To', icon: '🐈' },
  { size: 48, label: 'Siêu to', icon: '🦁' },
];

interface CursorSizeControlProps {
  variant?: 'modal' | 'compact';
  onClose?: () => void;
}

export default function CursorSizeControl({ variant = 'modal', onClose }: CursorSizeControlProps) {
  const [size, setSize] = useState<number>(32);

  useEffect(() => {
    setSize(getCursorSize());

    const handleSizeChange = (e: Event) => {
      const customEvent = e as CustomEvent<number>;
      if (typeof customEvent.detail === 'number') {
        setSize(customEvent.detail);
      } else {
        setSize(getCursorSize());
      }
    };

    window.addEventListener('lyngo_cursor_size_change', handleSizeChange);
    return () => window.removeEventListener('lyngo_cursor_size_change', handleSizeChange);
  }, []);

  const handleChange = (newSize: number) => {
    setSize(newSize);
    setCursorSize(newSize);
  };

  const getLabel = (s: number) => {
    if (s <= 24) return 'Nhỏ 🐾';
    if (s <= 32) return 'Vừa 🐱';
    if (s <= 40) return 'To 🐈';
    return 'Siêu to 🦁';
  };

  // Giao diện Compact dành cho menu nhanh trên Navbar
  if (variant === 'compact') {
    return (
      <div className="w-64 p-3.5 bg-[#fffdfa] rounded-3xl border-2 border-orange-200 shadow-modal backdrop-blur-md animate-in fade-in zoom-in-95 duration-150 text-slate-900 space-y-3">
        <div className="flex items-center justify-between pb-2 border-b border-orange-100">
          <span className="text-xs font-black text-orange-950 flex items-center gap-1.5">
            <MousePointer2 className="w-3.5 h-3.5 text-orange-600" />
            Cỡ con trỏ chuột Mèo
          </span>
          <div className="flex items-center gap-1.5">
            <span className="text-[11px] font-mono font-black text-orange-800 bg-orange-100 px-2 py-0.5 rounded-lg border border-orange-200">
              {size}px
            </span>
            {onClose && (
              <button
                type="button"
                onClick={onClose}
                className="p-1 rounded-full text-slate-400 hover:text-slate-700 hover:bg-orange-100 transition-colors"
                title="Đóng menu"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            )}
          </div>
        </div>

        {/* Thanh trượt Slider */}
        <div className="space-y-1">
          <div className="flex items-center justify-between text-[10px] font-bold text-orange-700">
            <span>20px (Nhỏ)</span>
            <span className="font-extrabold text-orange-900">{getLabel(size)}</span>
            <span>48px (To)</span>
          </div>
          <input
            type="range"
            min={MIN_CURSOR_SIZE}
            max={MAX_CURSOR_SIZE}
            step={4}
            value={size}
            onChange={(e) => handleChange(parseInt(e.target.value, 10))}
            className="w-full accent-orange-500 cursor-pointer h-1.5 bg-orange-200 rounded-lg"
          />
        </div>

        {/* 4 Nút chọn nhanh */}
        <div className="grid grid-cols-4 gap-1.5 pt-1">
          {PRESET_SIZES.map((preset) => (
            <button
              key={preset.size}
              type="button"
              onClick={() => handleChange(preset.size)}
              className={`py-1.5 px-1 rounded-xl text-[11px] font-black border transition-all flex flex-col items-center gap-0.5 active:scale-95 cursor-pointer ${
                size === preset.size
                  ? 'bg-orange-500 text-white border-orange-600 shadow-sm'
                  : 'bg-white text-orange-900 border-orange-200 hover:bg-orange-100/70'
              }`}
            >
              <span className="text-xs">{preset.icon}</span>
              <span>{preset.size}px</span>
            </button>
          ))}
        </div>

        {/* Dòng hướng dẫn */}
        <p className="text-[10px] text-orange-800/80 text-center font-medium pt-1 border-t border-orange-100">
          🐾 Con trỏ thay đổi kích thước ngay lập tức!
        </p>
      </div>
    );
  }

  // Giao diện Modal đầy đủ trong SettingsModal
  return (
    <div className="space-y-3.5">
      <div className="flex items-center justify-between">
        <label className="text-sm font-bold text-orange-950 flex items-center gap-1.5">
          <MousePointer2 className="w-4 h-4 text-orange-600" />
          Kích thước con trỏ chuột Mèo Con:
        </label>
        <span className="text-xs font-black text-orange-800 bg-orange-100 px-3 py-1 rounded-xl border border-orange-200">
          {size}px • {getLabel(size)}
        </span>
      </div>

      {/* Thanh kéo Slider */}
      <div className="flex items-center gap-3">
        <span className="text-xs font-bold text-orange-700 shrink-0">20px</span>
        <input
          type="range"
          min={MIN_CURSOR_SIZE}
          max={MAX_CURSOR_SIZE}
          step={4}
          value={size}
          onChange={(e) => handleChange(parseInt(e.target.value, 10))}
          className="w-full accent-orange-500 cursor-pointer h-2 bg-orange-200 rounded-lg"
        />
        <span className="text-xs font-bold text-orange-700 shrink-0">48px</span>
      </div>

      {/* 4 Mốc Kích Thước Định Sẵn */}
      <div className="grid grid-cols-4 gap-2">
        {PRESET_SIZES.map((preset) => (
          <button
            key={preset.size}
            type="button"
            onClick={() => handleChange(preset.size)}
            className={`py-2 px-1 rounded-2xl text-xs font-extrabold border-2 transition-all flex flex-col items-center gap-0.5 active:scale-95 cursor-pointer ${
              size === preset.size
                ? 'bg-orange-500 text-white border-orange-600 shadow-md scale-102'
                : 'bg-white text-orange-950 border-orange-200 hover:bg-orange-50'
            }`}
          >
            <span className="text-sm">{preset.icon}</span>
            <span>{preset.label}</span>
            <span
              className={`text-[10px] ${
                size === preset.size ? 'text-orange-100' : 'text-orange-600'
              }`}
            >
              {preset.size}px {preset.isDefault ? '(Chuẩn)' : ''}
            </span>
          </button>
        ))}
      </div>

      {/* Khung Xem Trước & Trải Nghiệm Thử */}
      <div className="p-3.5 rounded-2xl bg-gradient-to-r from-amber-50 to-orange-50 border border-orange-200 flex items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <div
            style={{ width: `${Math.max(28, size)}px`, height: `${Math.max(28, size)}px` }}
            className="flex items-center justify-center transition-all duration-150 drop-shadow-sm select-none shrink-0"
          >
            {/* SVG xem trước khuôn mặt Mèo */}
            <svg
              viewBox="0 0 32 32"
              fill="none"
              xmlns="http://www.w3.org/2000/svg"
              className="w-full h-full"
            >
              <g filter="drop-shadow(0 2px 3px rgba(0,0,0,0.25))">
                <path d="M4 4 L11 9 L6 13 Z" fill="#ea580c" stroke="#431407" strokeWidth="1.5" strokeLinejoin="round" />
                <path d="M5 6 L9 9 L6 11 Z" fill="#fda4af" />
                <path d="M16 2 L22 8 L16 10 Z" fill="#ea580c" stroke="#431407" strokeWidth="1.5" strokeLinejoin="round" />
                <path d="M17 4 L20 8 L17 9 Z" fill="#fda4af" />
                <ellipse cx="14" cy="15" rx="10" ry="9" fill="#f97316" stroke="#431407" strokeWidth="1.5" />
                <circle cx="10.5" cy="14.5" r="1.5" fill="#1c1917" />
                <circle cx="11" cy="14" r="0.5" fill="#ffffff" />
                <circle cx="17.5" cy="14.5" r="1.5" fill="#1c1917" />
                <circle cx="18" cy="14" r="0.5" fill="#ffffff" />
                <polygon points="14,17 12.8,16 15.2,16" fill="#fda4af" />
                <path d="M12.5 18 Q14 19.2 14 17.5 Q14 19.2 15.5 18" stroke="#431407" strokeWidth="1" strokeLinecap="round" fill="none" />
              </g>
            </svg>
          </div>
          <div className="space-y-0.5">
            <span className="text-xs font-bold text-orange-950 flex items-center gap-1">
              <Sparkles className="w-3.5 h-3.5 text-orange-600" /> Xem trước tỷ lệ thực tế
            </span>
            <p className="text-[11px] text-orange-800/80 font-medium leading-tight">
              Rê chuột quanh ô này để cảm nhận kích cỡ con trỏ chuột mới meow~
            </p>
          </div>
        </div>

        <span className="text-[11px] font-bold text-orange-700 bg-white/80 px-2.5 py-1 rounded-xl border border-orange-200 shrink-0">
          🐾 Đã lưu tự động
        </span>
      </div>
    </div>
  );
}

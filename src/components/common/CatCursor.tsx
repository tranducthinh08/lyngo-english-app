'use client';

import React, { useEffect, useState, useCallback } from 'react';
import { getCursorSize } from '@/lib/settings';

interface PawRipple {
  id: number;
  x: number;
  y: number;
  rotation: number;
  size: number;
}

// SVG Con trỏ Mèo Con (Default: Tip tai mèo góc trên trái)
export function getCatDefaultCursor(size: number = 32): string {
  const scale = size / 32;
  const hotspotX = Math.max(1, Math.round(4 * scale));
  const hotspotY = Math.max(1, Math.round(4 * scale));

  const svg = `<svg xmlns='http://www.w3.org/2000/svg' width='${size}' height='${size}' viewBox='0 0 32 32' fill='none'><g filter='drop-shadow(0 2px 3px rgba(0,0,0,0.25))'><path d='M4 4 L11 9 L6 13 Z' fill='%23ea580c' stroke='%23431407' stroke-width='1.5' stroke-linejoin='round'/><path d='M5 6 L9 9 L6 11 Z' fill='%23fda4af'/><path d='M16 2 L22 8 L16 10 Z' fill='%23ea580c' stroke='%23431407' stroke-width='1.5' stroke-linejoin='round'/><path d='M17 4 L20 8 L17 9 Z' fill='%23fda4af'/><ellipse cx='14' cy='15' rx='10' ry='9' fill='%23f97316' stroke='%23431407' stroke-width='1.5'/><path d='M14 8 L14 11 M11 9 L12 11 M17 9 L16 11' stroke='%23c2410c' stroke-width='1.2' stroke-linecap='round'/><circle cx='10.5' cy='14.5' r='1.5' fill='%231c1917'/><circle cx='11' cy='14' r='0.5' fill='%23ffffff'/><circle cx='17.5' cy='14.5' r='1.5' fill='%231c1917'/><circle cx='18' cy='14' r='0.5' fill='%23ffffff'/><polygon points='14,17 12.8,16 15.2,16' fill='%23fda4af'/><path d='M12.5 18 Q14 19.2 14 17.5 Q14 19.2 15.5 18' stroke='%23431407' stroke-width='1' stroke-linecap='round' fill='none'/><circle cx='8.5' cy='16.5' r='1.5' fill='%23fda4af' opacity='0.75'/><circle cx='19.5' cy='16.5' r='1.5' fill='%23fda4af' opacity='0.75'/></g></svg>`;

  return `url("data:image/svg+xml,${encodeURIComponent(svg)}") ${hotspotX} ${hotspotY}, auto`;
}

// SVG Bàn Chân Mèo Pointer (Hover lên nút/link: Tip tại đệm ngón trỏ)
export function getCatPointerCursor(size: number = 32): string {
  const scale = size / 32;
  const hotspotX = Math.max(1, Math.round(8 * scale));
  const hotspotY = Math.max(1, Math.round(4 * scale));

  const svg = `<svg xmlns='http://www.w3.org/2000/svg' width='${size}' height='${size}' viewBox='0 0 32 32' fill='none'><g filter='drop-shadow(0 2px 4px rgba(0,0,0,0.28))'><path d='M8 12 C6 17 6 23 11 26 C16 27 21 25 22 20 C23 15 20 11 15 10 C12 10 9 10 8 12 Z' fill='%23f97316' stroke='%23431407' stroke-width='1.5'/><ellipse cx='14' cy='19' rx='4.5' ry='3.5' fill='%23fda4af' stroke='%23e11d48' stroke-width='0.75'/><ellipse cx='8' cy='8' rx='2.2' ry='2.6' transform='rotate(-20 8 8)' fill='%23fb923c' stroke='%23431407' stroke-width='1.2'/><ellipse cx='8' cy='8' rx='1.4' ry='1.7' transform='rotate(-20 8 8)' fill='%23fda4af'/><ellipse cx='13' cy='5' rx='2.2' ry='2.8' fill='%23fb923c' stroke='%23431407' stroke-width='1.2'/><ellipse cx='13' cy='5' rx='1.4' ry='1.8' fill='%23fda4af'/><ellipse cx='18.5' cy='6' rx='2.2' ry='2.8' transform='rotate(15 18.5 6)' fill='%23fb923c' stroke='%23431407' stroke-width='1.2'/><ellipse cx='18.5' cy='6' rx='1.4' ry='1.8' fill='%23fda4af'/><ellipse cx='23' cy='10' rx='2' ry='2.5' transform='rotate(30 23 10)' fill='%23fb923c' stroke='%23431407' stroke-width='1.2'/><ellipse cx='23' cy='10' rx='1.2' ry='1.5' transform='rotate(30 23 10)' fill='%23fda4af'/></g></svg>`;

  return `url("data:image/svg+xml,${encodeURIComponent(svg)}") ${hotspotX} ${hotspotY}, pointer`;
}

export default function CatCursor() {
  const [ripples, setRipples] = useState<PawRipple[]>([]);
  const [isEnabled, setIsEnabled] = useState(true);
  const [cursorSize, setCursorSizeState] = useState<number>(32);

  // Khởi tạo kích thước con trỏ chuột & lắng nghe thay đổi
  useEffect(() => {
    if (typeof window === 'undefined') return;
    setCursorSizeState(getCursorSize());

    const handleSizeChange = (e: Event) => {
      const customEvent = e as CustomEvent<number>;
      if (typeof customEvent.detail === 'number') {
        setCursorSizeState(customEvent.detail);
      } else {
        setCursorSizeState(getCursorSize());
      }
    };

    window.addEventListener('lyngo_cursor_size_change', handleSizeChange);
    window.addEventListener('storage', handleSizeChange);

    return () => {
      window.removeEventListener('lyngo_cursor_size_change', handleSizeChange);
      window.removeEventListener('storage', handleSizeChange);
    };
  }, []);

  // Chỉ kích hoạt trên thiết bị có chuột (pointer: fine)
  useEffect(() => {
    if (typeof window === 'undefined') return;
    const mediaQuery = window.matchMedia('(pointer: fine)');
    setIsEnabled(mediaQuery.matches);

    const handler = (e: MediaQueryListEvent) => setIsEnabled(e.matches);
    mediaQuery.addEventListener('change', handler);
    return () => mediaQuery.removeEventListener('change', handler);
  }, []);

  // Xử lý hiệu ứng dấu chân mèo (Paw Print) khi click
  const handlePointerDown = useCallback((e: MouseEvent) => {
    // Không tạo hiệu ứng nếu người dùng giảm chuyển động
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;

    const newRipple: PawRipple = {
      id: Date.now() + Math.random(),
      x: e.clientX,
      y: e.clientY,
      rotation: Math.floor(Math.random() * 30) - 15,
      size: Math.max(18, Math.round(cursorSize * 0.72)), // Tỉ lệ mượt theo độ to con trỏ
    };

    setRipples((prev) => [...prev.slice(-7), newRipple]);

    // Dọn dẹp DOM sau khi animation kết thúc (400ms)
    setTimeout(() => {
      setRipples((prev) => prev.filter((r) => r.id !== newRipple.id));
    }, 420);
  }, [cursorSize]);

  useEffect(() => {
    if (!isEnabled) return;
    window.addEventListener('pointerdown', handlePointerDown, { passive: true });
    return () => window.removeEventListener('pointerdown', handlePointerDown);
  }, [isEnabled, handlePointerDown]);

  if (!isEnabled) return null;

  const defaultCursorCss = getCatDefaultCursor(cursorSize);
  const pointerCursorCss = getCatPointerCursor(cursorSize);

  return (
    <>
      {/* Khối Style áp dụng con trỏ mèo toàn trang */}
      <style jsx global>{`
        html,
        body {
          cursor: ${defaultCursorCss} !important;
        }

        /* Giữ con trỏ chữ I-Beam chuẩn khi nhập liệu văn bản */
        input[type="text"],
        input[type="search"],
        input[type="email"],
        input[type="password"],
        input[type="number"],
        textarea,
        [contenteditable="true"] {
          cursor: text !important;
        }

        a,
        button,
        [role="button"],
        input[type="button"],
        input[type="submit"],
        select,
        .cursor-pointer {
          cursor: ${pointerCursorCss} !important;
        }

        /* Khi rê chuột vào ảnh hoặc thẻ ghi nhớ */
        .card-cat-hover:hover {
          cursor: ${pointerCursorCss} !important;
        }
      `}</style>

      {/* Lớp hiển thị dấu chân mèo khi nhấp chuột (Paw Click Ripples) */}
      <div className="fixed inset-0 pointer-events-none z-[999999] overflow-hidden">
        {ripples.map((ripple) => (
          <div
            key={ripple.id}
            style={{
              left: `${ripple.x}px`,
              top: `${ripple.y}px`,
              transform: `translate(-50%, -50%) rotate(${ripple.rotation}deg)`,
              width: `${ripple.size}px`,
              height: `${ripple.size}px`,
            }}
            className="absolute animate-paw-float select-none"
          >
            {/* SVG Bàn chân mèo nở ra rồi bay nhẹ */}
            <svg
              viewBox="0 0 24 24"
              fill="none"
              xmlns="http://www.w3.org/2000/svg"
              className="w-full h-full drop-shadow-xs"
            >
              {/* Đệm thịt chính */}
              <ellipse cx="12" cy="15" rx="5" ry="4" fill="#fb923c" fillOpacity="0.85" />
              <ellipse cx="12" cy="15" rx="3.5" ry="2.8" fill="#fda4af" />
              {/* 4 Ngón chân */}
              <circle cx="6.5" cy="9.5" r="2" fill="#fb923c" fillOpacity="0.85" />
              <circle cx="6.5" cy="9.5" r="1.3" fill="#fda4af" />

              <circle cx="10" cy="6.5" r="2" fill="#fb923c" fillOpacity="0.85" />
              <circle cx="10" cy="6.5" r="1.3" fill="#fda4af" />

              <circle cx="14" cy="6.5" r="2" fill="#fb923c" fillOpacity="0.85" />
              <circle cx="14" cy="6.5" r="1.3" fill="#fda4af" />

              <circle cx="17.5" cy="9.5" r="2" fill="#fb923c" fillOpacity="0.85" />
              <circle cx="17.5" cy="9.5" r="1.3" fill="#fda4af" />
            </svg>
          </div>
        ))}
      </div>
    </>
  );
}

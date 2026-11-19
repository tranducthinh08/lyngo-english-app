'use client';

import React, { useState, useEffect } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { Camera, BookmarkCheck, Settings, BookOpen, Cloud, CloudOff, Loader2, HardDrive, Sparkles } from 'lucide-react';
import { db } from '@/lib/db';
import { useSyncStatus } from '@/hooks/useSyncStatus';
import SettingsModal from './SettingsModal';
import CuteCat from './CuteCat';

export default function Navbar() {
  const pathname = usePathname();
  const [showSettings, setShowSettings] = useState(false);
  const [dueCount, setDueCount] = useState<number>(0);
  const { status, runFullSync, isConfigured, errorMessage } = useSyncStatus();

  // Kiểm tra số lượng thẻ cần ôn hôm nay (tối ưu đếm trực tiếp từ IndexedDB, không nạp toàn bộ mảng vào RAM)
  useEffect(() => {
    const checkDue = async () => {
      try {
        const count = await db.vocabNotes
          .filter((c) => !c.nextReviewDate || c.nextReviewDate <= Date.now())
          .count();
        setDueCount(count);
      } catch (err) {
        console.warn('Lỗi kiểm tra thẻ đến hạn:', err);
      }
    };
    checkDue();
    const timer = setInterval(checkDue, 15000);
    return () => clearInterval(timer);
  }, [pathname]);

  const navLinks = [
    { href: '/', label: 'Tủ Sách', icon: BookOpen },
    { href: '/scan', label: 'Soi Sách AI', icon: Camera },
    { href: '/review', label: 'Ôn Tập Anki', icon: Sparkles, count: dueCount },
    { href: '/notes', label: 'Sổ Mẹo Nhớ', icon: BookmarkCheck },
  ];

  return (
    <>
      <header className="sticky top-0 z-40 bg-[#fffbf5]/95 backdrop-blur-md border-b-2 border-orange-200/80 shadow-xs">
        <div className="max-w-6xl mx-auto px-4 h-16 flex items-center justify-between gap-3">
          {/* Logo Mèo Cam */}
          <Link href="/" className="flex items-center gap-2 group shrink-0">
            <div className="relative">
              <CuteCat size={38} mood="reading" className="cat-wiggle-hover transition-transform" />
              <span className="absolute -top-0.5 -right-0.5 flex h-2.5 w-2.5">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-orange-400 opacity-75"></span>
                <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-orange-500"></span>
              </span>
            </div>

            <div>
              <div className="flex items-center gap-1.5">
                <span className="font-serif font-black text-xl sm:text-2xl tracking-tight text-orange-950">
                  Lyngo<span className="text-orange-600 font-sans">Cat</span>
                </span>
                <span className="text-[10px] font-sans font-bold px-1.5 py-0.5 rounded-full bg-orange-100 text-orange-800 border border-orange-300 flex items-center gap-0.5 shadow-2xs">
                  <span>🐾</span> Mèo Cam
                </span>
              </div>
              <p className="text-[11px] text-orange-700/80 font-medium hidden xl:block leading-tight">
                Cùng Cô Ly đọc sách giấy & tích lũy từ vựng :3
              </p>
            </div>
          </Link>

          {/* Navigation links & Utilities */}
          <div className="flex items-center gap-1.5 sm:gap-2 shrink-0">
            {/* Desktop Navigation Links */}
            <nav className="hidden md:flex items-center gap-1 sm:gap-1.5">
              {navLinks.map((link) => {
                const Icon = link.icon;
                const isActive = pathname === link.href;
                return (
                  <Link
                    key={link.href}
                    href={link.href}
                    className={`whitespace-nowrap shrink-0 inline-flex items-center gap-1.5 px-3 py-1.5 rounded-2xl text-xs sm:text-sm font-bold transition-all press-spring ${
                      isActive
                        ? 'bg-gradient-to-r from-orange-500 to-amber-500 text-white shadow-md shadow-orange-500/20 scale-102'
                        : 'text-orange-950/85 hover:bg-orange-100/70 hover:text-orange-950'
                    }`}
                  >
                    <Icon className="w-4 h-4 shrink-0" />
                    <span>{link.label}</span>
                    {link.count !== undefined && link.count > 0 && (
                      <span className="ml-0.5 px-1.5 py-0.2 rounded-full bg-rose-500 text-white text-[10px] font-black leading-none shadow-xs animate-pulse">
                        {link.count}
                      </span>
                    )}
                  </Link>
                );
              })}
            </nav>

            <div className="h-6 w-px bg-orange-200/80 mx-0.5 hidden md:block" />

            {/* Chỉ báo trạng thái Đồng bộ Đám mây (Icon gọn gàng kèm Tooltip) */}
            {isConfigured ? (
              status === 'syncing' ? (
                <div
                  title="Đang đồng bộ dữ liệu với Supabase Cloud..."
                  className="p-2 rounded-2xl bg-amber-50 border border-amber-300 text-amber-900 shadow-2xs flex items-center justify-center shrink-0"
                >
                  <Loader2 className="w-4 h-4 animate-spin text-amber-600" />
                </div>
              ) : status === 'error' ? (
                <button
                  type="button"
                  onClick={() => runFullSync()}
                  title={errorMessage || "Lỗi đồng bộ. Bấm để Mèo Cam thử lại nhé!"}
                  className="p-2 rounded-2xl bg-rose-50 border border-rose-300 text-rose-800 hover:bg-rose-100 transition-colors shadow-2xs cursor-pointer flex items-center justify-center shrink-0 press-spring"
                >
                  <CloudOff className="w-4 h-4 text-rose-600" />
                </button>
              ) : (
                <button
                  type="button"
                  onClick={() => runFullSync()}
                  title="Dữ liệu đã được lưu an toàn trên Supabase Cloud. Bấm để đồng bộ lại"
                  className="p-2 rounded-2xl bg-emerald-50 border border-emerald-300 text-emerald-800 hover:bg-emerald-100 transition-colors shadow-2xs cursor-pointer flex items-center justify-center shrink-0 press-spring"
                >
                  <Cloud className="w-4 h-4 text-emerald-600" />
                </button>
              )
            ) : (
              <button
                type="button"
                onClick={() => setShowSettings(true)}
                title="Đang lưu cục bộ trên máy (Dexie). Bấm để cài đặt Supabase Cloud"
                className="p-2 rounded-2xl bg-orange-100/70 border border-orange-200 text-orange-800 hover:bg-orange-200 transition-colors shadow-2xs cursor-pointer flex items-center justify-center shrink-0 press-spring"
              >
                <HardDrive className="w-4 h-4 text-orange-600" />
              </button>
            )}

            {/* Nút Cài đặt */}
            <button
              type="button"
              onClick={() => setShowSettings(true)}
              title="Cài đặt Mèo Cam & API Key"
              className="p-2 rounded-2xl text-orange-800 hover:bg-orange-100/70 hover:text-orange-950 border border-orange-200/80 transition-colors bg-white/80 shadow-2xs shrink-0 cursor-pointer press-spring"
            >
              <Settings className="w-4 h-4" />
            </button>
          </div>
        </div>
      </header>

      {/* Mobile Bottom Navigation Bar (Dành riêng cho màn hình điện thoại < md) */}
      <nav className="md:hidden fixed bottom-0 left-0 right-0 z-40 bg-[#fffdfa]/95 backdrop-blur-lg border-t-2 border-orange-200/90 shadow-2xl px-2 py-1 flex items-center justify-around safe-bottom">
        {navLinks.map((link) => {
          const Icon = link.icon;
          const isActive = pathname === link.href;
          return (
            <Link
              key={link.href}
              href={link.href}
              className={`flex-1 min-h-[48px] py-1 px-1 rounded-2xl flex flex-col items-center justify-center gap-0.5 transition-all text-center relative press-spring ${
                isActive
                  ? 'text-orange-600 font-extrabold'
                  : 'text-orange-900/70 hover:text-orange-950 font-bold'
              }`}
            >
              <div
                className={`p-1 rounded-xl transition-all ${
                  isActive ? 'bg-orange-100 text-orange-600 shadow-xs' : ''
                }`}
              >
                <Icon className="w-5 h-5" />
              </div>
              <span className="text-[10px] leading-tight font-medium tracking-tight">
                {link.label}
              </span>
              {link.count !== undefined && link.count > 0 && (
                <span className="absolute top-1 right-3 px-1.5 py-0.2 rounded-full bg-rose-500 text-white text-[9px] font-black shadow-xs animate-pulse">
                  {link.count}
                </span>
              )}
            </Link>
          );
        })}
      </nav>

      {showSettings && <SettingsModal onClose={() => setShowSettings(false)} />}
    </>
  );
}

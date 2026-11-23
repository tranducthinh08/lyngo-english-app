'use client';

import React, { useState, useEffect } from 'react';
import { Volume2, ExternalLink, X, Loader2, Sparkles, BookOpen, Globe } from 'lucide-react';
import { DictionaryData } from '@/types';
import { lookupCambridgeInstant } from '@/lib/cambridgeLookup';
import CuteCat from '@/components/common/CuteCat';

interface DictionaryPopoverProps {
  word: string;
  position: { x: number; y: number };
  onClose: () => void;
  onAddNote: (wordData: {
    word: string;
    phonetic?: string;
    meaning?: string;
    cambridgeUrl: string;
    googleTranslateUrl?: string;
  }) => void;
}

export default function DictionaryPopover({ word, position, onClose, onAddNote }: DictionaryPopoverProps) {
  const [loading, setLoading] = useState(true);
  const [data, setData] = useState<DictionaryData | null>(null);
  const [isPlayingAudio, setIsPlayingAudio] = useState(false);

  useEffect(() => {
    let isMounted = true;
    setLoading(true);

    lookupCambridgeInstant(word)
      .then((res) => {
        if (isMounted) {
          setData({
            word: res.word,
            phonetic: res.phonetic,
            vietnamese: res.meaning,
            partOfSpeech: res.partOfSpeech,
            englishDefinition: res.englishDefinition,
            example: res.exampleEn,
            exampleVi: res.exampleVi,
            cambridgeUrl: res.cambridgeUrl,
            googleTranslateUrl: res.googleTranslateUrl,
            meanings: res.meaning
              ? [
                  {
                    partOfSpeech: res.partOfSpeech,
                    definitions: [
                      {
                        definition: res.englishDefinition || res.meaning,
                        example: res.exampleEn,
                      },
                    ],
                  },
                ]
              : [],
          });
          setLoading(false);
        }
      })
      .catch((err) => {
        console.error('Lỗi khi tra từ nhanh:', err);
        if (isMounted) {
          setData({
            word,
            meanings: [],
            cambridgeUrl: `https://dictionary.cambridge.org/dictionary/english/${encodeURIComponent(word)}`,
            googleTranslateUrl: `https://translate.google.com/?sl=en&tl=vi&text=${encodeURIComponent(word)}&op=translate`,
          });
          setLoading(false);
        }
      });

    return () => {
      isMounted = false;
    };
  }, [word]);

  const handlePlayAudio = () => {
    setIsPlayingAudio(true);
    const audioUrl = `/api/tts?text=${encodeURIComponent(word)}&lang=en`;
    const audio = new Audio(audioUrl);
    audio.onended = () => setIsPlayingAudio(false);
    audio.onerror = () => {
      // Fallback sang Web Speech API
      if (typeof window !== 'undefined' && window.speechSynthesis) {
        const u = new SpeechSynthesisUtterance(word);
        u.lang = 'en-US';
        u.onend = () => setIsPlayingAudio(false);
        u.onerror = () => setIsPlayingAudio(false);
        window.speechSynthesis.speak(u);
      } else {
        setIsPlayingAudio(false);
      }
    };
    audio.play().catch(() => setIsPlayingAudio(false));
  };

  const googleUrl = data?.googleTranslateUrl || `https://translate.google.com/?sl=en&tl=vi&text=${encodeURIComponent(word)}&op=translate`;
  const cambridgeUrl = data?.cambridgeUrl || `https://dictionary.cambridge.org/dictionary/english/${encodeURIComponent(word)}`;

  const popoverWidth = 360;
  const popoverHeight = 360;
  const screenWidth = typeof window !== 'undefined' ? window.innerWidth : 1000;
  const screenHeight = typeof window !== 'undefined' ? window.innerHeight : 800;

  let left = position.x - popoverWidth / 2;
  if (left < 16) left = 16;
  if (left + popoverWidth > screenWidth - 16) left = screenWidth - popoverWidth - 16;

  let top = position.y + 12;
  if (top + popoverHeight > screenHeight - 16) {
    top = Math.max(16, position.y - popoverHeight - 8);
  }

  const primaryMeaning = data?.vietnamese || data?.meanings?.[0]?.definitions?.[0]?.definition || '';

  return (
    <div
      style={{ left: `${left}px`, top: `${top}px` }}
      className="fixed z-50 w-[360px] bg-[#fffdfa] rounded-3xl border-2 border-orange-200 shadow-modal backdrop-blur-md p-4 animate-in fade-in zoom-in-95 duration-150 text-slate-900"
    >
      {/* Header Popover: Từ vựng, Phiên âm, Nút nghe phát âm, Nút đóng */}
      <div className="flex items-start justify-between gap-2 pb-2.5 border-b-2 border-orange-100">
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2">
            <CuteCat size={22} mood="paw" />
            <h3 className="font-serif font-black text-xl text-orange-950 truncate capitalize">
              {word}
            </h3>
            <button
              onClick={handlePlayAudio}
              title="Nghe phát âm chuẩn Cambridge 🔊"
              className={`p-1.5 rounded-full hover:bg-orange-200 text-orange-800 transition-colors ${
                isPlayingAudio ? 'bg-orange-300 animate-pulse text-orange-950 scale-105' : 'bg-orange-100'
              }`}
            >
              <Volume2 className="w-4 h-4" />
            </button>
          </div>
          <div className="flex items-center gap-2 mt-1 flex-wrap">
            {data?.phonetic && (
              <span className="text-xs font-mono font-bold text-orange-800 bg-orange-100 px-2 py-0.5 rounded-md inline-block border border-orange-200">
                {data.phonetic}
              </span>
            )}
            {data?.partOfSpeech && (
              <span className="text-[11px] font-semibold text-amber-800 bg-amber-50 px-2 py-0.5 rounded-full border border-amber-200">
                🐾 {data.partOfSpeech}
              </span>
            )}
          </div>
        </div>

        <button
          onClick={onClose}
          className="p-1 rounded-full text-slate-400 hover:text-slate-700 hover:bg-orange-100 transition-colors"
          title="Đóng popup"
        >
          <X className="w-4 h-4" />
        </button>
      </div>

      {/* Body: Thông tin cơ bản Cambridge */}
      <div className="py-3 max-h-60 overflow-y-auto space-y-2.5 text-sm text-slate-700 pr-1">
        {loading ? (
          <div className="flex items-center justify-center py-8 gap-2 text-orange-800 text-xs font-bold">
            <Loader2 className="w-4 h-4 animate-spin text-orange-600" />
            Mèo Cam đang tra cứu từ điển Cambridge...
          </div>
        ) : (
          <>
            {/* 1. Nghĩa tiếng Việt chuẩn xác */}
            {primaryMeaning ? (
              <div className="p-2.5 rounded-2xl bg-gradient-to-r from-amber-50 to-orange-50 border border-orange-200 space-y-0.5">
                <span className="text-[10px] font-black uppercase tracking-wider text-orange-800 flex items-center gap-1 font-sans">
                  <span>🇻🇳</span> Nghĩa tiếng Việt:
                </span>
                <p className="font-bold text-orange-950 text-sm leading-snug">
                  {primaryMeaning}
                </p>
              </div>
            ) : null}

            {/* 2. Định nghĩa tiếng Anh chuẩn Cambridge */}
            {data?.englishDefinition && (
              <div className="p-2.5 rounded-2xl bg-orange-50/70 border border-orange-200/70 space-y-1">
                <span className="text-[10px] font-black uppercase tracking-wider text-orange-800 flex items-center gap-1 font-sans">
                  <span>📖</span> Định nghĩa Cambridge:
                </span>
                <p className="text-xs text-slate-800 leading-relaxed font-serif italic">
                  &ldquo;{data.englishDefinition}&rdquo;
                </p>
              </div>
            )}

            {/* 3. Ví dụ câu thực tế kèm dịch nghĩa */}
            {data?.example && (
              <div className="p-2.5 rounded-2xl bg-amber-50/50 border border-amber-200/60 space-y-1">
                <span className="text-[10px] font-black uppercase tracking-wider text-amber-800 flex items-center gap-1 font-sans">
                  <span>✨</span> Ví dụ ngữ cảnh:
                </span>
                <p className="text-xs font-medium text-slate-900 leading-relaxed">
                  &ldquo;{data.example}&rdquo;
                </p>
                {data.exampleVi && (
                  <p className="text-[11px] text-slate-600 italic leading-relaxed pt-0.5 border-t border-amber-100">
                    👉 {data.exampleVi}
                  </p>
                )}
              </div>
            )}

            {/* Trường hợp không tìm thấy dữ liệu */}
            {!primaryMeaning && !data?.englishDefinition && !data?.example && (
              <div className="text-center py-4 px-2 text-xs text-slate-600 space-y-1">
                <p className="font-medium text-orange-900">Chưa có dữ liệu từ điển offline cho từ này.</p>
                <p className="text-[11px] text-slate-500">Bấm nút bên dưới để mở Cambridge Dictionary trực tiếp.</p>
              </div>
            )}
          </>
        )}
      </div>

      {/* Action Buttons: Nổi bật Cambridge & Lưu vào Sổ nhớ Cô Ly */}
      <div className="pt-2.5 border-t-2 border-orange-100 space-y-2">
        {/* NÚT CHÍNH: LƯU VÀO KIỂU NHỚ CỦA CÔ LY */}
        <button
          onClick={() => {
            onAddNote({
              word: data?.word || word,
              phonetic: data?.phonetic || '',
              meaning: primaryMeaning,
              cambridgeUrl,
              googleTranslateUrl: googleUrl,
            });
            onClose();
          }}
          className="w-full flex items-center justify-center gap-1.5 py-2.5 px-3 rounded-2xl bg-gradient-to-r from-orange-500 to-amber-500 hover:from-orange-600 hover:to-amber-600 text-white font-black text-xs shadow-md shadow-orange-500/20 active:scale-98 transition-all"
        >
          <Sparkles className="w-4 h-4" />
          <span>Lưu vào &quot;Kiểu nhớ của Cô Ly&quot; + Thêm ảnh 🐾</span>
        </button>

        {/* CẶP NÚT TRA CỨU: CAMBRIDGE DICTIONARY (CHÍNH) + GOOGLE TRANSLATE (PHỤ) */}
        <div className="flex items-center gap-2">
          <a
            href={cambridgeUrl}
            target="_blank"
            rel="noreferrer"
            className="flex-1 flex items-center justify-center gap-1.5 py-2 px-2.5 rounded-xl bg-orange-100 hover:bg-orange-200 text-orange-950 font-bold text-[11px] border border-orange-300 transition-colors group"
            title="Tra cứu từ điển Cambridge Dictionary đầy đủ"
          >
            <BookOpen className="w-3.5 h-3.5 text-orange-700" />
            <span className="truncate">Cambridge Dictionary 📖</span>
            <ExternalLink className="w-3 h-3 opacity-70 group-hover:translate-x-0.5 transition-transform" />
          </a>

          <a
            href={googleUrl}
            target="_blank"
            rel="noreferrer"
            className="flex items-center justify-center gap-1 py-2 px-2.5 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold text-[11px] border border-slate-200 transition-colors"
            title="Mở Google Translate dịch câu"
          >
            <Globe className="w-3.5 h-3.5 text-blue-600" />
            <span>Google 🌐</span>
          </a>
        </div>
      </div>
    </div>
  );
}

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
                        definition: res.meaning,
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
    // Ưu tiên phát qua Google Translate TTS /api/tts
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

  const popoverWidth = 350;
  const popoverHeight = 280;
  const screenWidth = typeof window !== 'undefined' ? window.innerWidth : 1000;
  const screenHeight = typeof window !== 'undefined' ? window.innerHeight : 800;

  let left = position.x - popoverWidth / 2;
  if (left < 16) left = 16;
  if (left + popoverWidth > screenWidth - 16) left = screenWidth - popoverWidth - 16;

  let top = position.y + 12;
  // Chống tràn màn hình phía dưới: nếu sát đáy màn hình thì bật popover lên trên
  if (top + popoverHeight > screenHeight - 16) {
    top = Math.max(16, position.y - popoverHeight - 8);
  }

  const primaryMeaning = data?.vietnamese || data?.meanings?.[0]?.definitions?.[0]?.definition || '';

  return (
    <div
      style={{ left: `${left}px`, top: `${top}px` }}
      className="fixed z-50 w-[350px] bg-[#fffdfa] rounded-3xl border-2 border-orange-200 shadow-modal backdrop-blur-md p-4 animate-in fade-in zoom-in-95 duration-150 text-slate-900"
    >
      {/* Header Popover */}
      <div className="flex items-start justify-between gap-2 pb-2.5 border-b-2 border-orange-100">
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2">
            <CuteCat size={22} mood="paw" />
            <h3 className="font-serif font-black text-xl text-orange-950 truncate capitalize">
              {word}
            </h3>
            <button
              onClick={handlePlayAudio}
              title="Nghe phát âm Google Translate 🔊"
              className={`p-1.5 rounded-full hover:bg-orange-200 text-orange-800 transition-colors ${
                isPlayingAudio ? 'bg-orange-300 animate-pulse text-orange-950 scale-105' : 'bg-orange-100'
              }`}
            >
              <Volume2 className="w-4 h-4" />
            </button>
          </div>
          {data?.phonetic && (
            <span className="text-xs font-mono font-bold text-orange-800 bg-orange-100 px-2 py-0.5 rounded-md inline-block mt-1 border border-orange-200">
              {data.phonetic}
            </span>
          )}
        </div>

        <button
          onClick={onClose}
          className="p-1 rounded-full text-slate-400 hover:text-slate-700 hover:bg-orange-100 transition-colors"
        >
          <X className="w-4 h-4" />
        </button>
      </div>

      {/* Body: Bản dịch tiếng Việt & Định nghĩa */}
      <div className="py-3 max-h-52 overflow-y-auto space-y-2.5 text-sm text-slate-700">
        {loading ? (
          <div className="flex items-center justify-center py-6 gap-2 text-orange-800 text-xs font-bold">
            <Loader2 className="w-4 h-4 animate-spin text-orange-600" />
            Mèo Cam đang dịch nghĩa tiếng Việt...
          </div>
        ) : (
          <>
            {/* Bản dịch tiếng Việt nổi bật */}
            {primaryMeaning && (
              <div className="p-2.5 rounded-2xl bg-gradient-to-r from-amber-50 to-orange-50 border border-orange-200 space-y-1">
                <span className="text-[10px] font-black uppercase tracking-wider text-orange-800 flex items-center gap-1 font-sans">
                  <span>🌐</span> Dịch Tiếng Việt:
                </span>
                <p className="font-bold text-orange-950 text-sm leading-snug">
                  {primaryMeaning}
                </p>
              </div>
            )}

            {/* Các ví dụ / nghĩa chi tiết */}
            {data?.meanings && data.meanings.length > 0 && (
              <div className="space-y-2 pt-1">
                {data.meanings.map((m, idx) => (
                  <div key={idx} className="space-y-1">
                    <span className="text-[10px] font-black text-orange-800 uppercase tracking-wider bg-orange-100 px-2 py-0.5 rounded-full border border-orange-200">
                      🐾 {m.partOfSpeech}
                    </span>
                    {m.definitions.map((d, dIdx) => (
                      <div key={dIdx} className="pl-2 border-l-2 border-orange-300 text-xs text-slate-800 leading-relaxed">
                        <p className="font-medium">{d.definition}</p>
                        {d.example && (
                          <p className="italic text-slate-500 text-[11px] mt-0.5">&ldquo;{d.example}&rdquo;</p>
                        )}
                      </div>
                    ))}
                  </div>
                ))}
              </div>
            )}
          </>
        )}
      </div>

      {/* Action Buttons: GOOGLE TRANSLATE MẶC ĐỊNH */}
      <div className="pt-2 border-t-2 border-orange-100 space-y-2">
        {/* NÚT 1 (MẶC ĐỊNH): GOOGLE TRANSLATE */}
        <a
          href={googleUrl}
          target="_blank"
          rel="noreferrer"
          className="w-full flex items-center justify-center gap-2 py-2.5 px-3 rounded-2xl bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700 text-white font-black text-xs shadow-md shadow-blue-600/20 transition-all group active:scale-98"
        >
          <Globe className="w-4 h-4" />
          <span>Mở trên Google Translate 🌐 (Mặc định)</span>
          <ExternalLink className="w-3.5 h-3.5 opacity-90 group-hover:translate-x-0.5 transition-transform" />
        </a>

        {/* NÚT 2: CAMBRIDGE DICTIONARY (PHỤ) */}
        <a
          href={cambridgeUrl}
          target="_blank"
          rel="noreferrer"
          className="w-full flex items-center justify-center gap-1.5 py-1.5 px-3 rounded-xl bg-orange-50 hover:bg-orange-100 text-orange-950 font-bold text-[11px] border border-orange-200 transition-colors"
        >
          <BookOpen className="w-3.5 h-3.5 text-orange-700" />
          <span>Tra cứu ngữ pháp Cambridge Dictionary 📖</span>
        </a>

        {/* NÚT 3: LƯU KIỂU NHỚ CỦA CÔ LY */}
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
          className="w-full flex items-center justify-center gap-1.5 py-2 px-3 rounded-2xl bg-orange-100 text-orange-950 font-bold text-xs hover:bg-orange-200 border-2 border-orange-300 transition-all active:scale-98"
        >
          <Sparkles className="w-3.5 h-3.5 text-orange-600" />
          <span>Lưu vào &quot;Kiểu nhớ của Cô Ly&quot; + Thêm ảnh 🐾</span>
        </button>
      </div>
    </div>
  );
}

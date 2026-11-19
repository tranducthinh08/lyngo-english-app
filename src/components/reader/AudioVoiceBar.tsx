'use client';

import React from 'react';
import {
  Play,
  Pause,
  Square,
  SkipBack,
  SkipForward,
  Volume2,
  Globe,
  Laptop
} from 'lucide-react';
import CuteCat from '@/components/common/CuteCat';
import { TtsEngine } from '@/hooks/useTextToSpeech';

interface AudioVoiceBarProps {
  isPlaying: boolean;
  isPaused: boolean;
  currentSentenceIndex: number;
  totalSentences: number;
  currentSentenceText?: string;
  rate: number;
  engine: TtsEngine;
  voices: SpeechSynthesisVoice[];
  selectedVoice: SpeechSynthesisVoice | null;
  onPlay: () => void;
  onPause: () => void;
  onStop: () => void;
  onNext: () => void;
  onPrev: () => void;
  onChangeRate: (rate: number) => void;
  onChangeVoice: (voice: SpeechSynthesisVoice) => void;
  onSelectEngine: (engine: TtsEngine) => void;
  onTestVoice?: () => void;
}

export default function AudioVoiceBar({
  isPlaying,
  isPaused,
  currentSentenceIndex,
  totalSentences,
  currentSentenceText,
  rate,
  engine,
  voices,
  selectedVoice,
  onPlay,
  onPause,
  onStop,
  onNext,
  onPrev,
  onChangeRate,
  onChangeVoice,
  onSelectEngine,
  onTestVoice,
}: AudioVoiceBarProps) {
  const speedOptions = [0.75, 1.0, 1.25];

  return (
    <div className="fixed bottom-6 left-1/2 -translate-x-1/2 z-40 w-[96%] max-w-4xl bg-orange-950/95 text-orange-50 backdrop-blur-md rounded-3xl p-3 sm:px-6 sm:py-3.5 shadow-2xl border-2 border-orange-500/80 transition-all duration-300">
      <div className="flex flex-col md:flex-row items-center justify-between gap-3">
        {/* KHỐI TRÁI: AVATAR MÈO + TRẠNG THÁI + CÂU ĐANG ĐỌC (KHÔNG BỊ XUỐNG DÒNG) */}
        <div className="flex items-center gap-3 w-full md:w-auto justify-between md:justify-start shrink-0 min-w-0">
          <div className="flex items-center gap-2.5 min-w-0">
            <div className="shrink-0 relative">
              <CuteCat size={40} mood="listening" />
            </div>

            <div className="min-w-0">
              <div className="flex items-center gap-2 whitespace-nowrap">
                <span className="text-xs font-black text-orange-200 flex items-center gap-1">
                  <span>🐾</span>
                  {isPlaying ? 'Mèo Cam đang đọc' : isPaused ? 'Mèo Cam tạm nghỉ' : 'Trợ lý đọc sách'}
                </span>

                {totalSentences > 0 && (
                  <span className="text-[11px] font-mono bg-orange-900/90 text-orange-300 px-2 py-0.5 rounded-full border border-orange-700/80 font-bold shrink-0">
                    {currentSentenceIndex >= 0 ? currentSentenceIndex + 1 : 0}/{totalSentences} câu
                  </span>
                )}
              </div>

              {/* Trích dẫn câu đang đọc: 1 dòng duy nhất, có truncate */}
              <p
                title={currentSentenceText || 'Google Translate English Voice'}
                className="text-[11px] text-amber-300/90 font-medium truncate max-w-[180px] sm:max-w-[240px] md:max-w-[280px] pt-0.5"
              >
                {currentSentenceText
                  ? `“${currentSentenceText}”`
                  : engine === 'google'
                  ? '🌐 Giọng Google Translate chuẩn'
                  : (selectedVoice?.name || 'Giọng máy tính')}
              </p>
            </div>
          </div>

          {/* Chọn giọng trên màn hình cực nhỏ */}
          {engine === 'browser' && voices.length > 0 && (
            <select
              aria-label="Chọn giọng đọc máy"
              value={selectedVoice?.voiceURI || ''}
              onChange={(e) => {
                const v = voices.find((voice) => voice.voiceURI === e.target.value);
                if (v) onChangeVoice(v);
              }}
              className="text-[10px] bg-orange-900 border border-orange-700 rounded-xl px-2 py-1 text-orange-200 sm:hidden max-w-[90px] truncate"
            >
              {voices.map((v) => (
                <option key={v.voiceURI} value={v.voiceURI}>
                  {v.name}
                </option>
              ))}
            </select>
          )}
        </div>

        {/* KHỐI GIỮA: CÁC NÚT ĐIỀU KHIỂN PHÁT (TO RÕ RÀNG) */}
        <div className="flex items-center gap-2.5 justify-center shrink-0">
          {/* Tua câu trước */}
          <button
            onClick={onPrev}
            disabled={currentSentenceIndex <= 0}
            title="Câu trước"
            className="p-2 rounded-xl text-orange-300 hover:bg-orange-900 hover:text-white disabled:opacity-30 disabled:hover:bg-transparent transition-colors"
          >
            <SkipBack className="w-4 h-4" />
          </button>

          {/* Nút Play / Pause tròn nổi bật */}
          {isPlaying ? (
            <button
              onClick={onPause}
              title="Tạm dừng"
              className="w-11 h-11 rounded-full bg-gradient-to-r from-orange-400 to-amber-400 text-orange-950 font-black hover:scale-105 shadow-md shadow-orange-950/40 transition-transform active:scale-95 flex items-center justify-center"
            >
              <Pause className="w-5 h-5 fill-current" />
            </button>
          ) : (
            <button
              onClick={onPlay}
              title={isPaused ? 'Tiếp tục đọc' : 'Mèo Cam đọc toàn bài'}
              className="w-11 h-11 rounded-full bg-gradient-to-r from-orange-400 to-amber-400 text-orange-950 font-black hover:scale-105 shadow-md shadow-orange-950/40 transition-transform active:scale-95 flex items-center justify-center"
            >
              <Play className="w-5 h-5 fill-current ml-0.5" />
            </button>
          )}

          {/* Tua câu sau */}
          <button
            onClick={onNext}
            disabled={currentSentenceIndex >= totalSentences - 1}
            title="Câu kế tiếp"
            className="p-2 rounded-xl text-orange-300 hover:bg-orange-900 hover:text-white disabled:opacity-30 disabled:hover:bg-transparent transition-colors"
          >
            <SkipForward className="w-4 h-4" />
          </button>

          {/* Dừng hẳn */}
          {(isPlaying || isPaused) && (
            <button
              onClick={onStop}
              title="Dừng lại"
              className="p-2 rounded-xl text-rose-400 hover:bg-rose-950/60 hover:text-rose-200 transition-colors"
            >
              <Square className="w-4 h-4 fill-current" />
            </button>
          )}
        </div>

        {/* KHỐI PHẢI: ĐỘNG CƠ (GOOGLE MẶC ĐỊNH) + TỐC ĐỘ + THỬ LOA */}
        <div className="flex items-center gap-2 shrink-0 flex-wrap sm:flex-nowrap justify-center md:justify-end">
          {/* NÚT THỬ LOA TRỰC TIẾP */}
          {onTestVoice && (
            <button
              type="button"
              onClick={onTestVoice}
              title="Bấm để thử âm lượng loa 🔊"
              className="px-2.5 py-1.5 rounded-xl bg-orange-900/90 hover:bg-orange-800 text-amber-300 hover:text-amber-200 text-xs font-bold flex items-center gap-1 transition-all border border-orange-700/80 active:scale-95 shadow-2xs whitespace-nowrap"
            >
              <Volume2 className="w-3.5 h-3.5" />
              <span>Thử loa</span>
            </button>
          )}

          {/* CHỌN ĐỘNG CƠ: GOOGLE TRANSLATE (MẶC ĐỊNH) vs GIỌNG MÁY */}
          <div className="flex items-center bg-orange-900/90 p-0.5 rounded-xl border border-orange-700 text-xs font-bold shadow-inner">
            <button
              type="button"
              onClick={() => onSelectEngine('google')}
              className={`px-2.5 py-1 rounded-lg flex items-center gap-1 transition-all ${
                engine === 'google'
                  ? 'bg-gradient-to-r from-amber-500 to-orange-500 text-orange-950 font-black shadow-xs'
                  : 'text-orange-300 hover:text-white'
              }`}
            >
              <Globe className="w-3.5 h-3.5" />
              <span>Google</span>
            </button>

            <button
              type="button"
              onClick={() => onSelectEngine('browser')}
              className={`px-2.5 py-1 rounded-lg flex items-center gap-1 transition-all ${
                engine === 'browser'
                  ? 'bg-gradient-to-r from-amber-500 to-orange-500 text-orange-950 font-black shadow-xs'
                  : 'text-orange-300 hover:text-white'
              }`}
            >
              <Laptop className="w-3.5 h-3.5" />
              <span>Máy</span>
            </button>
          </div>

          {/* TỐC ĐỘ ĐỌC */}
          <div className="flex items-center bg-orange-900/90 p-0.5 rounded-xl border border-orange-800">
            {speedOptions.map((s) => (
              <button
                key={s}
                onClick={() => onChangeRate(s)}
                className={`px-2 py-1 rounded-lg text-xs font-bold transition-all ${
                  rate === s
                    ? 'bg-orange-400 text-orange-950 font-black shadow-xs'
                    : 'text-orange-300 hover:text-white'
                }`}
              >
                {s}x
              </button>
            ))}
          </div>

          {/* Dropdown voice nếu ở chế độ Browser */}
          {engine === 'browser' && voices.length > 0 && (
            <select
              aria-label="Chọn giọng đọc trên desktop"
              value={selectedVoice?.voiceURI || ''}
              onChange={(e) => {
                const v = voices.find((voice) => voice.voiceURI === e.target.value);
                if (v) onChangeVoice(v);
              }}
              className="hidden lg:block text-xs bg-orange-900 border border-orange-700 rounded-xl px-2 py-1 text-orange-200 focus:outline-none max-w-[120px] truncate font-medium"
            >
              {voices.map((v) => (
                <option key={v.voiceURI} value={v.voiceURI}>
                  {v.name}
                </option>
              ))}
            </select>
          )}
        </div>
      </div>
    </div>
  );
}

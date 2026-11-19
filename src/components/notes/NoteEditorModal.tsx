'use client';

import React, { useState, useRef, useEffect, useCallback } from 'react';
import {
  X,
  Image as ImageIcon,
  Upload,
  Trash2,
  Check,
  BookOpen,
  ExternalLink,
  Lightbulb,
  Sparkles,
  Loader2,
  Globe,
  Wand2,
  Volume2,
  Dices,
  RefreshCw
} from 'lucide-react';
import confetti from 'canvas-confetti';
import { VocabNote, MemoryType } from '@/types';
import { db } from '@/lib/db';
import { syncService } from '@/lib/syncService';
import { uploadBookImage, isSupabaseConfigured } from '@/lib/supabase';
import { lookupCambridgeInstant } from '@/lib/cambridgeLookup';
import { recordReviewActivity } from '@/lib/heatmapService';
import { generateVocabImageUrl, preloadImageUrl, fetchRealVocabImages } from '@/lib/imageGenerator';
import { getStoredGeminiKey } from '@/lib/settings';
import CuteCat from '@/components/common/CuteCat';

interface NoteEditorModalProps {
  initialData: {
    word: string;
    phonetic?: string;
    partOfSpeech?: string;
    meaning?: string;
    note?: string;
    exampleEn?: string;
    exampleVi?: string;
    contextSentence?: string;
    cambridgeUrl?: string;
    googleTranslateUrl?: string;
    albumId?: string;
    pageId?: string;
    noteId?: string;
    existingNote?: VocabNote;
  };
  onClose: () => void;
  onSaved?: (note: VocabNote) => void;
}

const MEMORY_TYPES: { id: MemoryType; label: string; desc: string; color: string; icon: string }[] = [
  { id: 'mnemonic', label: 'Mẹo liên tưởng', desc: 'Câu chuyện vui / Từ tượng thanh để nhớ dai', color: 'bg-purple-100 text-purple-950 border-purple-300', icon: '💡' },
  { id: 'collocation', label: 'Cụm từ đi kèm', desc: 'Collocation / Phrasal Verb thường gặp', color: 'bg-blue-100 text-blue-950 border-blue-300', icon: '🔗' },
  { id: 'context', label: 'Ngữ cảnh trong sách', desc: 'Ý nghĩa đặc biệt của từ trong trang sách này', color: 'bg-emerald-100 text-emerald-950 border-emerald-300', icon: '📖' },
  { id: 'grammar', label: 'Ngữ pháp / Cách dùng', desc: 'Quy tắc chia thì / Giới từ đi cùng', color: 'bg-amber-100 text-amber-950 border-amber-300', icon: '📐' },
  { id: 'other', label: 'Ghi chú riêng', desc: 'Cảm nhận cá nhân của Cô Ly', color: 'bg-rose-100 text-rose-950 border-rose-300', icon: '🐟' },
];

export default function NoteEditorModal({ initialData, onClose, onSaved }: NoteEditorModalProps) {
  const existing = initialData.existingNote;

  const [word, setWord] = useState(existing?.word || initialData.word);
  const [phonetic, setPhonetic] = useState(existing?.phonetic || initialData.phonetic || '');
  const [partOfSpeech, setPartOfSpeech] = useState(existing?.partOfSpeech || initialData.partOfSpeech || '');
  const [meaning, setMeaning] = useState(existing?.meaning || initialData.meaning || '');
  const [exampleEn, setExampleEn] = useState(existing?.exampleEn || initialData.exampleEn || '');
  const [exampleVi, setExampleVi] = useState(existing?.exampleVi || initialData.exampleVi || '');
  const [contextSentence, setContextSentence] = useState(existing?.contextSentence || initialData.contextSentence || '');
  const [memoryType, setMemoryType] = useState<MemoryType>(existing?.memoryType || 'mnemonic');
  const [note, setNote] = useState(existing?.note || initialData.note || '');
  const [imageUrl, setImageUrl] = useState(existing?.imageUrl || '');
  const [cambridgeUrl, setCambridgeUrl] = useState(
    existing?.cambridgeUrl || initialData.cambridgeUrl || `https://dictionary.cambridge.org/dictionary/english/${encodeURIComponent(initialData.word)}`
  );
  const [googleTranslateUrl, setGoogleTranslateUrl] = useState(
    initialData.googleTranslateUrl || `https://translate.google.com/?sl=en&tl=vi&text=${encodeURIComponent(initialData.word)}&op=translate`
  );

  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isGeneratingAI, setIsGeneratingAI] = useState(false);
  const [isGeneratingImage, setIsGeneratingImage] = useState(false);
  const [suggestedPhotos, setSuggestedPhotos] = useState<string[]>([]);
  const [isLoadingPhotos, setIsLoadingPhotos] = useState(false);
  const [isInstantLoading, setIsInstantLoading] = useState(false);
  const [aiGeneratedSuccess, setAiGeneratedSuccess] = useState(false);
  const [isPlayingAudio, setIsPlayingAudio] = useState(false);
  const [dictSource, setDictSource] = useState<'cambridge-offline' | 'indexeddb-cache' | 'online-fallback' | null>(null);

  const fileInputRef = useRef<HTMLInputElement>(null);
  const currentWordRef = useRef(word);
  currentWordRef.current = word;

  // Tải danh sách ảnh thực tế chất lượng cao (Unsplash, National Geographic, v.v.)
  const handleFetchRealPhotos = useCallback(async (targetWord: string, autoSelectFirst = false) => {
    const cleanWord = targetWord.trim();
    if (!cleanWord) return;
    setIsLoadingPhotos(true);
    try {
      const photos = await fetchRealVocabImages(cleanWord);
      if (photos.length > 0 && cleanWord.toLowerCase() === currentWordRef.current.trim().toLowerCase()) {
        setSuggestedPhotos(photos);
        if (autoSelectFirst) {
          setImageUrl((prev) => prev || photos[0]);
        }
      }
    } catch (err) {
      console.warn('Lỗi khi tải ảnh gợi ý:', err);
    } finally {
      setIsLoadingPhotos(false);
    }
  }, []);

  // Tự động tải gợi ý ảnh thực tế khi mở modal nếu đã có từ vựng
  useEffect(() => {
    if (word.trim()) {
      handleFetchRealPhotos(word.trim(), !imageUrl);
    }
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  // Tạo tranh minh họa AI bằng Pollinations FLUX Engine (1 chạm, miễn phí 100%)
  const handleGenerateAIImage = useCallback(async (customSeed?: number) => {
    const cleanWord = currentWordRef.current.trim();
    if (!cleanWord) {
      alert('Cô Ly vui lòng nhập từ vựng tiếng Anh trước để Mèo Cam vẽ tranh nha meow~ 🐾');
      return;
    }
    setIsGeneratingImage(true);
    try {
      const newSeed = customSeed ?? Math.floor(Math.random() * 900000) + 100000;
      const newUrl = generateVocabImageUrl({
        word: cleanWord,
        meaning,
        mnemonic: note,
        partOfSpeech,
        seed: newSeed,
      });
      await preloadImageUrl(newUrl);
      if (cleanWord.toLowerCase() === currentWordRef.current.trim().toLowerCase()) {
        setImageUrl(newUrl);
      }
    } catch (err) {
      console.warn('Lỗi khi vẽ ảnh minh họa AI:', err);
    } finally {
      setIsGeneratingImage(false);
    }
  }, [meaning, note, partOfSpeech]);

  // Phát âm trực tiếp tiếng Anh chuẩn
  const handlePlayAudio = (textToSpeak: string) => {
    if (!textToSpeak.trim()) return;
    setIsPlayingAudio(true);
    const audio = new Audio(`/api/tts?text=${encodeURIComponent(textToSpeak.trim())}&lang=en`);
    audio.onended = () => setIsPlayingAudio(false);
    audio.onerror = () => setIsPlayingAudio(false);
    audio.play().catch(() => setIsPlayingAudio(false));
  };

  // Tra cứu siêu tốc 0.001s từ điển Cambridge offline + IndexedDB cache
  const handleInstantLookup = useCallback(async (targetWord: string) => {
    const cleanWord = targetWord.trim();
    if (!cleanWord) return;

    setIsInstantLoading(true);
    try {
      const data = await lookupCambridgeInstant(cleanWord);
      // Chống Race condition: chỉ cập nhật nếu người dùng vẫn đang tra từ này
      if (cleanWord.toLowerCase() === currentWordRef.current.trim().toLowerCase()) {
        setWord(data.word);
        if (data.phonetic) setPhonetic(data.phonetic);
        if (data.partOfSpeech) setPartOfSpeech(data.partOfSpeech);
        if (data.meaning) setMeaning(data.meaning);
        if (data.exampleEn) setExampleEn(data.exampleEn);
        if (data.exampleVi) setExampleVi(data.exampleVi);
        setCambridgeUrl(data.cambridgeUrl);
        setGoogleTranslateUrl(data.googleTranslateUrl);
        setDictSource(data.source);

        // Tự động tìm nạp ảnh chụp thực tế thẩm mỹ cao thay vì tranh hoạt hình AI mờ
        handleFetchRealPhotos(cleanWord, true);
      }
    } catch (err) {
      console.warn('Lỗi tra cứu siêu tốc Cambridge:', err);
    } finally {
      setIsInstantLoading(false);
    }
  }, [handleFetchRealPhotos]);

  // AI Mèo Cam sáng tạo mẹo nhớ liên tưởng theo yêu cầu (On-Demand)
  const handleGenerateAIMnemonic = useCallback(async (targetWord: string) => {
    const cleanWord = targetWord.trim();
    if (!cleanWord) return;

    setIsGeneratingAI(true);
    setAiGeneratedSuccess(false);

    try {
      const storedKey = getStoredGeminiKey();
      const headers: Record<string, string> = { 'Content-Type': 'application/json' };
      if (storedKey) {
        headers['x-gemini-key'] = storedKey;
      }

      const res = await fetch('/api/gen-card', {
        method: 'POST',
        headers,
        body: JSON.stringify({
          word: cleanWord,
          context: contextSentence || initialData.contextSentence || '',
          apiKey: storedKey || undefined,
        }),
      });

      if (!res.ok) throw new Error('Không thể tạo mẹo nhớ AI');

      const data = await res.json();
      // Chống Race condition: chỉ cập nhật nếu đúng từ đang hiển thị
      if (cleanWord.toLowerCase() === currentWordRef.current.trim().toLowerCase()) {
        if (data.note || data.mnemonic) setNote(data.note || data.mnemonic);
        if (!phonetic && data.phonetic) setPhonetic(data.phonetic);
        if (!meaning && data.meaning) setMeaning(data.meaning);
        if (!exampleEn && data.exampleEn) setExampleEn(data.exampleEn);
        if (!exampleVi && data.exampleVi) setExampleVi(data.exampleVi);
        if (data.imageUrl) setImageUrl((prev) => prev || data.imageUrl);

        setAiGeneratedSuccess(true);
        setTimeout(() => setAiGeneratedSuccess(false), 3500);
      }
    } catch (err) {
      console.warn('Lỗi khi AI sáng tạo mẹo nhớ:', err);
    } finally {
      setIsGeneratingAI(false);
    }
  }, [contextSentence, initialData.contextSentence, phonetic, meaning, exampleEn, exampleVi]);

  // Nạp tức thì từ điển Cambridge ngay khi mở modal (0.001s, không phải chờ AI)
  useEffect(() => {
    if (!existing && initialData.word) {
      handleInstantLookup(initialData.word);
    }
  }, [existing, initialData.word, handleInstantLookup]);

  const handleImageFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (file.size > 5 * 1024 * 1024) {
      alert('Vui lòng chọn ảnh có kích thước dưới 5MB meow~ 🐾');
      return;
    }

    const reader = new FileReader();
    reader.onload = (event) => {
      if (event.target?.result) {
        setImageUrl(event.target.result as string);
      }
    };
    reader.readAsDataURL(file);
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!word.trim()) return;

    setIsSubmitting(true);
    try {
      const noteId = existing?.id || initialData.noteId || `note-${Date.now()}`;
      let finalImageUrl = imageUrl.trim();

      if (finalImageUrl && isSupabaseConfigured()) {
        try {
          const cloudUrl = await uploadBookImage(finalImageUrl, `notes/${noteId}.jpg`);
          if (cloudUrl) {
            finalImageUrl = cloudUrl;
          }
        } catch (err) {
          console.warn('Lỗi upload ảnh note lên Cloud:', err);
        }
      }

      const savedNote: VocabNote = {
        id: noteId,
        albumId: existing?.albumId || initialData.albumId,
        pageId: existing?.pageId || initialData.pageId,
        word: word.trim(),
        phonetic: phonetic.trim(),
        partOfSpeech: partOfSpeech.trim() || undefined,
        meaning: meaning.trim(),
        exampleEn: exampleEn.trim() || undefined,
        exampleVi: exampleVi.trim() || undefined,
        contextSentence: contextSentence.trim() || undefined,
        memoryType,
        note: note.trim(),
        imageUrl: finalImageUrl,
        cambridgeUrl: cambridgeUrl.trim(),
        status: existing?.status || 'learning',
        nextReviewDate: existing?.nextReviewDate ?? Date.now(),
        interval: existing?.interval ?? 1,
        repetitions: existing?.repetitions ?? 0,
        easeFactor: existing?.easeFactor ?? 2.5,
        lastReviewedAt: existing?.lastReviewedAt,
        createdAt: existing?.createdAt || Date.now(),
        updatedAt: Date.now(),
      };

      await db.vocabNotes.put(savedNote);

      // Ghi nhận hoạt động tích lũy từ vựng cho Streak Heatmap
      await recordReviewActivity(savedNote.id, 3);

      // Tự động đồng bộ với Supabase Cloud
      syncService.triggerSync(1000);

      // Pháo hoa ăn mừng cùng Mèo Cam
      try {
        confetti({
          particleCount: 60,
          spread: 70,
          origin: { y: 0.7 },
          colors: ['#fb923c', '#ea580c', '#38bdf8', '#fed7aa']
        });
      } catch {}

      if (onSaved) onSaved(savedNote);
      onClose();
    } catch (err) {
      console.error('Lỗi khi lưu ghi chú:', err);
      alert('Không thể lưu ghi chú, vui lòng thử lại meow~');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/50 backdrop-blur-sm p-2.5 sm:p-4 overflow-y-auto">
      <div className="bg-[#fffdfa] rounded-3xl border-2 border-orange-200 shadow-modal max-w-lg w-full max-h-[92vh] flex flex-col overflow-hidden my-auto animate-modal-in">
        {/* Header */}
        <div className="px-4 sm:px-6 py-3.5 sm:py-4 border-b border-orange-200 flex items-center justify-between bg-gradient-to-r from-orange-100 via-amber-50 to-orange-100 shrink-0">
          <div className="flex items-center gap-2.5 sm:gap-3">
            <CuteCat size={36} mood="reading" />
            <div>
              <h2 className="font-serif font-black text-lg sm:text-xl text-orange-950 flex items-center gap-1.5">
                {existing ? 'Sửa Thẻ Ghi Nhớ' : 'Tạo Thẻ Mẹo Nhớ Tự Động'} <span>🐾</span>
              </h2>
              <p className="text-[11px] sm:text-xs text-orange-800 font-medium">Mèo Cam tự động gen IPA, nghĩa tiếng Việt & mẹo nhớ :3</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-full text-orange-800 hover:bg-orange-200 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Thanh trạng thái AI đang tạo nội dung */}
        {isGeneratingAI && (
          <div className="px-4 sm:px-6 py-2.5 bg-gradient-to-r from-amber-100 to-orange-100 border-b border-orange-300 flex items-center gap-2 text-xs font-bold text-orange-950 animate-pulse shrink-0">
            <Loader2 className="w-4 h-4 animate-spin text-orange-600" />
            <span>Mèo Cam AI đang tự động gen IPA, nghĩa & mẹo nhớ cho Cô Ly... 🪄</span>
          </div>
        )}

        {/* Thông báo gen thành công */}
        {aiGeneratedSuccess && (
          <div className="px-4 sm:px-6 py-2 bg-emerald-100 border-b border-emerald-300 flex items-center gap-2 text-xs font-bold text-emerald-950 animate-in fade-in shrink-0">
            <Sparkles className="w-4 h-4 text-emerald-600 fill-current" />
            <span>Đã tự động gen xong toàn bộ IPA, nghĩa & mẹo nhớ xuất sắc! ✨</span>
          </div>
        )}

        {/* Form */}
        <form onSubmit={handleSave} className="flex flex-col flex-1 min-h-0 overflow-hidden">
          {/* Scrollable Form Body */}
          <div className="p-4 sm:p-6 space-y-3.5 sm:space-y-4 flex-1 overflow-y-auto min-h-0">
          {/* 1. TỪ VỰNG, PHÁT ÂM & IPA & LOẠI TỪ */}
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <label className="text-xs font-bold text-orange-950 flex items-center gap-1.5">
                <span>Từ / Cụm từ tiếng Anh *</span>
                {dictSource === 'cambridge-offline' && (
                  <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-800 border border-emerald-300">
                    ✓ Cambridge 0.001s
                  </span>
                )}
                {dictSource === 'indexeddb-cache' && (
                  <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-blue-100 text-blue-800 border border-blue-300">
                    ✓ Đã lưu đệm 0ms
                  </span>
                )}
              </label>

              <button
                type="button"
                onClick={() => handleInstantLookup(word)}
                disabled={isInstantLoading || !word.trim()}
                className="text-xs font-extrabold text-white bg-gradient-to-r from-orange-500 to-amber-500 hover:from-orange-600 hover:to-amber-600 px-3 py-1 rounded-xl shadow-xs flex items-center gap-1.5 transition-all active:scale-95 disabled:opacity-50 cursor-pointer"
              >
                {isInstantLoading ? (
                  <Loader2 className="w-3.5 h-3.5 animate-spin" />
                ) : (
                  <Sparkles className="w-3.5 h-3.5 text-amber-200" />
                )}
                <span>Tra Nhanh Cambridge ⚡</span>
              </button>
            </div>

            <div className="flex items-center gap-2">
              <input
                type="text"
                required
                autoFocus={!existing}
                value={word}
                onChange={(e) => setWord(e.target.value)}
                onBlur={() => {
                  if (word.trim() && !meaning) {
                    handleInstantLookup(word);
                  }
                }}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') {
                    e.preventDefault();
                    if (word.trim()) {
                      handleInstantLookup(word);
                    }
                  }
                }}
                placeholder="Ví dụ: extraordinary, resilience, masterpiece..."
                className="w-full px-3.5 py-2 rounded-2xl border-2 border-orange-300 bg-white text-orange-950 font-serif font-black text-base focus:ring-2 focus:ring-orange-500 focus:outline-none"
              />
              <button
                type="button"
                onClick={() => handlePlayAudio(word)}
                disabled={isPlayingAudio || !word.trim()}
                title="Nghe phát âm chuẩn tiếng Anh 🎧"
                className="p-2.5 rounded-2xl bg-orange-100 hover:bg-orange-200 text-orange-900 border-2 border-orange-300 transition-colors shrink-0 cursor-pointer"
              >
                <Volume2 className={`w-5 h-5 ${isPlayingAudio ? 'animate-bounce text-orange-600' : ''}`} />
              </button>
            </div>
            <p className="text-[11px] text-orange-800/80 font-medium">
              ⚡ Điền tự động tức thì (0.001s) chuẩn Cambridge! Gõ từ rồi nhấn <kbd className="px-1.5 py-0.5 rounded-md bg-orange-100 border border-orange-300 font-mono text-[10px] font-bold text-orange-900">Enter ↵</kbd>.
            </p>

            <div className="grid grid-cols-2 gap-2">
              {/* Phiên âm IPA */}
              <div className="relative">
                <input
                  type="text"
                  value={phonetic}
                  onChange={(e) => setPhonetic(e.target.value)}
                  placeholder="Phiên âm IPA (/.../)"
                  className="w-full px-3 py-1.5 rounded-xl border-2 border-orange-200 bg-white text-orange-950 font-mono text-xs focus:ring-2 focus:ring-orange-500 focus:outline-none font-bold"
                />
                <span className="absolute right-2.5 top-2 text-[10px] font-mono text-orange-400 font-bold pointer-events-none">
                  IPA
                </span>
              </div>

              {/* Từ loại */}
              <input
                type="text"
                value={partOfSpeech}
                onChange={(e) => setPartOfSpeech(e.target.value)}
                placeholder="Từ loại (vd: danh từ, tính từ...)"
                className="w-full px-3 py-1.5 rounded-xl border-2 border-orange-200 bg-white text-orange-950 text-xs focus:ring-2 focus:ring-orange-500 focus:outline-none font-bold"
              />
            </div>
          </div>

          {/* 2. ĐỊNH NGHĨA TIẾNG VIỆT */}
          <div>
            <label className="block text-xs font-bold text-orange-950 mb-1">
              Định nghĩa tiếng Việt *
            </label>
            <input
              type="text"
              required
              value={meaning}
              onChange={(e) => setMeaning(e.target.value)}
              placeholder="Phi thường, đặc biệt, xuất sắc..."
              className="w-full px-3.5 py-2 rounded-2xl border-2 border-orange-300 bg-white text-orange-950 text-sm font-bold focus:ring-2 focus:ring-orange-500 focus:outline-none"
            />
          </div>

          {/* 3. VÍ DỤ CÂU ANH - VIỆT (TEMPLATE CHUẨN) */}
          <div className="space-y-2 p-3 bg-orange-50/70 rounded-2xl border border-orange-200">
            <span className="text-xs font-bold text-orange-950 flex items-center gap-1">
              <BookOpen className="w-3.5 h-3.5 text-orange-600" /> Ví dụ câu thực tế (Anh - Việt):
            </span>
            <input
              type="text"
              value={exampleEn}
              onChange={(e) => setExampleEn(e.target.value)}
              placeholder="English example: She has an extraordinary talent."
              className="w-full px-3 py-1.5 rounded-xl border border-orange-200 bg-white text-orange-950 text-xs font-medium focus:ring-2 focus:ring-orange-500 focus:outline-none"
            />
            <input
              type="text"
              value={exampleVi}
              onChange={(e) => setExampleVi(e.target.value)}
              placeholder="Bản dịch tiếng Việt: Cô ấy có một tài năng phi thường."
              className="w-full px-3 py-1.5 rounded-xl border border-orange-200 bg-white text-orange-900 text-xs font-medium focus:ring-2 focus:ring-orange-500 focus:outline-none"
            />
          </div>

          {/* 4. NGỮ CẢNH TRONG SÁCH CỦA CÔ LY */}
          <div>
            <label className="block text-xs font-bold text-orange-950 mb-1 flex items-center justify-between">
              <span>Ngữ cảnh trích từ trang sách của Cô Ly</span>
              <span className="text-[10px] text-orange-600 font-medium">Gợi ý khi lật thẻ ôn tập</span>
            </label>
            <input
              type="text"
              value={contextSentence}
              onChange={(e) => setContextSentence(e.target.value)}
              placeholder="Câu văn gốc chứa từ này trong sách..."
              className="w-full px-3 py-2 rounded-xl border-2 border-orange-200 bg-white text-orange-950 text-xs italic focus:ring-2 focus:ring-orange-500 focus:outline-none"
            />
          </div>

          {/* 5. MẸO LIÊN TƯỞNG CỦA MÈO CAM */}
          <div>
            <div className="flex items-center justify-between mb-1.5">
              <label className="text-xs font-bold text-orange-950 flex items-center gap-1">
                <span>Mẹo liên tưởng & Câu chuyện ghi nhớ (Mnemonic)</span>
              </label>
              <button
                type="button"
                onClick={() => handleGenerateAIMnemonic(word)}
                disabled={isGeneratingAI || !word.trim()}
                className="text-xs font-black text-white bg-gradient-to-r from-purple-600 to-indigo-600 hover:from-purple-700 hover:to-indigo-700 px-3 py-1 rounded-xl shadow-xs flex items-center gap-1.5 transition-all active:scale-95 disabled:opacity-50 cursor-pointer"
              >
                {isGeneratingAI ? (
                  <>
                    <Loader2 className="w-3.5 h-3.5 animate-spin" />
                    <span>Mèo Cam đang sáng tạo...</span>
                  </>
                ) : (
                  <>
                    <Wand2 className="w-3.5 h-3.5 text-amber-300" />
                    <span>Nhờ Mèo Cam gen mẹo (AI) 🪄</span>
                  </>
                )}
              </button>
            </div>
            <textarea
              rows={3}
              value={note}
              onChange={(e) => setNote(e.target.value)}
              placeholder="Bấm nút [Nhờ Mèo Cam gen mẹo (AI) 🪄] hoặc tự viết mẹo liên tưởng, từ tượng thanh vui nhộn để nhớ từ này thật lâu nhé cô Ly..."
              className="w-full px-3.5 py-2 rounded-2xl border-2 border-orange-300 bg-white text-orange-950 text-xs leading-relaxed focus:ring-2 focus:ring-orange-500 focus:outline-none placeholder-orange-300 font-medium"
            />
          </div>

          {/* 6. CHỌN KIỂU NHỚ */}
          <div>
            <label className="block text-xs font-bold text-orange-950 mb-1.5 flex items-center gap-1">
              <Lightbulb className="w-4 h-4 text-orange-600" /> Phân loại kiểu nhớ:
            </label>
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
              {MEMORY_TYPES.map((t) => {
                const isSelected = memoryType === t.id;
                return (
                  <button
                    key={t.id}
                    type="button"
                    onClick={() => setMemoryType(t.id)}
                    className={`p-2 rounded-xl text-left border text-xs font-bold transition-all ${
                      isSelected
                        ? `${t.color} ring-2 ring-orange-500 shadow-sm scale-102`
                        : 'bg-white border-orange-200 text-orange-900 hover:bg-orange-50'
                    }`}
                  >
                    <div className="flex items-center gap-1.5">
                      <span>{t.icon}</span>
                      <span>{t.label}</span>
                    </div>
                  </button>
                );
              })}
            </div>
          </div>

          {/* Thêm ảnh minh họa (Visual Memory) */}
          <div>
            <label className="text-xs font-bold text-orange-950 mb-1.5 flex flex-wrap items-center justify-between gap-1.5">
              <span className="flex items-center gap-1">
                <ImageIcon className="w-4 h-4 text-orange-600" /> Ảnh minh họa (Visual Memory) 🐾
              </span>
              {imageUrl && (
                <div className="flex flex-wrap items-center gap-1.5">
                  <button
                    type="button"
                    onClick={() => handleFetchRealPhotos(word, false)}
                    disabled={isLoadingPhotos || !word.trim()}
                    className="text-[11px] sm:text-xs text-orange-700 hover:text-orange-950 flex items-center gap-1 font-bold bg-orange-100 hover:bg-orange-200 px-2 py-0.5 rounded-lg transition-colors cursor-pointer disabled:opacity-50 press-spring"
                  >
                    <RefreshCw className={`w-3.5 h-3.5 text-orange-600 ${isLoadingPhotos ? 'animate-spin' : ''}`} /> Đổi ảnh khác 📸
                  </button>
                  <button
                    type="button"
                    onClick={() => handleGenerateAIImage()}
                    disabled={isGeneratingImage || !word.trim()}
                    className="text-[11px] sm:text-xs text-amber-800 hover:text-amber-950 flex items-center gap-1 font-bold bg-amber-100 hover:bg-amber-200 px-2 py-0.5 rounded-lg transition-colors cursor-pointer disabled:opacity-50 press-spring"
                  >
                    <Dices className="w-3.5 h-3.5 text-amber-600" /> AI Masterpiece 🎨
                  </button>
                  <button
                    type="button"
                    onClick={() => setImageUrl('')}
                    className="text-[11px] sm:text-xs text-rose-600 hover:text-rose-800 flex items-center gap-0.5 font-bold cursor-pointer press-spring"
                  >
                    <Trash2 className="w-3.5 h-3.5" /> Xóa
                  </button>
                </div>
              )}
            </label>

            {/* Ảnh lớn đang chọn */}
            {imageUrl && (
              <div className="relative rounded-2xl overflow-hidden border-2 border-orange-200 max-h-48 bg-orange-50 flex items-center justify-center group shadow-sm mb-2">
                <img
                  src={imageUrl}
                  alt={word}
                  className="w-full h-44 object-cover"
                />
                {(isGeneratingImage || isLoadingPhotos) && (
                  <div className="absolute inset-0 bg-black/45 backdrop-blur-xs flex items-center justify-center text-white text-xs font-bold gap-2">
                    <Loader2 className="w-5 h-5 animate-spin text-amber-300" />
                    <span>{isGeneratingImage ? 'Mèo Cam đang vẽ tranh nghệ thuật...' : 'Đang nạp ảnh đẹp...'}</span>
                  </div>
                )}
              </div>
            )}

            {/* Khay 4 ảnh thực tế gợi ý (1 chạm đổi ngay) */}
            {(suggestedPhotos.length > 0 || isLoadingPhotos) && (
              <div className="p-2.5 rounded-2xl bg-orange-50/80 border border-orange-200/90 space-y-1.5 mb-2">
                <div className="flex items-center justify-between text-[11px] font-bold text-orange-950">
                  <span className="flex items-center gap-1">
                    <span>📸</span> Gợi ý ảnh nhiếp ảnh thực tế (1 chạm đổi):
                  </span>
                  {isLoadingPhotos && (
                    <span className="flex items-center gap-1 text-orange-600 text-[10px]">
                      <Loader2 className="w-3 h-3 animate-spin" /> Đang tìm kiếm...
                    </span>
                  )}
                </div>

                <div className="grid grid-cols-4 gap-2">
                  {suggestedPhotos.slice(0, 4).map((pUrl, idx) => {
                    const isSelected = pUrl === imageUrl;
                    return (
                      <button
                        key={`${pUrl}-${idx}`}
                        type="button"
                        onClick={() => setImageUrl(pUrl)}
                        className={`relative rounded-xl overflow-hidden border-2 aspect-4/3 group cursor-pointer transition-all ${
                          isSelected
                            ? 'border-orange-500 ring-2 ring-orange-400 scale-102 shadow-md'
                            : 'border-orange-200/80 hover:border-orange-400 opacity-80 hover:opacity-100 hover:scale-102'
                        }`}
                      >
                        <img src={pUrl} alt={`Gợi ý ${idx + 1}`} className="w-full h-full object-cover" />
                        {isSelected && (
                          <div className="absolute top-1 right-1 bg-orange-500 text-white rounded-full p-0.5 shadow-xs">
                            <Check className="w-2.5 h-2.5 stroke-[3]" />
                          </div>
                        )}
                      </button>
                    );
                  })}
                </div>
              </div>
            )}

            {/* Khi chưa có ảnh: Các tùy chọn tìm ảnh thực tế hoặc tạo AI */}
            {!imageUrl && (
              <div className="space-y-2">
                <div className="grid grid-cols-2 gap-2">
                  <button
                    type="button"
                    onClick={() => handleFetchRealPhotos(word, true)}
                    disabled={isLoadingPhotos || !word.trim()}
                    className="py-2.5 px-3 rounded-2xl bg-gradient-to-r from-orange-500 to-amber-500 hover:from-orange-600 hover:to-amber-600 text-white font-extrabold text-xs shadow-md shadow-orange-500/20 hover:scale-102 flex items-center justify-center gap-1.5 transition-all active:scale-98 disabled:opacity-50 cursor-pointer"
                  >
                    {isLoadingPhotos ? (
                      <>
                        <Loader2 className="w-3.5 h-3.5 animate-spin" />
                        <span>Đang tìm ảnh...</span>
                      </>
                    ) : (
                      <>
                        <span>📸</span>
                        <span>Tìm Ảnh Thực Tế ✨</span>
                      </>
                    )}
                  </button>

                  <button
                    type="button"
                    onClick={() => handleGenerateAIImage()}
                    disabled={isGeneratingImage || !word.trim()}
                    className="py-2.5 px-3 rounded-2xl bg-gradient-to-r from-amber-600 to-orange-600 hover:from-amber-700 hover:to-orange-700 text-white font-extrabold text-xs shadow-md shadow-orange-600/20 hover:scale-102 flex items-center justify-center gap-1.5 transition-all active:scale-98 disabled:opacity-50 cursor-pointer"
                  >
                    {isGeneratingImage ? (
                      <>
                        <Loader2 className="w-3.5 h-3.5 animate-spin" />
                        <span>Đang vẽ tranh...</span>
                      </>
                    ) : (
                      <>
                        <Sparkles className="w-3.5 h-3.5 text-amber-200 fill-current" />
                        <span>AI Masterpiece 🎨</span>
                      </>
                    )}
                  </button>
                </div>

                {/* Upload hoặc nhập link */}
                <div className="border border-orange-200 rounded-2xl p-2.5 bg-white/70 space-y-1.5">
                  <div
                    onClick={() => fileInputRef.current?.click()}
                    className="border border-dashed border-orange-200 rounded-xl p-2 text-center cursor-pointer hover:bg-orange-50 transition-colors"
                  >
                    <div className="flex items-center justify-center gap-1.5 text-xs font-bold text-orange-900">
                      <Upload className="w-3.5 h-3.5 text-orange-600" />
                      <span>Tải ảnh từ máy tính (hoặc dán link bên dưới)</span>
                    </div>
                  </div>
                  <input
                    type="file"
                    ref={fileInputRef}
                    accept="image/*"
                    onChange={handleImageFileChange}
                    className="hidden"
                  />
                  <input
                    type="text"
                    value={imageUrl}
                    onChange={(e) => setImageUrl(e.target.value)}
                    placeholder="Hoặc dán đường link ảnh vào đây..."
                    className="w-full px-3 py-1.5 rounded-xl border border-orange-200 bg-white text-xs text-orange-950 placeholder-orange-300 focus:outline-none focus:ring-1 focus:ring-orange-500"
                  />
                </div>
              </div>
            )}
          </div>

          {/* Link Tra cứu bổ trợ: Google Translate & Cambridge */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 pt-1">
            <a
              href={googleTranslateUrl}
              target="_blank"
              rel="noreferrer"
              className="px-3 py-2 rounded-xl bg-blue-50 border border-blue-200 text-blue-900 text-xs font-bold hover:bg-blue-100 flex items-center justify-between"
            >
              <span className="flex items-center gap-1.5">
                <Globe className="w-3.5 h-3.5 text-blue-600" />
                <span>Google Translate</span>
              </span>
              <ExternalLink className="w-3 h-3 text-blue-500" />
            </a>

            <a
              href={cambridgeUrl}
              target="_blank"
              rel="noreferrer"
              className="px-3 py-2 rounded-xl bg-red-50 border border-red-200 text-red-900 text-xs font-bold hover:bg-red-100 flex items-center justify-between"
            >
              <span className="flex items-center gap-1.5">
                <BookOpen className="w-3.5 h-3.5 text-red-600" />
                <span>Cambridge Dict</span>
              </span>
              <ExternalLink className="w-3 h-3 text-red-500" />
            </a>
          </div>
        </div>

        {/* Footer Actions - Pinned outside scrollable content */}
        <div className="px-6 py-3.5 border-t border-orange-200 bg-[#fffdfa] flex items-center justify-end gap-3 shrink-0">
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 rounded-2xl text-sm font-bold text-orange-900 hover:bg-orange-100 transition-colors press-spring"
          >
            Hủy
          </button>
          <button
            type="submit"
            disabled={isSubmitting || isGeneratingAI}
            className="px-6 py-2.5 rounded-2xl text-sm font-extrabold bg-gradient-to-r from-orange-500 to-amber-500 text-white shadow-md shadow-orange-500/20 flex items-center gap-2 disabled:opacity-50 press-spring cursor-pointer"
          >
            <Check className="w-4 h-4" />
            <span>{existing ? 'Lưu cập nhật 🐾' : 'Lưu thẻ ghi nhớ & Thưởng cá 🐟'}</span>
          </button>
        </div>
      </form>
    </div>
  </div>
  );
}

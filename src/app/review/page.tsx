'use client';

import React, { useState, useEffect, useCallback, useRef } from 'react';
import Link from 'next/link';
import {
  ArrowLeft,
  Volume2,
  Sparkles,
  BookOpen,
  RotateCw,
  Award,
  Lightbulb
} from 'lucide-react';
import confetti from 'canvas-confetti';
import { db, seedSampleDataIfEmpty } from '@/lib/db';
import { VocabNote, Album } from '@/types';
import { calculateSM2, formatNextReviewPreview, getDueCards, getDeckStats, SM2Rating } from '@/lib/sm2';
import { syncService } from '@/lib/syncService';
import { recordReviewActivity } from '@/lib/heatmapService';
import AnkiHeatmap from '@/components/review/AnkiHeatmap';
import CuteCat from '@/components/common/CuteCat';
import StreakBadge from '@/components/common/StreakBadge';

export default function ReviewPage() {
  const [allNotes, setAllNotes] = useState<VocabNote[]>([]);
  const [albums, setAlbums] = useState<Album[]>([]);
  const [selectedAlbumId, setSelectedAlbumId] = useState<string>('all');
  const [reviewQueue, setReviewQueue] = useState<VocabNote[]>([]);
  const [currentIndex, setCurrentIndex] = useState<number>(0);
  const [isFlipped, setIsFlipped] = useState<boolean>(false);
  const [isFinished, setIsFinished] = useState<boolean>(false);
  const [reviewedCount, setReviewedCount] = useState<number>(0);
  const [isPlayingAudio, setIsPlayingAudio] = useState<boolean>(false);

  const audioRef = useRef<HTMLAudioElement | null>(null);

  // Nạp dữ liệu từ vựng & albums
  const loadData = useCallback(async () => {
    await seedSampleDataIfEmpty();
    const notes = await db.vocabNotes.toArray();
    const albumList = await db.albums.toArray();
    setAllNotes(notes);
    setAlbums(albumList);

    // Lọc theo album nếu có
    const filtered = selectedAlbumId === 'all'
      ? notes
      : notes.filter((n) => n.albumId === selectedAlbumId);

    const due = getDueCards(filtered);
    setReviewQueue(due);
    setCurrentIndex(0);
    setIsFlipped(false);
    setIsFinished(due.length === 0);
  }, [selectedAlbumId]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  // Phát âm thanh tiếng Anh
  const playWordAudio = useCallback((textToSpeak: string) => {
    if (!textToSpeak.trim()) return;
    if (audioRef.current) {
      audioRef.current.pause();
      audioRef.current = null;
    }

    setIsPlayingAudio(true);
    const audio = new Audio(`/api/tts?text=${encodeURIComponent(textToSpeak.trim())}&lang=en`);
    audioRef.current = audio;
    audio.onended = () => setIsPlayingAudio(false);
    audio.onerror = () => setIsPlayingAudio(false);
    audio.play().catch(() => setIsPlayingAudio(false));
  }, []);

  const currentCard = reviewQueue[currentIndex];

  // Tự động phát âm thanh khi lật thẻ sang mặt sau
  useEffect(() => {
    if (isFlipped && currentCard) {
      playWordAudio(currentCard.word);
    }
  }, [isFlipped, currentCard, playWordAudio]);

  // Xử lý đánh giá SM-2 khi Cô Ly bấm 1 trong 4 nút
  const handleRating = useCallback(async (rating: SM2Rating) => {
    if (!currentCard) return;

    const sm2Update = calculateSM2(currentCard, rating);

    // Cập nhật thẻ vào IndexedDB
    await db.vocabNotes.update(currentCard.id, {
      ...sm2Update,
      updatedAt: Date.now(),
    });

    // Ghi nhận lượt ôn tập vào Anki Heatmap & Streak
    await recordReviewActivity(currentCard.id, rating);

    // Cập nhật state local
    setAllNotes((prev) =>
      prev.map((n) => (n.id === currentCard.id ? { ...n, ...sm2Update } : n))
    );

    // Kích hoạt đồng bộ ngầm
    syncService.triggerSync(1500);

    setReviewedCount((prev) => prev + 1);

    // XỬ LÝ HÀNG ĐỢI ÔN TẬP CHUẨN ANKI:
    // Nếu bấm "Học lại" (Again - Rating 1): Đẩy thẻ về cuối hàng đợi để học lại trước khi kết thúc phiên
    if (rating === 1) {
      setReviewQueue((prev) => [...prev, { ...currentCard, ...sm2Update }]);
      setIsFlipped(false);
      setCurrentIndex((prev) => prev + 1);
    } else {
      // Chuyển sang thẻ tiếp theo
      if (currentIndex + 1 < reviewQueue.length) {
        setIsFlipped(false);
        setCurrentIndex((prev) => prev + 1);
      } else {
        setIsFinished(true);
        // Bắn pháo hoa ăn mừng khi hoàn thành tất cả thẻ
        try {
          confetti({
            particleCount: 100,
            spread: 80,
            origin: { y: 0.6 },
            colors: ['#f97316', '#fbbf24', '#38bdf8', '#10b981'],
          });
        } catch {}
      }
    }
  }, [currentCard, currentIndex, reviewQueue.length]);

  // Hỗ trợ phím tắt Space (Lật thẻ) và 1, 2, 3, 4 (Đánh giá)
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (isFinished || !currentCard) return;

      if (e.code === 'Space') {
        e.preventDefault();
        setIsFlipped((prev) => !prev);
      } else if (isFlipped) {
        if (e.key === '1') handleRating(1);
        else if (e.key === '2') handleRating(2);
        else if (e.key === '3') handleRating(3);
        else if (e.key === '4') handleRating(4);
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isFlipped, isFinished, currentCard, handleRating]);

  // Thống kê thẻ cho Album đang chọn
  const filteredNotes = selectedAlbumId === 'all'
    ? allNotes
    : allNotes.filter((n) => n.albumId === selectedAlbumId);
  const deckStats = getDeckStats(filteredNotes);

  return (
    <div className="max-w-3xl mx-auto px-4 py-8 space-y-6">
      {/* Header Điều Hướng */}
      <div className="flex items-center justify-between">
        <Link
          href="/notes"
          className="inline-flex items-center gap-1.5 text-xs text-orange-800 hover:text-orange-950 font-bold bg-orange-100/70 hover:bg-orange-200 px-3.5 py-2 rounded-2xl border border-orange-200 transition-colors"
        >
          <ArrowLeft className="w-4 h-4" /> Về Sổ Mẹo Nhớ
        </Link>

        {/* Bộ lọc theo cuốn sách */}
        <div className="flex items-center gap-2">
          <BookOpen className="w-4 h-4 text-orange-600" />
          <select
            value={selectedAlbumId}
            onChange={(e) => setSelectedAlbumId(e.target.value)}
            className="text-xs font-bold text-orange-950 bg-white border-2 border-orange-300 rounded-2xl px-3 py-1.5 focus:outline-none focus:ring-2 focus:ring-orange-500 shadow-2xs"
          >
            <option value="all">📚 Toàn bộ tủ sách ({allNotes.length})</option>
            {albums.map((a) => (
              <option key={a.id} value={a.id}>
                📖 {a.title}
              </option>
            ))}
          </select>
        </div>
      </div>

      {/* Chuỗi Học Tập (Streak Day) Nổi Bật */}
      <StreakBadge variant="banner" />

      {/* Thống kê chuẩn Anki */}
      <div className="bg-[#fffdfa] rounded-3xl p-4 border-2 border-orange-200 shadow-xs flex items-center justify-around text-center">
        <div>
          <span className="block text-xl font-black text-rose-600 font-mono">
            {deckStats.due}
          </span>
          <span className="text-[11px] font-bold text-orange-900 flex items-center justify-center gap-1">
            <span className="w-2 h-2 rounded-full bg-rose-500"></span> Cần ôn hôm nay
          </span>
        </div>
        <div className="h-8 w-px bg-orange-200" />
        <div>
          <span className="block text-xl font-black text-amber-600 font-mono">
            {deckStats.learning}
          </span>
          <span className="text-[11px] font-bold text-orange-900 flex items-center justify-center gap-1">
            <span className="w-2 h-2 rounded-full bg-amber-500"></span> Đang học
          </span>
        </div>
        <div className="h-8 w-px bg-orange-200" />
        <div>
          <span className="block text-xl font-black text-emerald-600 font-mono">
            {deckStats.mastered}
          </span>
          <span className="text-[11px] font-bold text-orange-900 flex items-center justify-center gap-1">
            <span className="w-2 h-2 rounded-full bg-emerald-500"></span> Đã thuộc 🐟
          </span>
        </div>
      </div>

      {/* MÀN HÌNH HOÀN THÀNH PHIÊN ÔN TẬP */}
      {isFinished ? (
        <div className="bg-[#fffdfa] rounded-3xl border-4 border-orange-300 shadow-xl p-8 text-center space-y-6 animate-in zoom-in-95">
          <div className="relative inline-block">
            <CuteCat size={96} mood="reading" className="mx-auto" />
            <Sparkles className="w-8 h-8 text-amber-500 absolute -top-2 -right-2 animate-bounce" />
          </div>

          <div className="space-y-2">
            <h2 className="font-serif font-black text-2xl sm:text-3xl text-orange-950">
              Tuyệt Vời Cô Ly Ơi! 🐾
            </h2>
            <p className="text-sm text-orange-800 font-medium max-w-md mx-auto leading-relaxed">
              Cô đã hoàn thành toàn bộ thẻ ôn tập của hôm nay! Mèo Cam đã tính toán nhịp lặp lại ngắt quãng (SM-2) để ghi nhớ vào trí nhớ dài hạn.
            </p>
          </div>

          <div className="inline-flex items-center gap-2 px-5 py-2.5 rounded-2xl bg-orange-100 text-orange-950 text-sm font-bold border border-orange-300">
            <Award className="w-5 h-5 text-orange-600" />
            <span>Đã hoàn thành {reviewedCount} lượt ôn tập xuất sắc!</span>
          </div>

          <div className="flex items-center justify-center gap-3 pt-2">
            <button
              onClick={() => {
                // Ôn lại toàn bộ thẻ
                setReviewQueue(filteredNotes);
                setCurrentIndex(0);
                setIsFlipped(false);
                setIsFinished(false);
              }}
              className="px-5 py-2.5 rounded-2xl text-xs sm:text-sm font-bold text-orange-900 bg-orange-100 hover:bg-orange-200 border-2 border-orange-300 transition-colors flex items-center gap-1.5 cursor-pointer"
            >
              <RotateCw className="w-4 h-4" /> Ôn lại toàn bộ thẻ
            </button>
            <Link
              href="/notes"
              className="px-6 py-2.5 rounded-2xl text-xs sm:text-sm font-black text-white bg-gradient-to-r from-orange-500 to-amber-500 hover:scale-105 shadow-md shadow-orange-500/20 transition-all flex items-center gap-1.5"
            >
              Xem Sổ Mẹo Nhớ 📖
            </Link>
          </div>
        </div>
      ) : currentCard ? (
        /* MÀN HÌNH THẺ FLASHCARD 3D */
        <div className="space-y-5">
          {/* Thanh Tiến Độ */}
          <div className="flex items-center justify-between text-xs font-bold text-orange-900">
            <span>
              Thẻ {currentIndex + 1} / {reviewQueue.length}
            </span>
            <span className="text-[11px] text-orange-700 font-medium">
              Phím tắt: Space để lật thẻ • Phím 1, 2, 3, 4 để đánh giá
            </span>
          </div>
          <div className="w-full bg-orange-100 h-2.5 rounded-full overflow-hidden border border-orange-200">
            <div
              className="bg-gradient-to-r from-orange-500 to-amber-500 h-full transition-all duration-300 rounded-full"
              style={{
                width: `${((currentIndex + 1) / reviewQueue.length) * 100}%`,
              }}
            />
          </div>

          {/* Khung thẻ Flashcard chính (Áp dụng Emil Kowalski Motion Design: 260ms ease-out) */}
          <div
            key={currentIndex}
            onClick={() => !isFlipped && setIsFlipped(true)}
            style={{
              transition: 'transform 260ms var(--ease-out), box-shadow 260ms var(--ease-out), border-color 260ms var(--ease-out)',
            }}
            className={`min-h-[360px] bg-[#fffdfa] rounded-3xl border-4 border-orange-300 shadow-xl p-6 sm:p-8 flex flex-col justify-between ${
              !isFlipped ? 'cursor-pointer hover:border-orange-400 hover:shadow-2xl hover:-translate-y-1' : ''
            }`}
          >
            {/* Top Bar của Thẻ */}
            <div className="flex items-center justify-between pb-4 border-b border-orange-100">
              <span className="text-xs font-bold px-3 py-1 rounded-full bg-orange-100 text-orange-800 border border-orange-200 flex items-center gap-1">
                <span>🐾</span> Mèo Cam Flashcard
              </span>
              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  playWordAudio(currentCard.word);
                }}
                title="Phát âm tiếng Anh chuẩn 🎧"
                className="p-2 rounded-2xl bg-orange-100 hover:bg-orange-200 text-orange-900 border border-orange-300 transition-colors cursor-pointer"
              >
                <Volume2 className={`w-4 h-4 ${isPlayingAudio ? 'animate-bounce text-orange-600' : ''}`} />
              </button>
            </div>

            {/* NỘI DUNG MẶT TRƯỚC (QUESTION) */}
            {!isFlipped ? (
              <div className="py-10 text-center space-y-4 my-auto">
                {currentCard.partOfSpeech && (
                  <span className="text-xs font-bold text-orange-700 bg-orange-100/60 px-3 py-1 rounded-full border border-orange-200">
                    {currentCard.partOfSpeech}
                  </span>
                )}
                <h1 className="font-serif font-black text-4xl sm:text-5xl text-orange-950 tracking-tight">
                  {currentCard.word}
                </h1>

                {/* Ngữ cảnh câu trong sách (nếu có) */}
                {currentCard.contextSentence && (
                  <p className="text-sm italic text-orange-900/80 max-w-lg mx-auto bg-amber-50/60 p-3 rounded-2xl border border-amber-200/80 leading-relaxed font-serif">
                    &ldquo;{currentCard.contextSentence}&rdquo;
                  </p>
                )}

                <div className="pt-4">
                  <span className="inline-flex items-center gap-2 px-5 py-2.5 rounded-2xl bg-orange-500 text-white font-bold text-sm shadow-md hover:bg-orange-600 transition-colors">
                    <RotateCw className="w-4 h-4" /> Bấm để lật thẻ (Space)
                  </span>
                </div>
              </div>
            ) : (
              /* NỘI DUNG MẶT SAU (ANSWER & TEMPLATE CHUẨN) */
              <div className="py-4 space-y-4 my-auto animate-in fade-in duration-200">
                {/* Header mặt sau: Từ vựng + IPA */}
                <div className="text-center space-y-1">
                  <div className="flex items-center justify-center gap-2">
                    <h2 className="font-serif font-black text-3xl sm:text-4xl text-orange-950">
                      {currentCard.word}
                    </h2>
                    {currentCard.partOfSpeech && (
                      <span className="text-xs font-bold text-orange-800 bg-orange-100 px-2.5 py-0.5 rounded-full border border-orange-200">
                        {currentCard.partOfSpeech}
                      </span>
                    )}
                  </div>
                  {currentCard.phonetic && (
                    <p className="font-mono text-base font-bold text-orange-600">
                      {currentCard.phonetic}
                    </p>
                  )}
                </div>

                {/* Định nghĩa tiếng Việt */}
                <div className="text-center bg-orange-100/70 p-3 rounded-2xl border border-orange-300">
                  <p className="text-base sm:text-lg font-black text-orange-950">
                    {currentCard.meaning}
                  </p>
                </div>

                {/* Ví dụ câu Anh - Việt */}
                {currentCard.exampleEn && (
                  <div className="bg-amber-50 p-3 rounded-2xl border border-amber-200 space-y-1">
                    <p className="text-xs font-bold text-amber-950 flex items-center gap-1">
                      <BookOpen className="w-3.5 h-3.5 text-amber-700" /> Ví dụ câu thực tế:
                    </p>
                    <p className="text-xs sm:text-sm font-serif font-bold text-orange-950">
                      &ldquo;{currentCard.exampleEn}&rdquo;
                    </p>
                    {currentCard.exampleVi && (
                      <p className="text-xs text-orange-800 italic">
                        ({currentCard.exampleVi})
                      </p>
                    )}
                  </div>
                )}

                {/* Mẹo nhớ độc đáo của Mèo Cam */}
                {currentCard.note && (
                  <div className="bg-purple-50 p-3 rounded-2xl border border-purple-200 space-y-0.5">
                    <p className="text-xs font-bold text-purple-950 flex items-center gap-1">
                      <Lightbulb className="w-3.5 h-3.5 text-purple-700" /> Mẹo liên tưởng của Mèo Cam:
                    </p>
                    <p className="text-xs text-purple-900 leading-relaxed font-medium">
                      {currentCard.note}
                    </p>
                  </div>
                )}

                {/* Ảnh minh họa nếu có */}
                {currentCard.imageUrl && (
                  <div className="rounded-2xl overflow-hidden max-h-32 border border-orange-200">
                    <img
                      src={currentCard.imageUrl}
                      alt={currentCard.word}
                      className="w-full h-32 object-cover"
                    />
                  </div>
                )}
              </div>
            )}

            {/* Bottom: Hướng dẫn hoặc 4 Nút Đánh Giá SM-2 */}
            <div className="pt-4 border-t border-orange-100">
              {!isFlipped ? (
                <p className="text-center text-xs text-orange-700 font-medium">
                  💡 Nhẩm nghĩa trong đầu rồi bấm thẻ hoặc phím Space để kiểm tra nhé!
                </p>
              ) : (
                <div className="space-y-2">
                  <p className="text-center text-xs font-bold text-orange-950">
                    Cô Ly nhớ từ này như thế nào? (Bấm số 1, 2, 3, 4)
                  </p>
                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                    {/* Nút 1: Học lại */}
                    <button
                      type="button"
                      onClick={() => handleRating(1)}
                      className="p-2.5 rounded-2xl bg-rose-50 hover:bg-rose-100 border-2 border-rose-300 text-rose-950 text-center press-spring hover:scale-102 hover:shadow-xs cursor-pointer"
                    >
                      <span className="block text-xs font-black">🔴 Học lại (1)</span>
                      <span className="block text-[10px] text-rose-700 font-mono mt-0.5">
                        {formatNextReviewPreview(currentCard, 1)}
                      </span>
                    </button>

                    {/* Nút 2: Khó */}
                    <button
                      type="button"
                      onClick={() => handleRating(2)}
                      className="p-2.5 rounded-2xl bg-amber-50 hover:bg-amber-100 border-2 border-amber-300 text-amber-950 text-center press-spring hover:scale-102 hover:shadow-xs cursor-pointer"
                    >
                      <span className="block text-xs font-black">🟠 Khó (2)</span>
                      <span className="block text-[10px] text-amber-700 font-mono mt-0.5">
                        {formatNextReviewPreview(currentCard, 2)}
                      </span>
                    </button>

                    {/* Nút 3: Tốt */}
                    <button
                      type="button"
                      onClick={() => handleRating(3)}
                      className="p-2.5 rounded-2xl bg-emerald-50 hover:bg-emerald-100 border-2 border-emerald-300 text-emerald-950 text-center press-spring hover:scale-102 hover:shadow-sm cursor-pointer"
                    >
                      <span className="block text-xs font-black">🟢 Tốt (3)</span>
                      <span className="block text-[10px] text-emerald-700 font-mono mt-0.5">
                        {formatNextReviewPreview(currentCard, 3)}
                      </span>
                    </button>

                    {/* Nút 4: Dễ */}
                    <button
                      type="button"
                      onClick={() => handleRating(4)}
                      className="p-2.5 rounded-2xl bg-sky-50 hover:bg-sky-100 border-2 border-sky-300 text-sky-950 text-center press-spring hover:scale-102 hover:shadow-xs cursor-pointer"
                    >
                      <span className="block text-xs font-black">🔵 Dễ (4)</span>
                      <span className="block text-[10px] text-sky-700 font-mono mt-0.5">
                        {formatNextReviewPreview(currentCard, 4)}
                      </span>
                    </button>
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      ) : null}

      {/* Biểu Đồ Chuỗi Ngày Học Anki Heatmap & Streak */}
      <div className="pt-2">
        <AnkiHeatmap key={reviewedCount} />
      </div>
    </div>
  );
}

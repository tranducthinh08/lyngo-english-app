'use client';

import React, { useState, useEffect } from 'react';
import Link from 'next/link';
import { useParams } from 'next/navigation';
import {
  ArrowLeft,
  Headphones,
  Image as ImageIcon,
  BookmarkCheck,
  Edit3,
  Check,
  X
} from 'lucide-react';
import { db } from '@/lib/db';
import { PageItem, Album, VocabNote } from '@/types';
import { syncService } from '@/lib/syncService';
import { useTextToSpeech } from '@/hooks/useTextToSpeech';
import { getReaderFontSize, getReaderSerifMode } from '@/lib/settings';
import InteractiveText from '@/components/reader/InteractiveText';
import DictionaryPopover from '@/components/reader/DictionaryPopover';
import NoteEditorModal from '@/components/notes/NoteEditorModal';
import AudioVoiceBar from '@/components/reader/AudioVoiceBar';
import CuteCat from '@/components/common/CuteCat';

export default function ReaderPage() {
  const params = useParams();
  const pageId = params?.pageId as string;

  const [page, setPage] = useState<PageItem | null>(null);
  const [album, setAlbum] = useState<Album | null>(null);
  const [notes, setNotes] = useState<VocabNote[]>([]);
  const [showOriginalImage, setShowOriginalImage] = useState(false);

  // Chế độ chỉnh sửa văn bản trang sách trực tiếp
  const [isEditingText, setIsEditingText] = useState(false);
  const [editTextValue, setEditTextValue] = useState('');

  const [fontSize, setFontSize] = useState(18);
  const [isSerif, setIsSerif] = useState(true);

  const [selectedWordInfo, setSelectedWordInfo] = useState<{
    word: string;
    position: { x: number; y: number };
  } | null>(null);

  const [editingNoteData, setEditingNoteData] = useState<{
    word: string;
    phonetic?: string;
    meaning?: string;
    cambridgeUrl?: string;
    googleTranslateUrl?: string;
    albumId?: string;
    pageId?: string;
    existingNote?: VocabNote;
  } | null>(null);

  const tts = useTextToSpeech(page?.extractedText || '');

  useEffect(() => {
    if (!pageId) return;

    db.pages.get(pageId).then(async (p) => {
      if (p) {
        setPage(p);
        setEditTextValue(p.extractedText);
        if (p.albumId) {
          const a = await db.albums.get(p.albumId);
          if (a) setAlbum(a);
        }
        const pageNotes = await db.vocabNotes.filter(n => n.pageId === p.id || n.albumId === p.albumId).toArray();
        setNotes(pageNotes);
      }
    });

    setFontSize(getReaderFontSize());
    setIsSerif(getReaderSerifMode());
  }, [pageId]);

  const refreshNotes = async () => {
    if (!page) return;
    const pageNotes = await db.vocabNotes.filter(n => n.pageId === page.id || n.albumId === page.albumId).toArray();
    setNotes(pageNotes);
  };

  const handleSaveEditedText = async () => {
    if (!page) return;
    const newText = editTextValue.trim();
    if (!newText) {
      alert('Văn bản không được để trống meow~');
      return;
    }
    await db.pages.update(page.id, {
      extractedText: newText,
      updatedAt: Date.now(),
    });
    syncService.triggerSync(1000);
    setPage({ ...page, extractedText: newText });
    setIsEditingText(false);
  };

  if (!page) {
    return (
      <div className="max-w-4xl mx-auto px-4 py-16 text-center space-y-4">
        <CuteCat size={80} mood="reading" className="mx-auto" />
        <p className="text-orange-950 font-serif font-bold text-lg">Mèo Cam đang chuẩn bị trang sách cho Cô Ly...</p>
        <Link href="/" className="inline-flex items-center gap-1.5 text-xs text-orange-700 underline font-bold">
          <ArrowLeft className="w-4 h-4" /> Quay lại Tủ sách
        </Link>
      </div>
    );
  }

  const currentSentenceText = (tts.currentSentenceIndex >= 0 && tts.sentences[tts.currentSentenceIndex])
    ? tts.sentences[tts.currentSentenceIndex]
    : '';

  return (
    <div className="min-h-screen bg-[#fffbf5] pb-32">
      {/* Top Header / Breadcrumb */}
      <div className="sticky top-16 z-30 bg-[#fffbf5]/95 backdrop-blur-md border-b-2 border-orange-200/80 px-4 py-3">
        <div className="max-w-5xl mx-auto flex items-center justify-between gap-3">
          {/* Breadcrumb */}
          <div className="flex items-center gap-2 text-xs text-orange-800 truncate font-medium">
            <Link href="/" className="hover:text-orange-950 font-bold flex items-center gap-1 text-orange-700">
              <ArrowLeft className="w-3.5 h-3.5" /> 🐾 Tủ Sách
            </Link>
            <span>/</span>
            <span className="font-bold text-orange-950 truncate max-w-[140px] sm:max-w-xs">
              {album?.title || 'Sách'}
            </span>
            <span>/</span>
            <span className="text-orange-700">{page.title}</span>
          </div>

          {/* Quick Actions Bar */}
          <div className="flex items-center gap-2">
            {/* Nút sửa văn bản nếu có lỗi OCR */}
            <button
              onClick={() => {
                if (!isEditingText) setEditTextValue(page.extractedText);
                setIsEditingText(!isEditingText);
              }}
              title="Chỉnh sửa văn bản trong ô nếu cần"
              className={`flex items-center gap-1 px-3 py-1.5 rounded-2xl text-xs font-bold border-2 transition-all ${
                isEditingText
                  ? 'bg-amber-600 text-white border-amber-700 shadow-sm'
                  : 'bg-white text-orange-900 border-orange-200 hover:bg-orange-50'
              }`}
            >
              <Edit3 className="w-3.5 h-3.5" />
              <span className="hidden sm:inline">{isEditingText ? 'Đang sửa' : 'Sửa chữ'}</span>
            </button>

            {page.originalImage && (
              <button
                onClick={() => setShowOriginalImage(!showOriginalImage)}
                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-2xl text-xs font-bold border-2 transition-all ${
                  showOriginalImage
                    ? 'bg-orange-600 text-white border-orange-700 shadow-sm'
                    : 'bg-white text-orange-900 border-orange-200 hover:bg-orange-50'
                }`}
              >
                <ImageIcon className="w-3.5 h-3.5" />
                <span className="hidden sm:inline">Ảnh sách gốc</span>
              </button>
            )}

            {/* Điều chỉnh cỡ chữ */}
            <div className="flex items-center bg-white border-2 border-orange-200 rounded-2xl px-2 py-0.5 shadow-2xs">
              <button
                onClick={() => setFontSize(Math.max(16, fontSize - 2))}
                title="Giảm cỡ chữ"
                className="px-1.5 py-0.5 text-xs font-black text-orange-800 hover:text-orange-950"
              >
                A-
              </button>
              <span className="text-[11px] text-orange-600 px-1 font-mono font-bold">{fontSize}</span>
              <button
                onClick={() => setFontSize(Math.min(26, fontSize + 2))}
                title="Tăng cỡ chữ"
                className="px-1.5 py-0.5 text-xs font-black text-orange-800 hover:text-orange-950"
              >
                A+
              </button>
            </div>

            {/* Badge đếm số từ đã note */}
            <div className="flex items-center gap-1 px-3 py-1.5 rounded-2xl bg-orange-100 text-orange-900 border border-orange-300 text-xs font-bold shadow-2xs">
              <BookmarkCheck className="w-3.5 h-3.5 text-orange-600" />
              <span>{notes.length} từ note 🐾</span>
            </div>
          </div>
        </div>
      </div>

      {/* Main Reading Room */}
      <main className="max-w-4xl mx-auto px-4 py-8 space-y-6">
        {/* Banner Bong Bóng Mèo Cam Hướng Dẫn */}
        <div className="bg-gradient-to-r from-orange-100 via-amber-50 to-orange-100 border-2 border-orange-300 rounded-3xl p-4 text-xs text-orange-950 flex flex-col sm:flex-row items-center justify-between gap-4 shadow-sm">
          <div className="flex items-center gap-3">
            <CuteCat size={48} mood="reading" className="shrink-0" />
            <div className="space-y-0.5">
              <span className="font-extrabold text-orange-900 flex items-center gap-1">
                <span>🐾</span> Lời nhắn từ Mèo Cam:
              </span>
              <p className="text-orange-950 font-medium leading-relaxed">
                Cô Ly <strong>nhấp đúp chuột</strong> vào từ để tra Cambridge Dictionary, hoặc <strong>rê chuột vào câu</strong> rồi bấm biểu tượng 🎧 để Mèo Cam đọc riêng câu đó nhé meow!
              </p>
            </div>
          </div>

          <button
            onClick={() => tts.play(0)}
            className="shrink-0 px-4 py-2 rounded-2xl bg-gradient-to-r from-orange-500 to-amber-500 text-white font-bold hover:scale-105 flex items-center gap-1.5 shadow-md shadow-orange-500/20 transition-all text-xs active:scale-95"
          >
            <Headphones className="w-4 h-4" />
            <span>Mèo Cam Đọc Toàn Bài 🎧</span>
          </button>
        </div>

        {/* View Đối chiếu 2 cột nếu bật xem ảnh gốc */}
        <div className={`grid gap-6 ${showOriginalImage ? 'grid-cols-1 lg:grid-cols-2' : 'grid-cols-1'}`}>
          {showOriginalImage && page.originalImage && (
            <div className="bg-white rounded-3xl p-5 border-2 border-orange-200/90 shadow-md space-y-3 sticky top-32 max-h-[80vh] overflow-y-auto">
              <div className="flex items-center justify-between pb-2 border-b border-orange-100">
                <span className="text-xs font-black text-orange-950 flex items-center gap-1.5">
                  <ImageIcon className="w-4 h-4 text-orange-600" /> Ảnh sách giấy gốc (Đối chiếu)
                </span>
                <span className="text-[11px] text-orange-700 font-bold">🐾 Trang thật</span>
              </div>
              <img
                src={page.originalImage}
                alt="Ảnh chụp sách gốc"
                className="w-full rounded-2xl object-contain shadow-xs border border-orange-100"
              />
            </div>
          )}

          {/* Cột Trang Sách Tương Tác Số Hóa */}
          <div className="bg-[#fffefc] rounded-3xl p-6 sm:p-10 border-2 border-orange-200/90 shadow-xl shadow-orange-950/5 min-h-[500px]">
            {/* Header trang sách */}
            <div className="text-center pb-6 mb-8 border-b-2 border-orange-100 space-y-1">
              <span className="text-xs font-sans uppercase tracking-widest text-orange-700 font-extrabold flex items-center justify-center gap-1">
                <span>🐾</span> {album?.title || 'Sách'} • Trang {page.pageNumber || 1} <span>🐾</span>
              </span>
              <h1 className="font-serif font-black text-2xl sm:text-3xl text-orange-950">
                {page.title}
              </h1>
            </div>

            {/* Khung sửa văn bản trực tiếp (nếu đang bật chế độ sửa) */}
            {isEditingText ? (
              <div className="space-y-4 p-4 rounded-2xl bg-orange-50 border-2 border-orange-300">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-extrabold text-orange-950 flex items-center gap-1">
                    <Edit3 className="w-4 h-4 text-orange-600" /> Chỉnh sửa văn bản trang sách:
                  </span>
                  <div className="flex gap-2">
                    <button
                      onClick={() => setIsEditingText(false)}
                      className="px-3 py-1 rounded-xl bg-gray-200 hover:bg-gray-300 text-xs font-bold text-gray-800 flex items-center gap-1"
                    >
                      <X className="w-3.5 h-3.5" /> Hủy
                    </button>
                    <button
                      onClick={handleSaveEditedText}
                      className="px-3 py-1 rounded-xl bg-orange-500 hover:bg-orange-600 text-xs font-bold text-white flex items-center gap-1 shadow-sm"
                    >
                      <Check className="w-3.5 h-3.5" /> Lưu Thay Đổi
                    </button>
                  </div>
                </div>
                <textarea
                  rows={14}
                  value={editTextValue}
                  onChange={(e) => setEditTextValue(e.target.value)}
                  className="w-full p-3 rounded-xl border-2 border-orange-200 bg-white text-orange-950 font-serif text-base leading-relaxed focus:outline-none focus:ring-2 focus:ring-orange-500"
                />
              </div>
            ) : (
              /* Văn bản tương tác với giọng đọc đồng bộ */
              <InteractiveText
                text={page.extractedText}
                activeSentenceIndex={tts.currentSentenceIndex}
                notes={notes}
                fontSize={fontSize}
                isSerif={isSerif}
                onPlaySentence={(idx) => tts.playSentence(idx)}
                onSelectWord={(word, position) => {
                  setSelectedWordInfo({ word, position });
                }}
                onOpenExistingNote={(note) => {
                  setEditingNoteData({
                    word: note.word,
                    existingNote: note,
                  });
                }}
              />
            )}
          </div>
        </div>
      </main>

      {/* Popover Tra Từ Cambridge */}
      {selectedWordInfo && (
        <DictionaryPopover
          key={`${selectedWordInfo.word}-${selectedWordInfo.position.x}-${selectedWordInfo.position.y}`}
          word={selectedWordInfo.word}
          position={selectedWordInfo.position}
          onClose={() => setSelectedWordInfo(null)}
          onAddNote={(wordData) => {
            setEditingNoteData({
              word: wordData.word,
              phonetic: wordData.phonetic,
              meaning: wordData.meaning,
              cambridgeUrl: wordData.cambridgeUrl,
              googleTranslateUrl: wordData.googleTranslateUrl,
              albumId: page.albumId,
              pageId: page.id,
            });
          }}
        />
      )}

      {/* Modal Lưu & Sửa Kiểu Nhớ Của Cô Ly */}
      {editingNoteData && (
        <NoteEditorModal
          initialData={editingNoteData}
          onClose={() => setEditingNoteData(null)}
          onSaved={() => {
            refreshNotes();
          }}
        />
      )}

      {/* Thanh Audio Voice Mèo Cam */}
      <AudioVoiceBar
        isPlaying={tts.isPlaying}
        isPaused={tts.isPaused}
        currentSentenceIndex={tts.currentSentenceIndex}
        totalSentences={tts.sentences.length}
        currentSentenceText={currentSentenceText}
        rate={tts.rate}
        engine={tts.engine}
        voices={tts.voices}
        selectedVoice={tts.selectedVoice}
        onPlay={tts.play}
        onPause={tts.pause}
        onStop={tts.stop}
        onNext={tts.nextSentence}
        onPrev={tts.prevSentence}
        onChangeRate={tts.changeRate}
        onChangeVoice={tts.changeVoice}
        onSelectEngine={tts.selectEngine}
        onTestVoice={tts.testVoiceSound}
      />
    </div>
  );
}

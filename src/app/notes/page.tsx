'use client';

import React, { useState, useEffect } from 'react';
import Link from 'next/link';
import {
  Search,
  Volume2,
  ExternalLink,
  Edit3,
  Trash2,
  CheckCircle2,
  RotateCw,
  BookOpen,
  Sparkles,
  Zap,
  Flame
} from 'lucide-react';
import { db } from '@/lib/db';
import { VocabNote, Album, MemoryType } from '@/types';
import { syncService } from '@/lib/syncService';
import { getSupabaseClient, isSupabaseConfigured } from '@/lib/supabase';
import { recordReviewActivity } from '@/lib/heatmapService';
import NoteEditorModal from '@/components/notes/NoteEditorModal';
import AnkiHeatmap from '@/components/review/AnkiHeatmap';
import CuteCat from '@/components/common/CuteCat';

const MEMORY_TYPE_LABELS: Record<MemoryType, { label: string; icon: string; color: string }> = {
  mnemonic: { label: 'Mẹo liên tưởng', icon: '💡', color: 'bg-purple-100 text-purple-950 border-purple-300' },
  collocation: { label: 'Cụm từ đi kèm', icon: '🔗', color: 'bg-blue-100 text-blue-950 border-blue-300' },
  context: { label: 'Ngữ cảnh sách', icon: '📖', color: 'bg-emerald-100 text-emerald-950 border-emerald-300' },
  grammar: { label: 'Ngữ pháp', icon: '📐', color: 'bg-amber-100 text-amber-950 border-amber-300' },
  other: { label: 'Ghi chú riêng', icon: '🐟', color: 'bg-rose-100 text-rose-950 border-rose-300' },
};

export default function NotesPage() {
  const [notes, setNotes] = useState<VocabNote[]>([]);
  const [albums, setAlbums] = useState<Album[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedAlbumId, setSelectedAlbumId] = useState<string>('all');
  const [selectedType, setSelectedType] = useState<string>('all');
  const [selectedStatus, setSelectedStatus] = useState<string>('all');

  const [isFlashcardMode, setIsFlashcardMode] = useState(false);
  const [currentCardIndex, setCurrentCardIndex] = useState(0);
  const [isFlipped, setIsFlipped] = useState(false);

  const [editingNote, setEditingNote] = useState<VocabNote | null>(null);
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
  const [createInitialWord, setCreateInitialWord] = useState('');
  const [quickWordInput, setQuickWordInput] = useState('');
  const [showHeatmap, setShowHeatmap] = useState(false);

  const loadData = async () => {
    const allNotes = await db.vocabNotes.orderBy('createdAt').reverse().toArray();
    setNotes(allNotes);
    const allAlbums = await db.albums.toArray();
    setAlbums(allAlbums);
  };

  useEffect(() => {
    loadData();
  }, []);

  const playWordAudio = (word: string, audioUrl?: string) => {
    if (audioUrl) {
      const a = new Audio(audioUrl);
      a.play().catch(() => speakFallback(word));
    } else {
      speakFallback(word);
    }
  };

  const speakFallback = (text: string) => {
    if (typeof window === 'undefined' || !window.speechSynthesis) return;
    window.speechSynthesis.cancel();
    const u = new SpeechSynthesisUtterance(text);
    u.lang = 'en-US';
    window.speechSynthesis.speak(u);
  };

  const toggleStatus = async (note: VocabNote) => {
    const nextStatus = note.status === 'learning' ? 'mastered' : 'learning';
    const now = Date.now();
    await db.vocabNotes.update(note.id, {
      status: nextStatus,
      updatedAt: now,
      lastReviewedAt: now,
    });
    // Ghi nhận hoạt động ôn tập thật vào Review Logs
    await recordReviewActivity(note.id, nextStatus === 'mastered' ? 4 : 2);
    syncService.triggerSync(1000);
    loadData();
  };

  const handleDeleteNote = async (id: string) => {
    if (confirm('Cô Ly có chắc muốn xóa từ vựng này khỏi sổ tay Mèo Cam không meow? 🐾')) {
      await db.vocabNotes.delete(id);
      if (isSupabaseConfigured()) {
        const sb = getSupabaseClient();
        if (sb) {
          await sb.from('vocab_notes').delete().eq('id', id);
        }
      }
      loadData();
    }
  };

  const filteredNotes = notes.filter((n) => {
    if (selectedAlbumId !== 'all' && n.albumId !== selectedAlbumId) return false;
    if (selectedType !== 'all' && n.memoryType !== selectedType) return false;
    if (selectedStatus !== 'all' && n.status !== selectedStatus) return false;
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      const matchWord = n.word.toLowerCase().includes(q);
      const matchMeaning = n.meaning.toLowerCase().includes(q);
      const matchNote = n.note.toLowerCase().includes(q);
      if (!matchWord && !matchMeaning && !matchNote) return false;
    }
    return true;
  });

  return (
    <div className="max-w-6xl mx-auto px-4 py-8 space-y-8">
      {/* Header Phong Cách Mèo Cam */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div className="space-y-1">
          <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-orange-100 text-orange-950 text-xs font-bold border border-orange-300 mb-1">
            <span>🐾</span>
            <span>Kho Mẹo Nhớ Của Mèo Cam</span>
          </div>
          <h1 className="font-serif font-black text-3xl sm:text-4xl text-orange-950 flex items-center gap-2">
            Sổ Mẹo Nhớ & Thưởng Cá 🐟
          </h1>
          <p className="text-sm text-orange-800/80 font-medium">
            Tất cả từ vựng cô Ly đã tra cứu, lưu lại mẹo liên tưởng và ảnh minh họa để học vui như chơi cùng mèo con!
          </p>
        </div>

        {/* Nhóm Nút Hành Động Header */}
        <div className="flex flex-wrap items-center gap-3 self-start sm:self-auto">
          <button
            onClick={() => setShowHeatmap(!showHeatmap)}
            className={`px-4 py-3 rounded-2xl border-2 font-extrabold shadow-sm hover:scale-105 flex items-center gap-2 transition-all active:scale-98 cursor-pointer ${
              showHeatmap
                ? 'bg-gradient-to-r from-orange-500 to-amber-500 border-orange-500 text-white shadow-md shadow-orange-500/20'
                : 'bg-white border-orange-300 text-orange-950 hover:bg-orange-50'
            }`}
          >
            <Flame className={`w-4 h-4 ${showHeatmap ? 'text-amber-200 fill-current' : 'text-amber-500 fill-current'} animate-pulse`} />
            <span>Streak Heatmap 🔥</span>
          </button>

          <button
            onClick={() => {
              setCreateInitialWord('');
              setIsCreateModalOpen(true);
            }}
            className="px-5 py-3 rounded-2xl bg-gradient-to-r from-orange-500 to-amber-500 hover:from-orange-600 hover:to-amber-600 text-white font-extrabold shadow-lg shadow-orange-500/20 hover:scale-105 flex items-center gap-2 transition-all active:scale-98 cursor-pointer"
          >
            <Sparkles className="w-5 h-5 text-amber-200" />
            <span>+ Tạo Từ Mới 🪄</span>
          </button>

          {filteredNotes.length > 0 && (
            <Link
              href="/review"
              className="px-5 py-3 rounded-2xl bg-white border-2 border-orange-300 hover:bg-orange-50 text-orange-950 font-extrabold shadow-sm hover:scale-105 flex items-center gap-2 transition-all active:scale-98"
            >
              <RotateCw className="w-4 h-4 text-orange-600" />
              <span>Ôn Tập Anki (SM-2) 🐾</span>
            </Link>
          )}
        </div>
      </div>

      {/* Hiển thị Biểu Đồ Anki Heatmap khi bấm Streak */}
      {showHeatmap && (
        <div className="animate-in fade-in zoom-in-95 duration-200">
          <AnkiHeatmap />
        </div>
      )}

      {/* Khối Tạo Từ Vựng Mới Siêu Tốc Chuẩn Cambridge */}
      <div className="bg-gradient-to-r from-orange-50/90 via-amber-50/80 to-orange-50/90 rounded-3xl p-5 border-2 border-orange-300 shadow-xs space-y-3">
        <div className="flex items-center gap-3">
          <CuteCat size={38} mood="happy" />
          <div>
            <h2 className="font-serif font-black text-lg text-orange-950 flex items-center gap-1.5">
              Tạo Thẻ Từ Mới Siêu Tốc (0.001s Chuẩn Cambridge) <span>⚡</span>
            </h2>
            <p className="text-xs text-orange-800/80 font-medium">
              Chỉ cần gõ từ vựng tiếng Anh, hệ thống sẽ nạp tức thì toàn bộ phiên âm IPA, loại từ, nghĩa tiếng Việt chuẩn Cambridge và ví dụ câu thực tế!
            </p>
          </div>
        </div>

        <div className="flex flex-col sm:flex-row items-stretch gap-2.5">
          <div className="relative flex-1">
            <Zap className="w-4 h-4 text-orange-500 absolute left-3.5 top-1/2 -translate-y-1/2 pointer-events-none" />
            <input
              type="text"
              value={quickWordInput}
              onChange={(e) => setQuickWordInput(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter' && quickWordInput.trim()) {
                  setCreateInitialWord(quickWordInput.trim());
                  setIsCreateModalOpen(true);
                  setQuickWordInput('');
                }
              }}
              placeholder="Nhập từ vựng tiếng Anh (vd: resilient, serendipity, magnificent...) rồi nhấn Enter ↵"
              className="w-full pl-9 pr-4 py-3 rounded-2xl border-2 border-orange-200 bg-white text-xs font-bold text-orange-950 placeholder-orange-400 focus:outline-none focus:ring-2 focus:ring-orange-500 shadow-2xs transition-all"
            />
          </div>

          <button
            onClick={() => {
              if (quickWordInput.trim()) {
                setCreateInitialWord(quickWordInput.trim());
                setIsCreateModalOpen(true);
                setQuickWordInput('');
              } else {
                setCreateInitialWord('');
                setIsCreateModalOpen(true);
              }
            }}
            className="px-6 py-3 rounded-2xl bg-gradient-to-r from-orange-500 to-amber-500 hover:from-orange-600 hover:to-amber-600 text-white font-black text-xs shadow-md shadow-orange-500/20 hover:scale-102 flex items-center justify-center gap-2 shrink-0 press-spring cursor-pointer"
          >
            <Zap className="w-4 h-4 text-amber-200" />
            <span>Tạo Thẻ Siêu Tốc ⚡</span>
          </button>
        </div>
      </div>

      {/* Bộ Lọc & Tìm Kiếm */}
      <div className="bg-white/95 rounded-3xl p-5 border-2 border-orange-200/80 shadow-xs space-y-4">
        <div className="grid grid-cols-1 sm:grid-cols-4 gap-3">
          <div className="relative sm:col-span-1">
            <Search className="w-4 h-4 text-orange-500 absolute left-3.5 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Tìm từ, nghĩa, mẹo nhớ..."
              className="w-full pl-9 pr-3.5 py-2.5 rounded-2xl border-2 border-orange-200 text-xs text-orange-950 placeholder-orange-400 focus:outline-none focus:ring-2 focus:ring-orange-500 font-medium"
            />
          </div>

          <div>
            <select
              aria-label="Lọc theo Album"
              value={selectedAlbumId}
              onChange={(e) => setSelectedAlbumId(e.target.value)}
              className="w-full px-3.5 py-2.5 rounded-2xl border-2 border-orange-200 bg-white text-xs font-bold text-orange-950 focus:outline-none"
            >
              <option value="all">🐾 Tất cả Album / Sách</option>
              {albums.map((a) => (
                <option key={a.id} value={a.id}>
                  {a.title}
                </option>
              ))}
            </select>
          </div>

          <div>
            <select
              aria-label="Lọc theo Kiểu nhớ"
              value={selectedType}
              onChange={(e) => setSelectedType(e.target.value)}
              className="w-full px-3.5 py-2.5 rounded-2xl border-2 border-orange-200 bg-white text-xs font-bold text-orange-950 focus:outline-none"
            >
              <option value="all">🐾 Tất cả Kiểu nhớ</option>
              <option value="mnemonic">💡 Mẹo liên tưởng</option>
              <option value="collocation">🔗 Cụm từ đi kèm</option>
              <option value="context">📖 Ngữ cảnh sách</option>
              <option value="grammar">📐 Ngữ pháp / Cách dùng</option>
              <option value="other">🐟 Ghi chú riêng</option>
            </select>
          </div>

          <div>
            <select
              aria-label="Lọc theo Trạng thái học"
              value={selectedStatus}
              onChange={(e) => setSelectedStatus(e.target.value)}
              className="w-full px-3.5 py-2.5 rounded-2xl border-2 border-orange-200 bg-white text-xs font-bold text-orange-950 focus:outline-none"
            >
              <option value="all">🐾 Tất cả trạng thái</option>
              <option value="learning">Đang học meow~</option>
              <option value="mastered">Đã thưởng cá 🐟</option>
            </select>
          </div>
        </div>
      </div>

      {/* Danh Sách Từ Vựng Grid */}
      {filteredNotes.length === 0 ? (
        <div className="text-center py-16 bg-white/90 rounded-3xl border-2 border-orange-200 p-8 space-y-4">
          <CuteCat size={90} mood="reading" className="mx-auto" />
          <h3 className="font-serif font-black text-xl text-orange-950">Chưa có từ vựng nào meow~</h3>
          <p className="text-xs text-orange-800/80 max-w-sm mx-auto font-medium">
            Khi đọc sách, cô Ly nhấp đúp vào từ bất kỳ và chọn &quot;Lưu vào Kiểu nhớ của Cô Ly&quot; để thưởng cá cho Mèo Cam nha! 🐾
          </p>
          <div className="flex flex-wrap items-center justify-center gap-3">
            <button
              onClick={() => {
                setCreateInitialWord('');
                setIsCreateModalOpen(true);
              }}
              className="inline-flex items-center gap-2 px-5 py-2.5 rounded-2xl bg-gradient-to-r from-orange-500 to-amber-500 hover:from-orange-600 hover:to-amber-600 text-white text-xs font-bold shadow-md shadow-orange-500/20 hover:scale-105 transition-all cursor-pointer"
            >
              <Sparkles className="w-4 h-4 text-amber-200" />
              <span>+ Tạo từ vựng mới ngay 🪄</span>
            </button>
            <Link
              href="/"
              className="inline-flex items-center gap-2 px-5 py-2.5 rounded-2xl bg-orange-100 hover:bg-orange-200 text-orange-950 text-xs font-bold transition-all"
            >
              <BookOpen className="w-4 h-4" /> Mở Tủ Sách đọc ngay
            </Link>
          </div>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
          {filteredNotes.map((note, idx) => {
            const memoryConfig = MEMORY_TYPE_LABELS[note.memoryType] || MEMORY_TYPE_LABELS.other;
            const staggerClass = idx < 8 ? (idx % 4 === 0 ? 'stagger-1' : idx % 4 === 1 ? 'stagger-2' : idx % 4 === 2 ? 'stagger-3' : 'stagger-4') : '';

            return (
              <div
                key={note.id}
                className={`bg-[#fffdfa] rounded-3xl border-2 border-orange-200/90 shadow-card hover:shadow-xl card-lift p-5 flex flex-col justify-between space-y-4 ${staggerClass}`}
              >
                {/* Top: Word, Phonetic, Audio, Status */}
                <div className="space-y-3">
                  <div className="flex items-start justify-between gap-2">
                    <div>
                      <div className="flex items-center gap-2">
                        <h3 className="font-serif font-black text-2xl text-orange-950 capitalize">
                          {note.word}
                        </h3>
                        <button
                          onClick={() => playWordAudio(note.word, note.audioUrl)}
                          title="Nghe phát âm"
                          className="p-1.5 rounded-full bg-orange-100 hover:bg-orange-200 text-orange-800 transition-colors"
                        >
                          <Volume2 className="w-4 h-4" />
                        </button>
                      </div>
                      {note.phonetic && (
                        <p className="text-xs font-mono font-bold text-orange-700/90 mt-0.5">
                          {note.phonetic}
                        </p>
                      )}
                    </div>

                    <span
                      className={`text-[11px] font-black px-2.5 py-1 rounded-full border-2 flex items-center gap-1 shrink-0 ${memoryConfig.color}`}
                    >
                      <span>{memoryConfig.icon}</span>
                      <span>{memoryConfig.label}</span>
                    </span>
                  </div>

                  {/* Nghĩa của từ */}
                  <div className="p-3 rounded-2xl bg-orange-50/80 border border-orange-200 text-xs text-orange-950 font-bold leading-relaxed">
                    {note.meaning || 'Chưa có nghĩa tóm tắt'}
                  </div>

                  {/* Mẹo nhớ của Cô Ly */}
                  {note.note && (
                    <div className="text-xs text-slate-800 leading-relaxed pl-3 border-l-4 border-orange-400 py-1 italic bg-amber-50/40 rounded-r-xl font-medium">
                      &ldquo;{note.note}&rdquo;
                    </div>
                  )}

                  {/* Ảnh minh họa */}
                  {note.imageUrl && (
                    <div className="rounded-2xl overflow-hidden border-2 border-orange-200 max-h-40 bg-orange-50">
                      <img
                        src={note.imageUrl}
                        alt={note.word}
                        className="w-full h-40 object-cover hover:scale-105 transition-transform duration-300"
                      />
                    </div>
                  )}
                </div>

                {/* Bottom: Links & Actions */}
                <div className="pt-3 border-t-2 border-orange-100 flex items-center justify-between text-xs font-bold">
                  {/* Cambridge Link */}
                  <a
                    href={note.cambridgeUrl}
                    target="_blank"
                    rel="noreferrer"
                    className="text-red-600 hover:text-red-800 flex items-center gap-1"
                  >
                    Cambridge <ExternalLink className="w-3 h-3" />
                  </a>

                  {/* Status Toggle & Edit/Delete */}
                  <div className="flex items-center gap-2">
                    <button
                      onClick={() => toggleStatus(note)}
                      className={`px-2.5 py-1 rounded-xl text-[11px] font-extrabold border-2 flex items-center gap-1 transition-all ${
                        note.status === 'mastered'
                          ? 'bg-emerald-100 text-emerald-900 border-emerald-300'
                          : 'bg-orange-100 text-orange-900 border-orange-300 hover:bg-orange-200'
                      }`}
                    >
                      <CheckCircle2 className="w-3.5 h-3.5" />
                      {note.status === 'mastered' ? 'Đã thuộc 🐟' : 'Đang học 🐾'}
                    </button>

                    <button
                      onClick={() => setEditingNote(note)}
                      title="Sửa ghi chú"
                      className="p-1.5 rounded-lg text-slate-400 hover:bg-orange-100 hover:text-orange-900"
                    >
                      <Edit3 className="w-3.5 h-3.5" />
                    </button>

                    <button
                      onClick={() => handleDeleteNote(note.id)}
                      title="Xóa từ"
                      className="p-1.5 rounded-lg text-rose-400 hover:bg-rose-50 hover:text-rose-600"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Modal Ôn Tập Flashcard Phong Cách Mèo Cam */}
      {isFlashcardMode && filteredNotes.length > 0 && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/45 backdrop-blur-sm p-4 overflow-y-auto">
          <div className="bg-[#fffdfa] rounded-3xl border-2 border-orange-200 shadow-modal max-w-md w-full p-6 space-y-6 my-auto animate-in fade-in zoom-in-95">
            {/* Header Flashcard */}
            <div className="flex items-center justify-between">
              <span className="text-xs font-black text-orange-800 font-mono flex items-center gap-1">
                <span>🐾</span> Thẻ {currentCardIndex + 1} / {filteredNotes.length}
              </span>
              <button
                onClick={() => setIsFlashcardMode(false)}
                className="text-xs text-orange-700 hover:text-orange-950 font-black px-2 py-1 rounded-lg hover:bg-orange-100"
              >
                Đóng ✕
              </button>
            </div>

            {/* Thẻ Flip Card */}
            {(() => {
              const currentNote = filteredNotes[currentCardIndex];
              return (
                <div
                  onClick={() => setIsFlipped(!isFlipped)}
                  className="min-h-[280px] bg-white rounded-3xl border-4 border-orange-300 shadow-lg p-6 flex flex-col justify-between items-center text-center cursor-pointer hover:border-orange-400 transition-all select-none hover:shadow-xl"
                >
                  {!isFlipped ? (
                    // MẶT TRƯỚC: TỪ VỰNG + ẢNH
                    <div className="space-y-4 my-auto">
                      <span className="text-[11px] text-orange-600 font-black uppercase tracking-wider flex items-center justify-center gap-1">
                        <span>🐾</span> Mặt trước (Bấm để lật xem mẹo nhớ)
                      </span>
                      <h2 className="font-serif font-black text-4xl text-orange-950 capitalize">
                        {currentNote.word}
                      </h2>
                      {currentNote.phonetic && (
                        <p className="font-mono text-sm text-orange-700 font-bold">{currentNote.phonetic}</p>
                      )}
                      {currentNote.imageUrl && (
                        <div className="rounded-2xl overflow-hidden max-h-32 max-w-[200px] mx-auto border-2 border-orange-200">
                          <img
                            src={currentNote.imageUrl}
                            alt={currentNote.word}
                            className="w-full h-32 object-cover"
                          />
                        </div>
                      )}
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          playWordAudio(currentNote.word, currentNote.audioUrl);
                        }}
                        className="inline-flex items-center gap-1.5 px-4 py-2 rounded-full bg-orange-100 text-orange-900 text-xs font-bold hover:bg-orange-200 shadow-2xs"
                      >
                        <Volume2 className="w-4 h-4" /> Nghe Mèo Cam phát âm
                      </button>
                    </div>
                  ) : (
                    // MẶT SAU: NGHĨA + MẸO NHỚ CỦA CÔ LY
                    <div className="space-y-4 my-auto">
                      <span className="text-[11px] text-purple-700 font-black uppercase tracking-wider flex items-center justify-center gap-1">
                        <span>🐟</span> Mặt sau (Kiểu nhớ của Cô Ly)
                      </span>
                      <div className="p-4 bg-orange-50 rounded-2xl border-2 border-orange-200">
                        <p className="font-serif font-black text-xl text-orange-950">
                          {currentNote.meaning}
                        </p>
                      </div>
                      {currentNote.note && (
                        <p className="text-xs text-slate-800 italic bg-purple-50 p-3 rounded-2xl border-2 border-purple-200 font-medium leading-relaxed">
                          💡 &ldquo;{currentNote.note}&rdquo;
                        </p>
                      )}
                      <a
                        href={currentNote.cambridgeUrl}
                        target="_blank"
                        rel="noreferrer"
                        onClick={(e) => e.stopPropagation()}
                        className="inline-flex items-center gap-1 text-xs text-red-600 hover:underline font-bold"
                      >
                        Tra cứu trên Cambridge Dictionary <ExternalLink className="w-3.5 h-3.5" />
                      </a>
                    </div>
                  )}
                </div>
              );
            })()}

            {/* Flashcard Navigation */}
            <div className="flex items-center justify-between gap-3">
              <button
                onClick={() => {
                  setIsFlipped(false);
                  setCurrentCardIndex(Math.max(0, currentCardIndex - 1));
                }}
                disabled={currentCardIndex === 0}
                className="px-4 py-2 rounded-2xl bg-orange-200 text-orange-950 text-xs font-bold hover:bg-orange-300 disabled:opacity-40"
              >
                Thẻ trước
              </button>

              <button
                onClick={() => setIsFlipped(!isFlipped)}
                className="px-4 py-2 rounded-2xl bg-orange-100 text-orange-900 text-xs font-bold hover:bg-orange-200 flex items-center gap-1"
              >
                <RotateCw className="w-3.5 h-3.5" /> Lật thẻ
              </button>

              <button
                onClick={() => {
                  setIsFlipped(false);
                  setCurrentCardIndex(Math.min(filteredNotes.length - 1, currentCardIndex + 1));
                }}
                disabled={currentCardIndex >= filteredNotes.length - 1}
                className="px-5 py-2 rounded-2xl bg-orange-500 text-white text-xs font-bold hover:bg-orange-600 disabled:opacity-40 shadow-sm"
              >
                Thẻ sau 🐾
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Modal Tạo Từ Mới */}
      {isCreateModalOpen && (
        <NoteEditorModal
          initialData={{
            word: createInitialWord,
          }}
          onClose={() => setIsCreateModalOpen(false)}
          onSaved={() => {
            loadData();
            setIsCreateModalOpen(false);
          }}
        />
      )}

      {/* Modal Sửa Note */}
      {editingNote && (
        <NoteEditorModal
          initialData={{
            word: editingNote.word,
            existingNote: editingNote,
          }}
          onClose={() => setEditingNote(null)}
          onSaved={() => {
            loadData();
            setEditingNote(null);
          }}
        />
      )}
    </div>
  );
}

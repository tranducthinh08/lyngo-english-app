'use client';

import React, { useState, useEffect } from 'react';
import Link from 'next/link';
import {
  BookOpen,
  Camera,
  BookmarkCheck,
  Plus,
  ArrowRight,
  Headphones,
  Calendar,
  Layers,
  Trash2
} from 'lucide-react';
import { db, seedSampleDataIfEmpty } from '@/lib/db';
import { Album, PageItem } from '@/types';
import { getSupabaseClient, isSupabaseConfigured } from '@/lib/supabase';
import { syncService, trackDeletedId } from '@/lib/syncService';
import CreateAlbumModal from '@/components/bookshelf/CreateAlbumModal';
import CuteCat from '@/components/common/CuteCat';
import StreakBadge from '@/components/common/StreakBadge';

export default function HomePage() {
  const [albums, setAlbums] = useState<Album[]>([]);
  const [pages, setPages] = useState<PageItem[]>([]);
  const [vocabCount, setVocabCount] = useState<number>(0);
  const [selectedAlbumFilter, setSelectedAlbumFilter] = useState<string>('all');
  const [showCreateAlbum, setShowCreateAlbum] = useState(false);

  const loadData = async () => {
    try {
      await seedSampleDataIfEmpty();
      const allAlbums = await db.albums.orderBy('createdAt').reverse().toArray();
      const allPages = await db.pages.orderBy('createdAt').reverse().toArray();
      const totalVocab = await db.vocabNotes.count();

      setAlbums(allAlbums);
      setPages(allPages);
      setVocabCount(totalVocab);
    } catch (err) {
      console.error('Error loading data:', err);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  const handleDeletePage = async (pageId: string) => {
    if (confirm('Cô Ly có chắc muốn xóa trang sách này không meow? 🐾')) {
      trackDeletedId('pages', pageId);
      await db.pages.delete(pageId);
      if (isSupabaseConfigured()) {
        const sb = getSupabaseClient();
        if (sb) {
          await sb.from('pages').delete().eq('id', pageId);
        }
      }
      syncService.triggerSync(1000);
      loadData();
    }
  };

  const handleDeleteAlbum = async (albumId: string) => {
    if (confirm('Xóa Album này sẽ xóa cả các trang sách bên trong. Cô Ly có chắc không meow? 🐾')) {
      trackDeletedId('albums', albumId);
      const albumPages = await db.pages.where('albumId').equals(albumId).toArray();
      albumPages.forEach((p) => trackDeletedId('pages', p.id));

      await db.albums.delete(albumId);
      await db.pages.where('albumId').equals(albumId).delete();
      if (isSupabaseConfigured()) {
        const sb = getSupabaseClient();
        if (sb) {
          await sb.from('albums').delete().eq('id', albumId);
          await sb.from('pages').delete().eq('album_id', albumId);
        }
      }
      syncService.triggerSync(1000);
      loadData();
    }
  };

  const filteredPages = selectedAlbumFilter === 'all'
    ? pages
    : pages.filter((p) => p.albumId === selectedAlbumFilter);

  return (
    <div className="max-w-6xl mx-auto px-4 py-8 space-y-10">
      {/* Hero Welcome Banner Phong Cách Mèo Cam Dễ Thương */}
      <div className="relative overflow-hidden rounded-3xl bg-gradient-to-r from-orange-500 via-amber-500 to-orange-400 text-white p-6 sm:p-10 shadow-xl shadow-orange-500/15 border-4 border-orange-200/90">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 items-center">
          {/* Cột chữ bên trái */}
          <div className="md:col-span-2 space-y-4">
            {/* Bong bóng lời thoại của Mèo Cam */}
            <div className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full bg-white text-orange-950 text-xs font-bold shadow-md shadow-orange-950/10 border-2 border-orange-200">
              <span className="text-base">🐾</span>
              <span>Meow! Chào mừng Cô Ly đến với Góc Đọc Sách Mèo Cam!</span>
            </div>

            <h1 className="font-serif font-black text-3xl sm:text-4xl text-white tracking-tight drop-shadow-xs">
              Đọc Sách Giấy & Nhớ Từ Vựng Cùng Mèo Cam 🐱
            </h1>

            <p className="text-orange-50 text-sm sm:text-base leading-relaxed font-medium">
              Chụp ảnh trang sách cô Ly đang đọc, Mèo Cam sẽ soi chữ AI và giúp cô nhấp đúp tra Cambridge Dictionary, lưu mẹo nhớ và đọc to toàn bài meow meow!
            </p>

            {/* Quick Actions Buttons */}
            <div className="flex flex-wrap items-center gap-3 pt-2">
              <Link
                href="/scan"
                className="px-6 py-3 rounded-2xl bg-white text-orange-700 font-extrabold text-sm hover:bg-orange-50 transition-all shadow-lg shadow-orange-950/20 flex items-center gap-2 hover:-translate-y-0.5 active:scale-98"
              >
                <Camera className="w-5 h-5 text-orange-600" />
                <span>Chụp & Soi Trang Sách 📸</span>
              </Link>

              <Link
                href="/notes"
                className="px-5 py-3 rounded-2xl bg-orange-700/80 hover:bg-orange-800 text-white font-bold text-sm transition-all border-2 border-orange-300/80 flex items-center gap-2 hover:-translate-y-0.5"
              >
                <BookmarkCheck className="w-5 h-5 text-orange-200" />
                <span>Sổ Mẹo Nhớ ({vocabCount} từ) 🐟</span>
              </Link>
            </div>
          </div>

          {/* Cột chú Mèo Cam mập mạp bên phải */}
          <div className="flex justify-center md:justify-end relative">
            <div className="relative p-3 bg-white/20 rounded-full backdrop-blur-xs border-2 border-white/40 shadow-inner">
              <CuteCat size={145} mood="reading" className="drop-shadow-lg" />
              {/* Dấu chân mèo trang trí bay bay */}
              <div className="absolute -top-2 -left-2 bg-white rounded-full p-1.5 shadow-md -rotate-12">
                <CuteCat size={22} mood="paw" />
              </div>
              <div className="absolute -bottom-2 -right-2 bg-white rounded-full p-1.5 shadow-md rotate-12">
                <CuteCat size={22} mood="fish" />
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Chuỗi Học Tập (Streak Day) Nổi Bật Ở Trang Chủ */}
      <StreakBadge variant="banner" />

      {/* SECTION 1: TỦ SÁCH & ALBUM MÈO CAM */}
      <section className="space-y-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <div className="p-2 rounded-2xl bg-orange-100 text-orange-800 border border-orange-200">
              <BookOpen className="w-5 h-5" />
            </div>
            <div>
              <h2 className="font-serif font-black text-2xl text-orange-950 flex items-center gap-2">
                Tủ Sách & Album Của Cô Ly 🐾
              </h2>
              <p className="text-xs text-orange-800/80 font-medium">
                Phân loại theo từng cuốn sách để cô Ly dễ dàng mở lại
              </p>
            </div>
          </div>

          <button
            onClick={() => setShowCreateAlbum(true)}
            className="px-4 py-2 rounded-2xl bg-orange-500 hover:bg-orange-600 text-white text-xs font-bold flex items-center gap-1.5 transition-all shadow-md shadow-orange-500/20 hover:-translate-y-0.5"
          >
            <Plus className="w-4 h-4" /> Tạo Album Mới 🐾
          </button>
        </div>

        {/* Albums Grid */}
        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-5">
          {albums.map((album) => {
            const albumPages = pages.filter((p) => p.albumId === album.id);
            const isSelected = selectedAlbumFilter === album.id;

            return (
              <div
                key={album.id}
                onClick={() => setSelectedAlbumFilter(isSelected ? 'all' : album.id)}
                className={`p-6 rounded-3xl border-2 transition-all cursor-pointer select-none flex flex-col justify-between hover:-translate-y-1 ${
                  isSelected
                    ? 'bg-orange-50 border-orange-500 shadow-lg shadow-orange-500/10 ring-4 ring-orange-200'
                    : 'bg-white/95 border-orange-200/80 hover:border-orange-300 shadow-sm hover:shadow-md'
                }`}
              >
                <div className="space-y-3">
                  <div className="flex items-start justify-between gap-2">
                    <div className="w-12 h-12 rounded-2xl bg-orange-100 text-orange-800 flex items-center justify-center font-bold text-xl border border-orange-200 shadow-2xs">
                      🐱📖
                    </div>
                    {album.id !== 'sample-album-little-prince' && (
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          handleDeleteAlbum(album.id);
                        }}
                        className="text-slate-400 hover:text-rose-600 p-1 rounded-lg hover:bg-rose-50"
                        title="Xóa Album"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    )}
                  </div>

                  <div>
                    <h3 className="font-serif font-black text-xl text-orange-950 line-clamp-1">
                      {album.title}
                    </h3>
                    {album.author && (
                      <p className="text-xs text-orange-700 font-bold mt-0.5">Tác giả: {album.author}</p>
                    )}
                  </div>

                  {album.description && (
                    <p className="text-xs text-orange-900/80 line-clamp-2 leading-relaxed">
                      {album.description}
                    </p>
                  )}
                </div>

                <div className="pt-4 mt-3 border-t-2 border-orange-100 flex items-center justify-between text-xs font-bold text-orange-800">
                  <span className="flex items-center gap-1">
                    <span>🐾</span> {albumPages.length} trang đã lưu
                  </span>
                  <span className="text-[11px] text-orange-600 bg-orange-100 px-2.5 py-1 rounded-full border border-orange-200">
                    {isSelected ? 'Đang xem' : 'Bấm để lọc'}
                  </span>
                </div>
              </div>
            );
          })}
        </div>
      </section>

      {/* SECTION 2: LỊCH SỬ ĐỌC & CÁC TRANG ĐÃ QUÉT */}
      <section className="space-y-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <div className="p-2 rounded-2xl bg-orange-100 text-orange-800 border border-orange-200">
              <Layers className="w-5 h-5" />
            </div>
            <div>
              <h2 className="font-serif font-black text-2xl text-orange-950 flex items-center gap-2">
                Trang Sách Đã Scan Của Cô Ly 📖
              </h2>
              <p className="text-xs text-orange-800/80 font-medium">
                {selectedAlbumFilter === 'all'
                  ? `Toàn bộ ${pages.length} trang sách đã lưu`
                  : `Đang lọc theo Album (${filteredPages.length} trang)`}
              </p>
            </div>
          </div>

          {selectedAlbumFilter !== 'all' && (
            <button
              onClick={() => setSelectedAlbumFilter('all')}
              className="text-xs text-orange-700 hover:text-orange-900 underline font-bold"
            >
              Xem tất cả trang
            </button>
          )}
        </div>

        {filteredPages.length === 0 ? (
          <div className="text-center py-12 bg-white/90 rounded-3xl border-2 border-orange-200/80 p-8 space-y-4">
            <CuteCat size={80} mood="reading" className="mx-auto" />
            <h3 className="font-serif font-bold text-lg text-orange-950">Chưa có trang sách nào meow~</h3>
            <p className="text-xs text-orange-800/80 max-w-sm mx-auto font-medium">
              Cô Ly bấm nút bên dưới để Mèo Cam giúp cô chụp và soi trang sách tiếng Anh đầu tiên nhé! 🐾
            </p>
            <Link
              href="/scan"
              className="inline-flex items-center gap-2 px-5 py-2.5 rounded-2xl bg-orange-500 hover:bg-orange-600 text-white text-xs font-bold shadow-md shadow-orange-500/20"
            >
              <Camera className="w-4 h-4" /> Bắt đầu chụp sách ngay
            </Link>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
            {filteredPages.map((page) => {
              const album = albums.find((a) => a.id === page.albumId);

              return (
                <div
                  key={page.id}
                  className="bg-white/95 rounded-3xl p-6 border-2 border-orange-200/80 shadow-sm hover:shadow-md transition-all flex flex-col justify-between space-y-4 hover:-translate-y-0.5"
                >
                  <div className="space-y-3">
                    <div className="flex items-start justify-between gap-2">
                      <div>
                        <span className="text-[11px] font-extrabold text-orange-800 uppercase tracking-wider bg-orange-100 px-2.5 py-1 rounded-full border border-orange-300">
                          🐾 {album?.title || 'Sách'} • Trang {page.pageNumber || 1}
                        </span>
                        <h3 className="font-serif font-black text-xl text-orange-950 mt-2">
                          {page.title}
                        </h3>
                      </div>

                      {page.id !== 'sample-page-chapter-1' && (
                        <button
                          onClick={() => handleDeletePage(page.id)}
                          className="text-slate-400 hover:text-rose-600 p-1 rounded-lg hover:bg-rose-50"
                          title="Xóa trang này"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      )}
                    </div>

                    {/* Đoạn trích văn bản sách */}
                    <p className="text-xs text-orange-950/85 font-serif line-clamp-3 leading-relaxed pl-3 border-l-4 border-orange-400 bg-orange-50/50 py-1 rounded-r-xl">
                      {page.extractedText}
                    </p>
                  </div>

                  <div className="pt-3 border-t-2 border-orange-100 flex items-center justify-between">
                    <span className="text-[11px] text-orange-700/80 font-medium flex items-center gap-1">
                      <Calendar className="w-3.5 h-3.5" />
                      {new Date(page.createdAt).toLocaleDateString('vi-VN')}
                    </span>

                    <Link
                      href={`/reader/${page.id}`}
                      className="px-4 py-2 rounded-2xl bg-gradient-to-r from-orange-500 to-amber-500 hover:from-orange-600 hover:to-amber-600 text-white text-xs font-bold shadow-md shadow-orange-500/20 flex items-center gap-1.5 transition-transform active:scale-95"
                    >
                      <Headphones className="w-3.5 h-3.5" />
                      <span>Đọc & Nghe Voice</span>
                      <ArrowRight className="w-3 h-3" />
                    </Link>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </section>

      {/* Modal tạo Album */}
      {showCreateAlbum && (
        <CreateAlbumModal
          onClose={() => setShowCreateAlbum(false)}
          onCreated={() => loadData()}
        />
      )}
    </div>
  );
}

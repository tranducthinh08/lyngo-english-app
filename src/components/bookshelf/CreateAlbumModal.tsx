'use client';

import React, { useState, useRef } from 'react';
import { X, Upload, Trash2, Check } from 'lucide-react';
import { Album } from '@/types';
import { db } from '@/lib/db';
import { syncService } from '@/lib/syncService';
import { uploadBookImage, isSupabaseConfigured } from '@/lib/supabase';
import CuteCat from '@/components/common/CuteCat';

interface CreateAlbumModalProps {
  onClose: () => void;
  onCreated: (album: Album) => void;
}

export default function CreateAlbumModal({ onClose, onCreated }: CreateAlbumModalProps) {
  const [title, setTitle] = useState('');
  const [author, setAuthor] = useState('');
  const [description, setDescription] = useState('');
  const [coverImage, setCoverImage] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (event) => {
      if (event.target?.result) {
        setCoverImage(event.target.result as string);
      }
    };
    reader.readAsDataURL(file);
  };

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!title.trim()) return;

    setIsSubmitting(true);
    try {
      const albumId = `album-${Date.now()}`;
      let finalCover = coverImage.trim() || undefined;

      if (finalCover && isSupabaseConfigured()) {
        try {
          const cloudUrl = await uploadBookImage(finalCover, `covers/${albumId}.jpg`);
          if (cloudUrl) {
            finalCover = cloudUrl;
          }
        } catch (err) {
          console.warn('Lỗi upload ảnh bìa lên Cloud:', err);
        }
      }

      const newAlbum: Album = {
        id: albumId,
        title: title.trim(),
        author: author.trim() || undefined,
        description: description.trim() || undefined,
        coverImage: finalCover,
        createdAt: Date.now(),
        updatedAt: Date.now(),
      };

      await db.albums.add(newAlbum);

      // Tự động đồng bộ với Supabase
      syncService.triggerSync(1000);

      onCreated(newAlbum);
      onClose();
    } catch (err) {
      console.error('Lỗi khi tạo album:', err);
      alert('Không thể tạo album meow~');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/45 backdrop-blur-sm p-4 overflow-y-auto">
      <div className="bg-[#fffdfa] rounded-3xl border-2 border-orange-200 shadow-modal max-w-md w-full max-h-[90vh] flex flex-col overflow-hidden my-auto animate-in fade-in zoom-in-95">
        <div className="px-6 py-4 border-b border-orange-200 flex items-center justify-between bg-gradient-to-r from-orange-100 via-amber-50 to-orange-100 shrink-0">
          <div className="flex items-center gap-2.5">
            <CuteCat size={38} mood="reading" />
            <h2 className="font-serif font-black text-xl text-orange-950 flex items-center gap-1.5">
              Tạo Cuốn Sách / Album Mới <span>🐾</span>
            </h2>
          </div>
          <button onClick={onClose} className="p-1.5 rounded-full text-orange-800 hover:bg-orange-200 transition-colors">
            <X className="w-5 h-5" />
          </button>
        </div>

        <form onSubmit={handleCreate} className="flex flex-col flex-1 min-h-0 overflow-hidden">
          <div className="p-6 space-y-4 flex-1 overflow-y-auto min-h-0">
          <div>
            <label className="block text-xs font-bold text-orange-950 mb-1">
              Tên cuốn sách / Chủ đề *
            </label>
            <input
              type="text"
              required
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="Ví dụ: Atomic Habits, Hoàng Tử Bé..."
              className="w-full px-3.5 py-2.5 rounded-2xl border-2 border-orange-300 bg-white text-sm font-bold text-orange-950 focus:ring-2 focus:ring-orange-500 focus:outline-none"
            />
          </div>

          <div>
            <label className="block text-xs font-bold text-orange-950 mb-1">Tác giả</label>
            <input
              type="text"
              value={author}
              onChange={(e) => setAuthor(e.target.value)}
              placeholder="Ví dụ: Antoine de Saint-Exupéry"
              className="w-full px-3.5 py-2.5 rounded-2xl border-2 border-orange-300 bg-white text-sm text-orange-950 focus:ring-2 focus:ring-orange-500 focus:outline-none font-medium"
            />
          </div>

          <div>
            <label className="block text-xs font-bold text-orange-950 mb-1">Ghi chú cuốn sách</label>
            <textarea
              rows={2}
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Ví dụ: Cuốn sách Cô Ly đọc buổi sáng cùng Mèo Cam..."
              className="w-full px-3.5 py-2.5 rounded-2xl border-2 border-orange-300 bg-white text-sm text-orange-950 focus:ring-2 focus:ring-orange-500 focus:outline-none font-medium"
            />
          </div>

          <div>
            <label className="block text-xs font-bold text-orange-950 mb-1 flex items-center justify-between">
              <span>Ảnh bìa sách 🐾</span>
              {coverImage && (
                <button
                  type="button"
                  onClick={() => setCoverImage('')}
                  className="text-xs text-rose-600 hover:underline flex items-center gap-1 font-bold"
                >
                  <Trash2 className="w-3.5 h-3.5" /> Xóa ảnh
                </button>
              )}
            </label>

            {coverImage ? (
              <div className="relative rounded-2xl overflow-hidden border-2 border-orange-300 max-h-32 bg-orange-100 flex items-center justify-center">
                <img src={coverImage} alt="Cover" className="w-full h-32 object-cover" />
              </div>
            ) : (
              <div
                onClick={() => fileInputRef.current?.click()}
                className="border-2 border-dashed border-orange-300 rounded-2xl p-4 text-center cursor-pointer hover:bg-orange-50 transition-colors bg-white/70"
              >
                <Upload className="w-5 h-5 text-orange-500 mx-auto mb-1" />
                <p className="text-xs font-bold text-orange-950">Bấm để tải ảnh bìa sách</p>
              </div>
            )}

            <input
              type="file"
              ref={fileInputRef}
              accept="image/*"
              onChange={handleFileChange}
              className="hidden"
            />
          </div>

          </div>

          <div className="px-6 py-3.5 bg-[#fffdfa] border-t border-orange-200 flex items-center justify-end gap-3 shrink-0">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 rounded-2xl text-sm font-bold text-orange-900 hover:bg-orange-100 transition-colors"
            >
              Hủy
            </button>
            <button
              type="submit"
              disabled={isSubmitting}
              className="px-6 py-2.5 rounded-2xl text-sm font-black bg-gradient-to-r from-orange-500 to-amber-500 text-white hover:scale-105 shadow-md shadow-orange-500/20 flex items-center gap-1.5 active:scale-95 cursor-pointer"
            >
              <Check className="w-4 h-4" /> Tạo Album Meow! 🐾
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

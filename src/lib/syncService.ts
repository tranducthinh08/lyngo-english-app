'use client';

import { db } from '@/lib/db';
import { getSupabaseClient, isSupabaseConfigured } from '@/lib/supabase';
import { Album, PageItem, VocabNote } from '@/types';

export type SyncState = 'idle' | 'syncing' | 'synced' | 'error' | 'offline';

const DELETED_KEYS = {
  albums: 'lyngo_deleted_albums',
  pages: 'lyngo_deleted_pages',
  vocabNotes: 'lyngo_deleted_vocab_notes',
} as const;

export function trackDeletedId(type: keyof typeof DELETED_KEYS, id: string) {
  if (typeof window === 'undefined') return;
  try {
    const key = DELETED_KEYS[type];
    const list: string[] = JSON.parse(localStorage.getItem(key) || '[]');
    if (!list.includes(id)) {
      list.push(id);
      localStorage.setItem(key, JSON.stringify(list));
    }
  } catch (err) {
    console.warn('Lỗi lưu trackDeletedId:', err);
  }
}

function getDeletedIds(type: keyof typeof DELETED_KEYS): string[] {
  if (typeof window === 'undefined') return [];
  try {
    return JSON.parse(localStorage.getItem(DELETED_KEYS[type]) || '[]');
  } catch {
    return [];
  }
}

function clearDeletedIds(type: keyof typeof DELETED_KEYS, ids: string[]) {
  if (typeof window === 'undefined' || ids.length === 0) return;
  try {
    const key = DELETED_KEYS[type];
    const list: string[] = JSON.parse(localStorage.getItem(key) || '[]');
    const next = list.filter((x) => !ids.includes(x));
    localStorage.setItem(key, JSON.stringify(next));
  } catch (err) {
    console.warn('Lỗi clearDeletedIds:', err);
  }
}

type SyncListener = (state: {
  status: SyncState;
  lastSyncTime: number | null;
  errorMessage?: string;
}) => void;

class SyncService {
  private status: SyncState = 'idle';
  private lastSyncTime: number | null = null;
  private errorMessage: string | undefined = undefined;
  private listeners: Set<SyncListener> = new Set();
  private debounceTimer: NodeJS.Timeout | null = null;
  private isSyncInProgress = false;

  constructor() {
    if (typeof window !== 'undefined') {
      // Tự động đồng bộ khi trình duyệt có mạng trở lại
      window.addEventListener('online', () => {
        this.triggerSync(1000);
      });

      // Tự động đồng bộ khi người dùng quay lại tab ứng dụng
      window.addEventListener('focus', () => {
        if (this.status !== 'error') {
          this.triggerSync(2000);
        }
      });
    }
  }

  public subscribe(listener: SyncListener): () => void {
    this.listeners.add(listener);
    listener({
      status: this.status,
      lastSyncTime: this.lastSyncTime,
      errorMessage: this.errorMessage,
    });
    return () => this.listeners.delete(listener);
  }

  private notify() {
    this.listeners.forEach((listener) => {
      listener({
        status: this.status,
        lastSyncTime: this.lastSyncTime,
        errorMessage: this.errorMessage,
      });
    });
  }

  public getStatus() {
    return {
      status: this.status,
      lastSyncTime: this.lastSyncTime,
      errorMessage: this.errorMessage,
    };
  }

  /**
   * Kích hoạt đồng bộ có độ trễ (debounce) để tránh spam request khi ghi liên tục
   */
  public triggerSync(delayMs = 1500) {
    if (!isSupabaseConfigured()) {
      this.status = 'offline';
      this.notify();
      return;
    }

    if (this.debounceTimer) {
      clearTimeout(this.debounceTimer);
    }

    this.debounceTimer = setTimeout(() => {
      this.runFullSync();
    }, delayMs);
  }

  /**
   * Thực hiện đồng bộ 2 chiều đầy đủ giữa Dexie (Local) và Supabase (Cloud)
   * Áp dụng giải thuật Last-Write-Wins dựa trên updatedAt
   */
  public async runFullSync(): Promise<boolean> {
    const supabase = getSupabaseClient();
    if (!supabase) {
      this.status = 'offline';
      this.notify();
      return false;
    }

    if (this.isSyncInProgress) {
      return false;
    }

    this.isSyncInProgress = true;
    this.status = 'syncing';
    this.errorMessage = undefined;
    this.notify();

    try {
      // 1. ĐỒNG BỘ BẢNG ALBUMS
      await this.syncAlbums(supabase);

      // 2. ĐỒNG BỘ BẢNG PAGES
      await this.syncPages(supabase);

      // 3. ĐỒNG BỘ BẢNG VOCAB_NOTES
      await this.syncVocabNotes(supabase);

      // 4. ĐỒNG BỘ BẢNG REVIEW_LOGS (Nhật ký Heatmap Anki)
      await this.syncReviewLogs(supabase);

      this.status = 'synced';
      this.lastSyncTime = Date.now();
      this.notify();
      return true;
    } catch (err: unknown) {
      const error = err as Error;
      console.error('[SyncService] Lỗi đồng bộ dữ liệu:', error);
      this.status = 'error';
      if (error.message?.includes('permission denied')) {
        this.errorMessage = 'Chưa cấp quyền (GRANT) cho bảng Supabase. Cô Ly vui lòng chạy script cấp quyền trong Supabase SQL Editor nhé! 🐾';
      } else {
        this.errorMessage = error.message || 'Lỗi không xác định khi đồng bộ với Mây';
      }
      this.notify();
      return false;
    } finally {
      this.isSyncInProgress = false;
    }
  }

  // --------------------------------------------------------------------------
  // ĐỒNG BỘ ALBUMS (TỐI ƯU BATCH UPSERT & XỬ LÝ XÓA DỨT ĐIỂM)
  // --------------------------------------------------------------------------
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  private async syncAlbums(supabase: any) {
    // Xóa trên Cloud các item đã xóa ở Local
    const deletedIds = getDeletedIds('albums');
    if (deletedIds.length > 0) {
      const { error: delErr } = await supabase.from('albums').delete().in('id', deletedIds);
      if (!delErr) {
        clearDeletedIds('albums', deletedIds);
      }
    }

    const localAlbums = await db.albums.toArray();
    const { data: cloudAlbums, error } = await supabase.from('albums').select('*');

    if (error) throw new Error(`Lỗi tải Albums từ Cloud: ${error.message}`);

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const cloudMap = new Map<string, any>((cloudAlbums || []).map((a: any) => [a.id, a]));
    const localMap = new Map<string, Album>(localAlbums.map((a) => [a.id, a]));

    // 1.1 Local -> Cloud: Gom nhóm để Batch Upsert thay vì vòng lặp N+1
    const albumsToUpsert = [];
    for (const local of localAlbums) {
      const cloud = cloudMap.get(local.id);
      if (!cloud || local.updatedAt > Number(cloud.updated_at)) {
        albumsToUpsert.push({
          id: local.id,
          title: local.title,
          author: local.author || null,
          cover_image: local.coverImage || null,
          description: local.description || null,
          created_at: local.createdAt,
          updated_at: local.updatedAt,
        });
      }
    }

    if (albumsToUpsert.length > 0) {
      const { error: upsertErr } = await supabase.from('albums').upsert(albumsToUpsert, { onConflict: 'id' });
      if (upsertErr) throw new Error(`Lỗi lưu Albums lên Cloud: ${upsertErr.message}`);
    }

    // 1.2 Cloud -> Local: Gom nhóm để bulkPut vào IndexedDB (chặn hồi sinh các item đã xóa)
    const activeDeletedIds = new Set(getDeletedIds('albums'));
    const localAlbumsToSave: Album[] = [];
    for (const cloud of cloudAlbums || []) {
      if (activeDeletedIds.has(cloud.id)) continue; // ĐÃ XÓA Ở LOCAL: KHÔNG HỒI SINH
      const local = localMap.get(cloud.id);
      if (!local || Number(cloud.updated_at) > local.updatedAt) {
        localAlbumsToSave.push({
          id: cloud.id,
          title: cloud.title,
          author: cloud.author || undefined,
          coverImage: cloud.cover_image || undefined,
          description: cloud.description || undefined,
          createdAt: Number(cloud.created_at),
          updatedAt: Number(cloud.updated_at),
        });
      }
    }

    if (localAlbumsToSave.length > 0) {
      await db.albums.bulkPut(localAlbumsToSave);
    }
  }

  // --------------------------------------------------------------------------
  // ĐỒNG BỘ PAGES (TỐI ƯU BATCH UPSERT & XỬ LÝ XÓA DỨT ĐIỂM)
  // --------------------------------------------------------------------------
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  private async syncPages(supabase: any) {
    // Xóa trên Cloud các item đã xóa ở Local
    const deletedIds = getDeletedIds('pages');
    if (deletedIds.length > 0) {
      const { error: delErr } = await supabase.from('pages').delete().in('id', deletedIds);
      if (!delErr) {
        clearDeletedIds('pages', deletedIds);
      }
    }

    const localPages = await db.pages.toArray();
    const { data: cloudPages, error } = await supabase.from('pages').select('*');

    if (error) throw new Error(`Lỗi tải Pages từ Cloud: ${error.message}`);

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const cloudMap = new Map<string, any>((cloudPages || []).map((p: any) => [p.id, p]));
    const localMap = new Map<string, PageItem>(localPages.map((p) => [p.id, p]));

    // 2.1 Local -> Cloud: Gom nhóm Batch Upsert
    const pagesToUpsert = [];
    for (const local of localPages) {
      const cloud = cloudMap.get(local.id);
      if (!cloud || local.updatedAt > Number(cloud.updated_at)) {
        pagesToUpsert.push({
          id: local.id,
          album_id: local.albumId,
          title: local.title,
          page_number: String(local.pageNumber || '1'),
          original_image: local.originalImage || null,
          extracted_text: local.extractedText,
          notes_count: local.notesCount || 0,
          created_at: local.createdAt,
          updated_at: local.updatedAt,
        });
      }
    }

    if (pagesToUpsert.length > 0) {
      const { error: upsertErr } = await supabase.from('pages').upsert(pagesToUpsert, { onConflict: 'id' });
      if (upsertErr) throw new Error(`Lỗi lưu Pages lên Cloud: ${upsertErr.message}`);
    }

    // 2.2 Cloud -> Local: Gom nhóm bulkPut vào IndexedDB (chặn hồi sinh các item đã xóa)
    const activeDeletedIds = new Set(getDeletedIds('pages'));
    const localPagesToSave: PageItem[] = [];
    for (const cloud of cloudPages || []) {
      if (activeDeletedIds.has(cloud.id)) continue; // ĐÃ XÓA Ở LOCAL: KHÔNG HỒI SINH
      const local = localMap.get(cloud.id);
      if (!local || Number(cloud.updated_at) > local.updatedAt) {
        localPagesToSave.push({
          id: cloud.id,
          albumId: cloud.album_id,
          title: cloud.title,
          pageNumber: cloud.page_number,
          originalImage: cloud.original_image || undefined,
          extractedText: cloud.extracted_text,
          notesCount: cloud.notes_count || 0,
          createdAt: Number(cloud.created_at),
          updatedAt: Number(cloud.updated_at),
        });
      }
    }

    if (localPagesToSave.length > 0) {
      await db.pages.bulkPut(localPagesToSave);
    }
  }

  // --------------------------------------------------------------------------
  // ĐỒNG BỘ VOCAB_NOTES (TỐI ƯU BATCH UPSERT & XỬ LÝ XÓA DỨT ĐIỂM)
  // --------------------------------------------------------------------------
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  private async syncVocabNotes(supabase: any) {
    // Xóa trên Cloud các item đã xóa ở Local
    const deletedIds = getDeletedIds('vocabNotes');
    if (deletedIds.length > 0) {
      const { error: delErr } = await supabase.from('vocab_notes').delete().in('id', deletedIds);
      if (!delErr) {
        clearDeletedIds('vocabNotes', deletedIds);
      }
    }

    const localNotes = await db.vocabNotes.toArray();
    const { data: cloudNotes, error } = await supabase.from('vocab_notes').select('*');

    if (error) throw new Error(`Lỗi tải Vocab Notes từ Cloud: ${error.message}`);

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const cloudMap = new Map<string, any>((cloudNotes || []).map((n: any) => [n.id, n]));
    const localMap = new Map<string, VocabNote>(localNotes.map((n) => [n.id, n]));

    // 3.1 Local -> Cloud: Gom nhóm Batch Upsert
    const notesToUpsert = [];
    for (const local of localNotes) {
      const cloud = cloudMap.get(local.id);
      if (!cloud || local.updatedAt > Number(cloud.updated_at)) {
        notesToUpsert.push({
          id: local.id,
          album_id: local.albumId || null,
          page_id: local.pageId || null,
          word: local.word,
          phonetic: local.phonetic || null,
          audio_url: local.audioUrl || null,
          part_of_speech: local.partOfSpeech || null,
          meaning: local.meaning,
          memory_type: local.memoryType,
          note: local.note || null,
          example_en: local.exampleEn || null,
          example_vi: local.exampleVi || null,
          context_sentence: local.contextSentence || null,
          image_url: local.imageUrl || null,
          cambridge_url: local.cambridgeUrl || null,
          status: local.status || 'learning',
          next_review_date: local.nextReviewDate || null,
          interval: local.interval ?? 1,
          repetitions: local.repetitions ?? 0,
          ease_factor: local.easeFactor ?? 2.5,
          last_reviewed_at: local.lastReviewedAt || null,
          created_at: local.createdAt,
          updated_at: local.updatedAt,
        });
      }
    }

    if (notesToUpsert.length > 0) {
      const { error: upsertErr } = await supabase.from('vocab_notes').upsert(notesToUpsert, { onConflict: 'id' });
      if (upsertErr) throw new Error(`Lỗi lưu Vocab Notes lên Cloud: ${upsertErr.message}`);
    }

    // 3.2 Cloud -> Local: Gom nhóm bulkPut vào IndexedDB (chặn hồi sinh các item đã xóa)
    const activeDeletedIds = new Set(getDeletedIds('vocabNotes'));
    const localNotesToSave: VocabNote[] = [];
    for (const cloud of cloudNotes || []) {
      if (activeDeletedIds.has(cloud.id)) continue; // ĐÃ XÓA Ở LOCAL: KHÔNG HỒI SINH
      const local = localMap.get(cloud.id);
      if (!local || Number(cloud.updated_at) > local.updatedAt) {
        localNotesToSave.push({
          id: cloud.id,
          albumId: cloud.album_id || undefined,
          pageId: cloud.page_id || undefined,
          word: cloud.word,
          phonetic: cloud.phonetic || undefined,
          audioUrl: cloud.audio_url || undefined,
          partOfSpeech: cloud.part_of_speech || undefined,
          meaning: cloud.meaning,
          memoryType: cloud.memory_type || 'mnemonic',
          note: cloud.note || '',
          exampleEn: cloud.example_en || undefined,
          exampleVi: cloud.example_vi || undefined,
          contextSentence: cloud.context_sentence || undefined,
          imageUrl: cloud.image_url || undefined,
          cambridgeUrl: cloud.cambridge_url || '',
          status: cloud.status || 'learning',
          nextReviewDate: cloud.next_review_date ? Number(cloud.next_review_date) : undefined,
          interval: cloud.interval !== null && cloud.interval !== undefined ? Number(cloud.interval) : 1,
          repetitions: cloud.repetitions !== null && cloud.repetitions !== undefined ? Number(cloud.repetitions) : 0,
          easeFactor: cloud.ease_factor !== null && cloud.ease_factor !== undefined ? Number(cloud.ease_factor) : 2.5,
          lastReviewedAt: cloud.last_reviewed_at ? Number(cloud.last_reviewed_at) : undefined,
          createdAt: Number(cloud.created_at),
          updatedAt: Number(cloud.updated_at),
        });
      }
    }

    if (localNotesToSave.length > 0) {
      await db.vocabNotes.bulkPut(localNotesToSave);
    }
  }

  // --------------------------------------------------------------------------
  // ĐỒNG BỘ REVIEW_LOGS (HEATMAP STREAK)
  // --------------------------------------------------------------------------
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  private async syncReviewLogs(supabase: any) {
    try {
      const localLogs = await db.reviewLogs.toArray();
      if (localLogs.length === 0) return;

      const { data: cloudLogs, error } = await supabase.from('review_logs').select('id');
      if (error) return; // Nếu bảng chưa có trên Cloud, bỏ qua nhẹ nhàng

      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const cloudIdSet = new Set((cloudLogs || []).map((l: any) => l.id));
      const logsToUpsert = localLogs
        .filter((l) => !cloudIdSet.has(l.id))
        .map((l) => ({
          id: l.id,
          note_id: l.noteId,
          rating: l.rating,
          reviewed_at: l.reviewedAt,
          date_str: l.dateStr,
        }));

      if (logsToUpsert.length > 0) {
        await supabase.from('review_logs').upsert(logsToUpsert, { onConflict: 'id' });
      }
    } catch {
      // Bỏ qua nếu người dùng chưa khởi tạo bảng review_logs
    }
  }
}

export const syncService = new SyncService();

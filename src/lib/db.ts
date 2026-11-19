import Dexie, { type Table } from 'dexie';
import { Album, PageItem, VocabNote } from '@/types';

export interface DictCacheItem {
  word: string;
  phonetic: string;
  partOfSpeech: string;
  meaning: string;
  exampleEn?: string;
  exampleVi?: string;
  cambridgeUrl: string;
  googleTranslateUrl: string;
  cachedAt: number;
}

export interface ReviewLog {
  id: string;
  noteId: string;
  rating: number; // 1: Học lại, 2: Khó, 3: Tốt, 4: Dễ
  reviewedAt: number; // timestamp
  dateStr: string; // YYYY-MM-DD
}

export class LyngoDatabase extends Dexie {
  albums!: Table<Album, string>;
  pages!: Table<PageItem, string>;
  vocabNotes!: Table<VocabNote, string>;
  dictCache!: Table<DictCacheItem, string>;
  reviewLogs!: Table<ReviewLog, string>;

  constructor() {
    super('LyngoDatabase');
    this.version(1).stores({
      albums: 'id, title, createdAt, updatedAt',
      pages: 'id, albumId, pageNumber, createdAt',
      vocabNotes: 'id, albumId, pageId, word, memoryType, status, createdAt'
    });
    this.version(2).stores({
      vocabNotes: 'id, albumId, pageId, word, memoryType, status, nextReviewDate, interval, easeFactor, createdAt'
    });
    this.version(3).stores({
      dictCache: 'word, cachedAt'
    });
    this.version(4).stores({
      reviewLogs: 'id, noteId, dateStr, reviewedAt'
    });
  }
}

export const db = new LyngoDatabase();

// Tự động nâng cấp các thẻ từ vựng cũ sang Template chuẩn và kích hoạt SM-2
export async function migrateVocabToAnkiTemplate() {
  try {
    const allNotes = await db.vocabNotes.toArray();
    for (const n of allNotes) {
      let needsUpdate = false;
      const updates: Partial<VocabNote> = {};

      if (n.nextReviewDate === undefined) {
        updates.nextReviewDate = Date.now();
        updates.interval = 1;
        updates.repetitions = 0;
        updates.easeFactor = 2.5;
        needsUpdate = true;
      }

      // Tách ví dụ câu từ trường note cũ nếu có dạng 📖 Ví dụ: "..." (bản dịch)
      if (!n.exampleEn && n.note && n.note.includes('Ví dụ:')) {
        const match = n.note.match(/Ví dụ:\s*"([^"]+)"(?:\s*\(([^)]+)\))?/);
        if (match) {
          updates.exampleEn = match[1];
          if (match[2]) updates.exampleVi = match[2];
          needsUpdate = true;
        }
      }

      if (needsUpdate) {
        await db.vocabNotes.update(n.id, { ...updates, updatedAt: Date.now() });
      }
    }
  } catch (err) {
    console.warn('[Anki Migration] Lỗi di trú thẻ từ vựng:', err);
  }
}

// Hàm khởi tạo dữ liệu mẫu lần đầu để Cô Ly có thể trải nghiệm ngay
export async function seedSampleDataIfEmpty() {
  const albumCount = await db.albums.count();
  if (albumCount > 0) {
    await migrateVocabToAnkiTemplate();
    return;
  }

  const sampleAlbumId = 'sample-album-little-prince';
  const samplePageId = 'sample-page-chapter-1';

  const sampleAlbum: Album = {
    id: sampleAlbumId,
    title: 'The Little Prince',
    author: 'Antoine de Saint-Exupéry',
    description: 'Cuốn sách đầu tiên của Cô Ly trên Lyngo. Câu chuyện kinh điển và ngôn từ tiếng Anh trong trẻo, sâu sắc.',
    coverImage: '',
    createdAt: Date.now() - 86400000 * 2,
    updatedAt: Date.now() - 86400000 * 2,
  };

  const samplePage: PageItem = {
    id: samplePageId,
    albumId: sampleAlbumId,
    title: 'Chapter 1 - The Boa Constrictor',
    pageNumber: 1,
    extractedText: `Once when I was six years old I saw a magnificent picture in a book called True Stories from Nature, about the primeval forest. It was a picture of a boa constrictor in the act of swallowing an animal.

In the book it said: "Boa constrictors swallow their prey whole, without chewing it. After that they are not able to move, and they sleep through the six months that they need for digestion."

I pondered deeply, then, over the adventures of the jungle. And after some work with a colored pencil I succeeded in making my first drawing. My Drawing Number One. It looked something like this:

I showed my masterpiece to the grown-ups, and asked them whether the drawing frightened them. But they answered: "Frighten? Why should anyone be frightened by a hat?"

My drawing was not a picture of a hat. It was a picture of a boa constrictor digesting an elephant. But since the grown-ups were not able to understand it, I made another drawing: I drew the inside of a boa constrictor, so that the grown-ups could see clearly. They always need to have things explained.`,
    createdAt: Date.now() - 86400000 * 2,
    updatedAt: Date.now() - 86400000 * 2,
  };

  const sampleVocab: VocabNote[] = [
    {
      id: 'vocab-1',
      albumId: sampleAlbumId,
      pageId: samplePageId,
      word: 'magnificent',
      phonetic: '/mæɡˈnɪf.ɪ.sənt/',
      partOfSpeech: 'adjective',
      meaning: 'Tráng lệ, nguy nga, cực kỳ ấn tượng',
      memoryType: 'mnemonic',
      note: 'Nhớ theo mẹo: "Mag" trong Magic (kỳ diệu) + "nificent" -> Cảnh tượng kỳ diệu tuyệt đẹp.',
      exampleEn: 'She has a magnificent voice that captivates every audience.',
      exampleVi: 'Cô ấy có một giọng hát tuyệt vời làm say đắm mọi khán giả.',
      contextSentence: 'I saw a magnificent picture in a book called True Stories from Nature.',
      cambridgeUrl: 'https://dictionary.cambridge.org/dictionary/english/magnificent',
      status: 'learning',
      nextReviewDate: Date.now(), // Đến hạn ôn ngay
      interval: 1,
      repetitions: 0,
      easeFactor: 2.5,
      imageUrl: 'https://images.unsplash.com/photo-1518709268805-4e9042af9f23?w=500&auto=format&fit=crop&q=60',
      createdAt: Date.now() - 86400000 * 2,
      updatedAt: Date.now() - 86400000 * 2,
    },
    {
      id: 'vocab-2',
      albumId: sampleAlbumId,
      pageId: samplePageId,
      word: 'pondered deeply',
      phonetic: '/ˈpɒn.dər ˈdiːp.li/',
      partOfSpeech: 'phrase',
      meaning: 'Suy ngẫm sâu sắc, đắn đo kỹ lưỡng',
      memoryType: 'collocation',
      note: 'Collocation kinh điển khi viết: "Ponder deeply over something" (Suy nghĩ đăm chiêu về điều gì).',
      exampleEn: 'He sat in silence and pondered deeply over the difficult decision.',
      exampleVi: 'Anh ấy ngồi im lặng và suy ngẫm sâu sắc về quyết định khó khăn này.',
      contextSentence: 'I pondered deeply, then, over the adventures of the jungle.',
      cambridgeUrl: 'https://dictionary.cambridge.org/dictionary/english/ponder',
      status: 'learning',
      nextReviewDate: Date.now(), // Đến hạn ôn ngay
      interval: 1,
      repetitions: 0,
      easeFactor: 2.5,
      imageUrl: 'https://images.unsplash.com/photo-1544717305-2782549b5136?w=500&auto=format&fit=crop&q=60',
      createdAt: Date.now() - 86400000,
      updatedAt: Date.now() - 86400000,
    },
    {
      id: 'vocab-3',
      albumId: sampleAlbumId,
      pageId: samplePageId,
      word: 'masterpiece',
      phonetic: '/ˈmɑː.stə.piːs/',
      partOfSpeech: 'noun',
      meaning: 'Kiệt tác, tác phẩm xuất sắc nhất',
      memoryType: 'mnemonic',
      note: 'Tách từ: Master (bậc thầy) + Piece (tác phẩm) -> Tác phẩm của bậc thầy = Kiệt tác!',
      exampleEn: 'Leonardo da Vinci created the Mona Lisa, a true masterpiece of art.',
      exampleVi: 'Leonardo da Vinci đã tạo ra nàng Mona Lisa, một kiệt tác nghệ thuật thực thụ.',
      contextSentence: 'I showed my masterpiece to the grown-ups, and asked them whether it frightened them.',
      cambridgeUrl: 'https://dictionary.cambridge.org/dictionary/english/masterpiece',
      status: 'learning',
      nextReviewDate: Date.now(), // Đến hạn ôn ngay
      interval: 1,
      repetitions: 0,
      easeFactor: 2.5,
      imageUrl: 'https://images.unsplash.com/photo-1579783900882-c0d3dad7b119?w=500&auto=format&fit=crop&q=60',
      createdAt: Date.now() - 3600000,
      updatedAt: Date.now() - 3600000,
    }
  ];

  await db.albums.add(sampleAlbum);
  await db.pages.add(samplePage);
  await db.vocabNotes.bulkAdd(sampleVocab);
}

// Xóa bỏ toàn bộ log giả ngẫu nhiên, chỉ giữ lại nhật ký học thật của Cô Ly
export async function seedReviewLogsIfEmpty() {
  try {
    // Dọn dẹp dứt điểm các log giả ngẫu nhiên đã lưu trước đây
    await db.reviewLogs.filter(log => log.id.startsWith('seed-log-')).delete();
  } catch (err) {
    console.warn('Lỗi dọn seed review logs:', err);
  }
}

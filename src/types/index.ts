export type MemoryType = 
  | 'mnemonic'      // Mẹo nhớ liên tưởng / câu chuyện
  | 'collocation'   // Cụm từ đi kèm / Phrasal verb
  | 'context'       // Ngữ cảnh trong sách
  | 'grammar'       // Lưu ý ngữ pháp / cấu trúc
  | 'other';        // Ghi chú khác

export interface VocabNote {
  id: string;
  albumId?: string;
  pageId?: string;
  word: string;             // Từ hoặc cụm từ
  phonetic?: string;        // Phiên âm IPA
  audioUrl?: string;        // Link audio phát âm
  partOfSpeech?: string;    // noun, verb, adj, phrase...
  meaning: string;          // Định nghĩa tiếng Việt súc tích
  englishDefinition?: string; // Định nghĩa tiếng Anh chuẩn Cambridge
  memoryType: MemoryType;   // Kiểu nhớ của cô Ly
  note: string;             // Mẹo liên tưởng / ghi chú cá nhân (mnemonic)

  // Template chuẩn lưu trữ từ vựng (Standard Template)
  exampleEn?: string;       // Câu ví dụ tiếng Anh chuẩn
  exampleVi?: string;       // Bản dịch tiếng Việt của câu ví dụ
  contextSentence?: string; // Câu ngữ cảnh gốc trong trang sách của Cô Ly

  imageUrl?: string;        // Ảnh minh họa đính kèm (base64 hoặc URL)
  cambridgeUrl: string;     // Đường link tới Cambridge Dictionary
  status: 'learning' | 'mastered';

  // Thuật toán Spaced Repetition SuperMemo SM-2 (Anki)
  nextReviewDate?: number;  // Timestamp ngày đến hạn ôn tập tiếp theo
  interval?: number;        // Khoảng cách ôn hiện tại tính theo ngày
  repetitions?: number;     // Số lần nhớ liên tiếp thành công
  easeFactor?: number;      // Hệ số dễ nhớ (mặc định 2.5)
  lastReviewedAt?: number;  // Timestamp lần ôn tập gần nhất

  createdAt: number;
  updatedAt: number;
}

export interface PageItem {
  id: string;
  albumId: string;
  title: string;            // Ví dụ: Trang 1, Chapter 2,...
  pageNumber?: number | string;
  originalImage?: string;   // Ảnh chụp trang sách gốc (base64)
  extractedText: string;    // Văn bản đã scan
  notesCount?: number;
  createdAt: number;
  updatedAt: number;
}

export interface Album {
  id: string;
  title: string;            // Tên cuốn sách (vd: Atomic Habits)
  author?: string;
  coverImage?: string;      // Ảnh bìa sách
  description?: string;
  createdAt: number;
  updatedAt: number;
}

export interface DictionaryDefinition {
  definition: string;
  example?: string;
}

export interface DictionaryMeaning {
  partOfSpeech: string;
  definitions: DictionaryDefinition[];
}

export interface DictionaryData {
  word: string;
  phonetic?: string;
  audio?: string;
  vietnamese?: string;
  partOfSpeech?: string;
  englishDefinition?: string;
  example?: string;
  exampleVi?: string;
  meanings: DictionaryMeaning[];
  googleTranslateUrl?: string;
  cambridgeUrl: string;
}

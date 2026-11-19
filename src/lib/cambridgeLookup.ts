import { db, DictCacheItem } from './db';
import cambridgeData from '@/data/cambridgeDictionary.json';
import { getCambridgeDictionaryUrl, getGoogleTranslateUrl } from './cambridge';

export interface InstantLookupResult {
  word: string;
  phonetic: string;
  partOfSpeech: string;
  meaning: string;
  exampleEn: string;
  exampleVi: string;
  cambridgeUrl: string;
  googleTranslateUrl: string;
  source: 'cambridge-offline' | 'indexeddb-cache' | 'online-fallback';
}

const localDict = cambridgeData as Record<
  string,
  {
    word: string;
    ipa: string;
    pos: string;
    vi: string;
    enEx: string;
    viEx: string;
  }
>;

/**
 * Tra cứu từ vựng siêu tốc phân tầng:
 * 1. Từ điển Cambridge offline nhúng sẵn (0.001s)
 * 2. Bộ nhớ đệm IndexedDB (0.001s)
 * 3. Fallback trực tuyến nhanh (~0.2s) kèm lưu tự động vào Cache
 */
export async function lookupCambridgeInstant(rawWord: string): Promise<InstantLookupResult> {
  const cleanWord = rawWord.trim().toLowerCase().replace(/^[^\w\s-]+|[^\w\s-]+$/g, '');
  if (!cleanWord) {
    return {
      word: rawWord,
      phonetic: '',
      partOfSpeech: '',
      meaning: '',
      exampleEn: '',
      exampleVi: '',
      cambridgeUrl: getCambridgeDictionaryUrl(rawWord),
      googleTranslateUrl: getGoogleTranslateUrl(rawWord),
      source: 'cambridge-offline',
    };
  }

  const cambridgeUrl = getCambridgeDictionaryUrl(cleanWord);
  const googleTranslateUrl = getGoogleTranslateUrl(cleanWord);

  // --------------------------------------------------------------------------
  // TẦNG 1: TỪ ĐIỂN CAMBRIDGE OFFLINE NHÚNG SẴN (0.001s)
  // --------------------------------------------------------------------------
  const offlineEntry = localDict[cleanWord];
  if (offlineEntry) {
    return {
      word: offlineEntry.word || cleanWord,
      phonetic: offlineEntry.ipa || '',
      partOfSpeech: offlineEntry.pos || '',
      meaning: offlineEntry.vi || '',
      exampleEn: offlineEntry.enEx || '',
      exampleVi: offlineEntry.viEx || '',
      cambridgeUrl,
      googleTranslateUrl,
      source: 'cambridge-offline',
    };
  }

  // --------------------------------------------------------------------------
  // TẦNG 2: BỘ NHỚ ĐỆM INDEXEDDB DICT_CACHE (0.001s)
  // --------------------------------------------------------------------------
  try {
    if (typeof window !== 'undefined') {
      const cached = await db.dictCache.get(cleanWord);
      if (cached) {
        return {
          word: cached.word,
          phonetic: cached.phonetic,
          partOfSpeech: cached.partOfSpeech,
          meaning: cached.meaning,
          exampleEn: cached.exampleEn || '',
          exampleVi: cached.exampleVi || '',
          cambridgeUrl: cached.cambridgeUrl || cambridgeUrl,
          googleTranslateUrl: cached.googleTranslateUrl || googleTranslateUrl,
          source: 'indexeddb-cache',
        };
      }
    }
  } catch (err) {
    console.warn('[cambridgeLookup] Lỗi đọc dictCache:', err);
  }

  // --------------------------------------------------------------------------
  // TẦNG 3: TRUY VẤN DỰ PHÒNG QUA API /api/dictionary VÀ LƯU VÀO CACHE (~0.2s)
  // --------------------------------------------------------------------------
  if (typeof window !== 'undefined') {
    try {
      const res = await fetch(`/api/dictionary?word=${encodeURIComponent(cleanWord)}`);
      if (res.ok) {
        const data = await res.json();
        const phonetic = data.phonetic || '';
        const partOfSpeech = data.partOfSpeech || 'từ vựng';
        const meaning = data.vietnamese || (data.meanings?.[0]?.definitions?.[0]?.definition) || '';
        const exampleEn = data.example || (data.meanings?.[0]?.definitions?.[0]?.example) || '';
        const exampleVi = data.exampleVi || '';

        const item: DictCacheItem = {
          word: cleanWord,
          phonetic,
          partOfSpeech,
          meaning,
          exampleEn,
          exampleVi,
          cambridgeUrl,
          googleTranslateUrl,
          cachedAt: Date.now(),
        };

        // Lưu vào cache để lần sau tra cứu tức thì 0ms
        db.dictCache.put(item).catch(() => {});

        return {
          word: cleanWord,
          phonetic,
          partOfSpeech,
          meaning,
          exampleEn,
          exampleVi,
          cambridgeUrl,
          googleTranslateUrl,
          source: 'online-fallback',
        };
      }
    } catch (err) {
      console.warn('[cambridgeLookup] Lỗi gọi online fallback:', err);
    }
  }

  // Fallback cơ bản nếu không có mạng
  return {
    word: cleanWord,
    phonetic: '',
    partOfSpeech: 'từ vựng',
    meaning: '',
    exampleEn: '',
    exampleVi: '',
    cambridgeUrl,
    googleTranslateUrl,
    source: 'online-fallback',
  };
}

import { db, DictCacheItem } from './db';
import cambridgeData from '@/data/cambridgeDictionary.json';
import { getCambridgeDictionaryUrl, getGoogleTranslateUrl } from './cambridge';
import { getStoredGeminiKey } from './settings';

export interface InstantLookupResult {
  word: string;
  phonetic: string;
  partOfSpeech: string;
  meaning: string;
  englishDefinition?: string;
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
    enDef?: string;
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
      englishDefinition: '',
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
  // TẦNG 1: TỪ ĐIỂN CAMBRIDGE OFFLINE NHÚNG SẴN (0.001s) kèm quy chuẩn từ (lemmatization)
  // --------------------------------------------------------------------------
  const candidates = [cleanWord];
  if (cleanWord.endsWith('s') && cleanWord.length > 3) candidates.push(cleanWord.slice(0, -1));
  if (cleanWord.endsWith('es') && cleanWord.length > 4) candidates.push(cleanWord.slice(0, -2));
  if (cleanWord.endsWith('ed') && cleanWord.length > 4) candidates.push(cleanWord.slice(0, -2), cleanWord.slice(0, -1));
  if (cleanWord.endsWith('ing') && cleanWord.length > 5) candidates.push(cleanWord.slice(0, -3), cleanWord.slice(0, -3) + 'e');

  for (const cand of candidates) {
    const offlineEntry = localDict[cand];
    if (offlineEntry) {
      return {
        word: cleanWord,
        phonetic: offlineEntry.ipa || '',
        partOfSpeech: offlineEntry.pos || '',
        meaning: offlineEntry.vi || '',
        englishDefinition: offlineEntry.enDef || '',
        exampleEn: offlineEntry.enEx || '',
        exampleVi: offlineEntry.viEx || '',
        cambridgeUrl,
        googleTranslateUrl,
        source: 'cambridge-offline',
      };
    }
  }

  // --------------------------------------------------------------------------
  // TẦNG 2: BỘ NHỚ ĐỆM INDEXEDDB DICT_CACHE (0.001s)
  // --------------------------------------------------------------------------
  try {
    if (typeof window !== 'undefined') {
      const cached = await db.dictCache.get(cleanWord);
      if (cached && cached.meaning) {
        return {
          word: cached.word,
          phonetic: cached.phonetic,
          partOfSpeech: cached.partOfSpeech,
          meaning: cached.meaning,
          englishDefinition: cached.englishDefinition || '',
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
      const headers: Record<string, string> = {};
      const storedKey = getStoredGeminiKey();
      if (storedKey) {
        headers['x-gemini-key'] = storedKey;
      }

      const res = await fetch(`/api/dictionary?word=${encodeURIComponent(cleanWord)}`, { headers });
      if (res.ok) {
        const data = await res.json();
        const phonetic = data.phonetic || '';
        const partOfSpeech = data.partOfSpeech || 'từ vựng';
        const meaning = data.vietnamese || (data.meanings?.[0]?.definitions?.[0]?.definition) || '';
        const englishDefinition = data.englishDefinition || '';
        const exampleEn = data.example || (data.meanings?.[0]?.definitions?.[0]?.example) || '';
        const exampleVi = data.exampleVi || '';

        const item: DictCacheItem = {
          word: cleanWord,
          phonetic,
          partOfSpeech,
          meaning,
          englishDefinition,
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
          englishDefinition,
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
    englishDefinition: '',
    exampleEn: '',
    exampleVi: '',
    cambridgeUrl,
    googleTranslateUrl,
    source: 'online-fallback',
  };
}

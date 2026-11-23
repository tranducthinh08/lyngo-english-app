import cambridgeData from '@/data/cambridgeDictionary.json';

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
 * Helper sinh link tra cứu trực tiếp trên Google Translate (Mặc định Anh -> Việt)
 */
export function getGoogleTranslateUrl(query: string, from = 'en', to = 'vi'): string {
  return `https://translate.google.com/?sl=${from}&tl=${to}&text=${encodeURIComponent(query.trim())}&op=translate`;
}

/**
 * Helper sinh link tra cứu trực tiếp trên Cambridge Dictionary
 */
export function getCambridgeDictionaryUrl(query: string, lang: 'english' | 'english-vietnamese' = 'english'): string {
  const clean = query
    .trim()
    .toLowerCase()
    .replace(/[^a-zA-Z0-9\s-]/g, '')
    .replace(/\s+/g, '-');
  return `https://dictionary.cambridge.org/dictionary/${lang}/${clean}`;
}

/**
 * Tra cứu nhanh thông tin từ chuẩn Cambridge (IPA, Audio, Nghĩa tiếng Việt, Định nghĩa tiếng Anh, Ví dụ)
 * Phân tầng:
 * 1. Từ điển Cambridge offline nhúng sẵn
 * 2. Kết hợp Google Translate Dictionary + Free Dictionary API
 */
export async function lookupDictionaryWord(rawWord: string) {
  const cleanWord = rawWord.trim().toLowerCase().replace(/^[^\w]+|[^\w]+$/g, '');
  if (!cleanWord) return null;

  const googleTranslateUrl = getGoogleTranslateUrl(cleanWord);
  const cambridgeUrl = getCambridgeDictionaryUrl(cleanWord);

  // 1. Kiểm tra từ điển Cambridge offline nhúng sẵn
  const candidates = [cleanWord];
  if (cleanWord.endsWith('s') && cleanWord.length > 3) candidates.push(cleanWord.slice(0, -1));
  if (cleanWord.endsWith('es') && cleanWord.length > 4) candidates.push(cleanWord.slice(0, -2));
  if (cleanWord.endsWith('ed') && cleanWord.length > 4) candidates.push(cleanWord.slice(0, -2), cleanWord.slice(0, -1));
  if (cleanWord.endsWith('ing') && cleanWord.length > 5) candidates.push(cleanWord.slice(0, -3), cleanWord.slice(0, -3) + 'e');

  for (const cand of candidates) {
    const entry = localDict[cand];
    if (entry) {
      return {
        word: cleanWord,
        phonetic: entry.ipa || '',
        audio: '',
        vietnamese: entry.vi,
        partOfSpeech: entry.pos || 'từ vựng',
        englishDefinition: entry.enDef || entry.enEx || '',
        example: entry.enEx,
        exampleVi: entry.viEx,
        googleTranslateUrl,
        cambridgeUrl,
        meanings: [
          {
            partOfSpeech: entry.pos || 'từ vựng',
            definitions: [
              {
                definition: entry.vi,
                example: entry.enEx ? `${entry.enEx}${entry.viEx ? ` (${entry.viEx})` : ''}` : '',
              },
            ],
          },
        ],
      };
    }
  }

  // 2. Tra cứu trực tuyến đồng thời: Google Translate (Nghĩa tiếng Việt chuẩn) + Dictionary API (IPA & Định nghĩa tiếng Anh)
  const POS_MAP: Record<string, string> = {
    noun: 'danh từ',
    verb: 'động từ',
    adjective: 'tính từ',
    adverb: 'trạng từ',
    interjection: 'thán từ / cảm thán',
    exclamation: 'thán từ / cảm thán',
    preposition: 'giới từ',
    conjunction: 'liên từ',
    pronoun: 'đại từ',
    determiner: 'từ hạn định',
    article: 'mạo từ',
    phrase: 'cụm từ',
    idiom: 'thành ngữ',
  };

  try {
    const [gtRes, dictRes] = await Promise.allSettled([
      fetch(
        `https://clients5.google.com/translate_a/t?client=dict-chrome-ex&sl=en&tl=vi&q=${encodeURIComponent(cleanWord)}`,
        {
          headers: {
            'User-Agent':
              'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
          },
          signal: AbortSignal.timeout(3500),
        }
      ).then((r) => (r.ok ? r.json() : null)),
      fetch(`https://api.dictionaryapi.dev/api/v2/entries/en/${encodeURIComponent(cleanWord)}`, {
        signal: AbortSignal.timeout(3500),
      }).then((r) => (r.ok ? r.json() : null)),
    ]);

    // Trích xuất nghĩa tiếng Việt từ Google Translate
    let vietnamese = '';
    if (gtRes.status === 'fulfilled' && gtRes.value && Array.isArray(gtRes.value) && gtRes.value[0]) {
      vietnamese = String(gtRes.value[0]).trim();
    }

    // Trích xuất IPA, Audio, Part of Speech và English definition từ Dictionary API
    let phonetic = '';
    let audio = '';
    let partOfSpeech = 'từ vựng';
    let englishDefinition = '';
    let example = '';
    let exampleVi = '';

    if (dictRes.status === 'fulfilled' && Array.isArray(dictRes.value) && dictRes.value[0]) {
      const entry = dictRes.value[0];

      // Tìm kiếm phiên âm chuẩn (IPA text) từ danh sách phonetics
      if (entry.phonetics && Array.isArray(entry.phonetics)) {
        const pWithAudio = entry.phonetics.find((p: { audio?: string }) => p.audio && p.audio.length > 0);
        if (pWithAudio) audio = pWithAudio.audio;
        const pWithText = entry.phonetics.find((p: { text?: string }) => p.text && p.text.trim().length > 0);
        if (pWithText) phonetic = pWithText.text.trim();
      }
      if (!phonetic && entry.phonetic) {
        phonetic = entry.phonetic.trim();
      }

      // Duyệt qua tất cả meanings để tìm từ loại chuẩn, định nghĩa và ví dụ đầy đủ nhất
      if (entry.meanings && Array.isArray(entry.meanings)) {
        for (const m of entry.meanings) {
          const rawPos = (m.partOfSpeech || '').toLowerCase();
          if (partOfSpeech === 'từ vựng' && POS_MAP[rawPos]) {
            partOfSpeech = POS_MAP[rawPos];
          }

          if (m.definitions && Array.isArray(m.definitions)) {
            for (const d of m.definitions) {
              if (!englishDefinition && d.definition) {
                englishDefinition = d.definition.trim();
              }
              if (!example && d.example) {
                example = d.example.trim();
              }
            }
          }
        }
      }
    }

    // Nếu chưa có ví dụ từ từ điển, tạo một ví dụ ngắn tự nhiên
    if (!example) {
      if (cleanWord === 'hello' || cleanWord === 'hi') {
        example = 'Hello! Nice to meet you.';
      } else {
        example = `She learned how to use the word "${cleanWord}" correctly.`;
      }
    }

    // Dịch câu ví dụ sang tiếng Việt nếu có câu ví dụ
    if (example) {
      try {
        const transExRes = await fetch(
          `https://clients5.google.com/translate_a/t?client=dict-chrome-ex&sl=en&tl=vi&q=${encodeURIComponent(example)}`,
          {
            headers: {
              'User-Agent':
                'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
            },
            signal: AbortSignal.timeout(2000),
          }
        );
        if (transExRes.ok) {
          const transExData = await transExRes.json();
          if (Array.isArray(transExData) && transExData[0]) {
            exampleVi = String(transExData[0]).trim();
          }
        }
      } catch {
        // Bỏ qua nếu dịch ví dụ lỗi
      }
    }

    const finalMeaning = vietnamese || englishDefinition || cleanWord;

    return {
      word: cleanWord,
      phonetic,
      audio,
      vietnamese: finalMeaning,
      partOfSpeech,
      englishDefinition,
      example,
      exampleVi,
      googleTranslateUrl,
      cambridgeUrl,
      meanings: [
        {
          partOfSpeech,
          definitions: [
            {
              definition: finalMeaning,
              example: example ? `${example}${exampleVi ? ` (${exampleVi})` : ''}` : '',
            },
          ],
        },
      ],
    };
  } catch (err) {
    console.error('Lỗi khi tra từ trực tuyến:', err);
    return {
      word: cleanWord,
      phonetic: '',
      audio: '',
      vietnamese: cleanWord,
      partOfSpeech: 'từ vựng',
      englishDefinition: '',
      example: '',
      exampleVi: '',
      googleTranslateUrl,
      cambridgeUrl,
      meanings: [],
    };
  }
}

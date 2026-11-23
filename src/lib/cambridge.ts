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

    if (dictRes.status === 'fulfilled' && Array.isArray(dictRes.value) && dictRes.value[0]) {
      const entry = dictRes.value[0];

      if (entry.phonetics && Array.isArray(entry.phonetics)) {
        const pWithAudio = entry.phonetics.find((p: { audio?: string }) => p.audio && p.audio.length > 0);
        if (pWithAudio) audio = pWithAudio.audio;
        const pWithText = entry.phonetics.find((p: { text?: string }) => p.text);
        if (pWithText) phonetic = pWithText.text;
      }
      if (!phonetic && entry.phonetic) {
        phonetic = entry.phonetic;
      }

      if (entry.meanings && Array.isArray(entry.meanings) && entry.meanings[0]) {
        const firstMeaning = entry.meanings[0];
        partOfSpeech = firstMeaning.partOfSpeech || 'từ vựng';
        const defObj = firstMeaning.definitions?.[0];
        if (defObj) {
          englishDefinition = defObj.definition || '';
          example = defObj.example || '';
        }
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
      exampleVi: '',
      googleTranslateUrl,
      cambridgeUrl,
      meanings: [
        {
          partOfSpeech,
          definitions: [
            {
              definition: finalMeaning,
              example,
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

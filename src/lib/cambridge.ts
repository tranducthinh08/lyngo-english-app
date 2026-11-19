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
 * Tra cứu nhanh thông tin từ (IPA, Audio, Meaning)
 * Dùng Free Dictionary API và trả về kèm link Google Translate & Cambridge
 */
export async function lookupDictionaryWord(rawWord: string) {
  const cleanWord = rawWord.trim().toLowerCase().replace(/^[^\w]+|[^\w]+$/g, '');
  if (!cleanWord) return null;

  const googleTranslateUrl = getGoogleTranslateUrl(cleanWord);
  const cambridgeUrl = getCambridgeDictionaryUrl(cleanWord);

  try {
    const res = await fetch(`https://api.dictionaryapi.dev/api/v2/entries/en/${encodeURIComponent(cleanWord)}`);
    if (!res.ok) {
      return {
        word: cleanWord,
        phonetic: '',
        audio: '',
        googleTranslateUrl,
        cambridgeUrl,
        meanings: [
          {
            partOfSpeech: 'từ vựng',
            definitions: [
              {
                definition: 'Bấm nút Google Translate bên dưới để xem bản dịch tiếng Việt chi tiết.',
                example: ''
              }
            ]
          }
        ]
      };
    }

    const data = await res.json();
    if (!Array.isArray(data) || data.length === 0) {
      return {
        word: cleanWord,
        phonetic: '',
        audio: '',
        googleTranslateUrl,
        cambridgeUrl,
        meanings: []
      };
    }

    const entry = data[0];
    
    // Tìm audio tiếng Anh
    let audio = '';
    if (entry.phonetics && Array.isArray(entry.phonetics)) {
      const phoneticWithAudio = entry.phonetics.find((p: { audio?: string }) => p.audio && p.audio.length > 0);
      if (phoneticWithAudio) {
        audio = phoneticWithAudio.audio;
      }
    }

    // Tìm phonetic IPA
    let phonetic = entry.phonetic || '';
    if (!phonetic && entry.phonetics && Array.isArray(entry.phonetics)) {
      const pWithText = entry.phonetics.find((p: { text?: string }) => p.text);
      if (pWithText) phonetic = pWithText.text;
    }

    return {
      word: entry.word || cleanWord,
      phonetic,
      audio,
      googleTranslateUrl,
      cambridgeUrl,
      meanings: (entry.meanings || []).slice(0, 3).map((m: { partOfSpeech?: string; definitions?: Array<{ definition?: string; example?: string }> }) => ({
        partOfSpeech: m.partOfSpeech || 'general',
        definitions: (m.definitions || []).slice(0, 2).map(d => ({
          definition: d.definition || '',
          example: d.example || ''
        }))
      }))
    };
  } catch (err) {
    console.error('Lỗi khi tra từ:', err);
    return {
      word: cleanWord,
      phonetic: '',
      audio: '',
      googleTranslateUrl,
      cambridgeUrl,
      meanings: []
    };
  }
}

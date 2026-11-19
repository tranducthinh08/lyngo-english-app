export interface SentenceBlock {
  text: string;
  globalIndex: number;
}

export interface ParagraphBlock {
  paragraphIndex: number;
  sentences: SentenceBlock[];
}

/**
 * Tách một khối đoạn văn bản thành các câu hoàn chỉnh, tránh ngắt ở viết tắt (Mr., Dr., D. Friedman, v.v.)
 */
function splitParagraphIntoSentences(para: string): string[] {
  const cleanPara = para.trim();
  if (!cleanPara) return [];

  // Tách câu theo dấu chấm/chấm than/chấm hỏi khi theo sau là khoảng trắng + chữ hoa/ngoặc kép, hoặc cuối chuỗi
  const regex = /([^.!?]+[.!?]+(?=\s+["'A-Z]|$)|[^.!?]+$)/g;
  const matches = cleanPara.match(regex);

  if (!matches || matches.length === 0) {
    return [cleanPara];
  }

  const result: string[] = [];
  for (let i = 0; i < matches.length; i++) {
    let sent = matches[i].trim();
    if (!sent) continue;

    // Kiểm tra các trường hợp viết tắt tên riêng hoặc học vị (vd: "Stewart D.", "Mr.", "Mrs.", "Dr.", "e.g.", "i.e.")
    const isInitialOrAbbr = /\b[A-Z]\.$|\b(Mr|Mrs|Ms|Dr|Prof|Sr|Jr|vs|etc|e\.g|i\.e)\.$/i.test(sent);
    if (isInitialOrAbbr && i + 1 < matches.length) {
      sent = sent + ' ' + matches[i + 1].trim();
      i++;
    }

    result.push(sent);
  }

  return result.length > 0 ? result : [cleanPara];
}

/**
 * Phân tích cấu trúc đoạn văn & câu đồng bộ 100% cho cả trình đọc giọng nói và giao diện
 */
export function getStructuredParagraphs(text: string): {
  paragraphs: ParagraphBlock[];
  flatSentences: string[];
} {
  if (!text) {
    return { paragraphs: [], flatSentences: [] };
  }

  const rawParagraphs = text.split(/\n\s*\n/).filter((p) => p.trim().length > 0);
  const paragraphs: ParagraphBlock[] = [];
  const flatSentences: string[] = [];

  let globalCounter = 0;

  rawParagraphs.forEach((rawP, pIdx) => {
    const sents = splitParagraphIntoSentences(rawP);
    const sentenceBlocks: SentenceBlock[] = [];

    sents.forEach((s) => {
      sentenceBlocks.push({
        text: s,
        globalIndex: globalCounter,
      });
      flatSentences.push(s);
      globalCounter++;
    });

    paragraphs.push({
      paragraphIndex: pIdx,
      sentences: sentenceBlocks,
    });
  });

  return { paragraphs, flatSentences };
}

/**
 * Tách một văn bản tiếng Anh thành danh sách các câu hoàn chỉnh (dùng cho Web Speech API)
 */
export function splitIntoSentences(text: string): string[] {
  return getStructuredParagraphs(text).flatSentences;
}

/**
 * Lấy danh sách giọng đọc tiếng Anh khả dụng trên trình duyệt
 */
export function getEnglishVoices(): SpeechSynthesisVoice[] {
  if (typeof window === 'undefined' || !window.speechSynthesis) return [];
  const voices = window.speechSynthesis.getVoices();
  return voices.filter((v) => v.lang && v.lang.toLowerCase().startsWith('en'));
}

/**
 * Chọn giọng đọc tiếng Anh tự nhiên và ổn định nhất (ưu tiên giọng Local trên macOS/Windows)
 */
export function getBestEnglishVoice(): SpeechSynthesisVoice | null {
  const voices = getEnglishVoices();
  if (voices.length === 0) return null;

  // Ưu tiên các giọng cục bộ (local/system voices) trên máy Mac & Windows vì không bao giờ bị nghẽn mạng
  const preferred = [
    'Samantha',
    'Karen',
    'Daniel',
    'Alex',
    'Victoria',
    'Oliver',
    'Serena',
    'Google US English',
    'Google UK English Female',
    'Microsoft Zira',
    'Microsoft David',
    'en-US',
    'en-GB',
  ];

  for (const pref of preferred) {
    const found = voices.find((v) => v.name.includes(pref) || v.lang.includes(pref));
    if (found) return found;
  }

  // Ưu tiên giọng localService
  const localVoice = voices.find((v) => v.localService);
  if (localVoice) return localVoice;

  return voices[0];
}

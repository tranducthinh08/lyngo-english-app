import { NextRequest, NextResponse } from 'next/server';
import { getGoogleTranslateUrl, getCambridgeDictionaryUrl, lookupDictionaryWord } from '@/lib/cambridge';
import { generateVocabImageUrl } from '@/lib/imageGenerator';

export const dynamic = 'force-dynamic';

const MODELS = ['gemini-3.1-flash-lite', 'gemini-3.5-flash', 'gemini-flash-latest'];

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const rawWord = (body.word || '').trim().slice(0, 100);
    const rawContext = (body.context || '').trim().slice(0, 500);

    // Chuẩn hóa và làm sạch chuỗi đầu vào tránh prompt injection / vỡ cú pháp JSON
    const word = rawWord.replace(/["\\]/g, ' ').replace(/\s+/g, ' ').trim();
    const contextSentence = rawContext.replace(/["\\]/g, ' ').replace(/\s+/g, ' ').trim();

    if (!word) {
      return NextResponse.json({ error: 'Thiếu từ vựng cần tạo thẻ meow~' }, { status: 400 });
    }

    const apiKey = (process.env.GEMINI_API_KEY || '').trim();
    const googleTranslateUrl = getGoogleTranslateUrl(word);
    const cambridgeUrl = getCambridgeDictionaryUrl(word);

    // 1. NẾU CÓ GEMINI API KEY: TỰ ĐỘNG SÁNG TẠO ĐẦY ĐỦ BẰNG AI
    if (apiKey) {
      const prompt = `You are an expert English mnemonic coach for Vietnamese students.
For the English word/phrase "${word}"${contextSentence ? ` (used in this context: "${contextSentence}")` : ''},
generate a complete flashcard in JSON for a student named Cô Ly.

Return ONLY a single valid JSON object between { and } with these exact keys:
{
  "word": "${word}",
  "phonetic": "Standard IPA phonetic transcription, e.g. /ˈstæɡ.nənt/",
  "partOfSpeech": "Vietnamese part of speech, e.g. danh từ, tính từ, động từ",
  "meaning": "Concise natural Vietnamese definition",
  "mnemonic": "A witty, creative Vietnamese mnemonic story or sound-alike wordplay to make this word memorable",
  "exampleEn": "A clear, natural English sentence demonstrating usage",
  "exampleVi": "Vietnamese translation of the example sentence",
  "memoryType": "mnemonic"
}`;

      for (const modelCandidate of MODELS) {
        try {
          const res = await fetch(
            `https://generativelanguage.googleapis.com/v1beta/models/${modelCandidate}:generateContent?key=${encodeURIComponent(apiKey)}`,
            {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({
                contents: [{ parts: [{ text: prompt }] }],
                generationConfig: {
                  temperature: 0.2,
                  maxOutputTokens: 400,
                  thinkingConfig: { thinkingBudget: 0 }
                }
              }),
              signal: AbortSignal.timeout(7500)
            }
          );

          if (res.ok) {
            const data = await res.json();
            const rawText = data.candidates?.[0]?.content?.parts?.[0]?.text || '';
            const jsonMatch = rawText.match(/\{[\s\S]*\}/);

            if (jsonMatch) {
              const parsed = JSON.parse(jsonMatch[0]);

              const mnemonic = parsed.mnemonic || '';
              const exampleEn = parsed.exampleEn || '';
              const exampleVi = parsed.exampleVi || '';
              const finalMeaning = parsed.meaning || '';
              const imageUrl = generateVocabImageUrl({
                word: parsed.word || word,
                meaning: finalMeaning,
                mnemonic: mnemonic.trim(),
                partOfSpeech: parsed.partOfSpeech || '',
              });

              return NextResponse.json({
                word: parsed.word || word,
                phonetic: parsed.phonetic || '',
                meaning: finalMeaning,
                note: mnemonic.trim(),
                mnemonic: mnemonic.trim(),
                partOfSpeech: parsed.partOfSpeech || '',
                exampleEn: exampleEn.trim(),
                exampleVi: exampleVi.trim(),
                contextSentence: contextSentence.trim(),
                memoryType: parsed.memoryType || 'mnemonic',
                imageUrl,
                googleTranslateUrl,
                cambridgeUrl
              });
            }
          }
        } catch (modelErr) {
          console.warn(`[gen-card] Model ${modelCandidate} failed, trying next:`, modelErr);
        }
      }
    }

    // 2. FALLBACK SANG TỪ ĐIỂN NẾU AI TẠM BẬN
    const dict = await lookupDictionaryWord(word);
    const meaning = dict?.meanings?.[0]?.definitions?.[0]?.definition || '';
    const example = dict?.meanings?.[0]?.definitions?.[0]?.example || '';
    const partOfSpeech = dict?.meanings?.[0]?.partOfSpeech || '';
    const imageUrl = generateVocabImageUrl({
      word,
      meaning,
      partOfSpeech,
    });

    return NextResponse.json({
      word,
      phonetic: dict?.phonetic || '',
      meaning: meaning || 'Đang cập nhật nghĩa...',
      partOfSpeech,
      note: 'Mẹo nhớ: Đặt một câu với từ này để nhớ lâu hơn.',
      mnemonic: 'Mẹo nhớ: Đặt một câu với từ này để nhớ lâu hơn.',
      exampleEn: example || '',
      exampleVi: '',
      contextSentence: contextSentence.trim(),
      memoryType: 'context',
      imageUrl,
      googleTranslateUrl,
      cambridgeUrl
    });
  } catch (error: unknown) {
    console.error('Error in /api/gen-card:', error);
    return NextResponse.json({ error: 'Không thể tự động tạo thẻ' }, { status: 500 });
  }
}

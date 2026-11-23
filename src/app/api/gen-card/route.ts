import { NextRequest, NextResponse } from 'next/server';
import { getGoogleTranslateUrl, getCambridgeDictionaryUrl, lookupDictionaryWord } from '@/lib/cambridge';
import { generateVocabImageUrl } from '@/lib/imageGenerator';

export const dynamic = 'force-dynamic';

const MODELS = ['gemini-3.5-flash-lite', 'gemini-flash-latest'];

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

    const customKey = (body.apiKey as string | null) || req.headers.get('x-gemini-key');
    const apiKey = (customKey || process.env.GEMINI_API_KEY || '').trim();
    const googleTranslateUrl = getGoogleTranslateUrl(word);
    const cambridgeUrl = getCambridgeDictionaryUrl(word);

    // 1. NẾU CÓ GEMINI API KEY: TỰ ĐỘNG SÁNG TẠO ĐẦY ĐỦ BẰNG AI
    if (apiKey) {
      const prompt = `You are an expert Cambridge English-Vietnamese lexicographer and mnemonic coach for Cô Ly.
For the English word/phrase "${word}"${contextSentence ? ` (used in this context: "${contextSentence}")` : ''},
generate a complete, rich Cambridge flashcard in JSON.

Return ONLY a single valid JSON object between { and } with these exact keys:
{
  "word": "${word}",
  "phonetic": "Standard Cambridge IPA phonetic transcription, e.g. /ˈhəˈləʊ/",
  "partOfSpeech": "Vietnamese part of speech, e.g. thán từ, danh từ, tính từ, động từ, trạng từ",
  "meaning": "Concise natural Vietnamese definition",
  "englishDefinition": "Authentic Cambridge-style clear English definition",
  "mnemonic": "A witty, creative Vietnamese mnemonic story or sound-alike wordplay to make this word memorable for Cô Ly",
  "exampleEn": "A clear, natural English sentence demonstrating usage",
  "exampleVi": "Accurate Vietnamese translation of the example sentence",
  "memoryType": "mnemonic"
}`;

      for (const modelCandidate of MODELS) {
        try {
          const res = await fetch(
            `https://generativelanguage.googleapis.com/v1beta/models/${modelCandidate}:generateContent`,
            {
              method: 'POST',
              headers: {
                'Content-Type': 'application/json',
                'x-goog-api-key': apiKey,
              },
              body: JSON.stringify({
                contents: [{ parts: [{ text: prompt }] }],
                generationConfig: {
                  temperature: 0.2,
                  maxOutputTokens: 400,
                  thinkingConfig: { thinkingBudget: 0 }
                }
              }),
              signal: AbortSignal.timeout(6000)
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
              const englishDefinition = parsed.englishDefinition || '';
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
                englishDefinition,
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
    const meaning = dict?.vietnamese || dict?.meanings?.[0]?.definitions?.[0]?.definition || '';
    const example = dict?.example || dict?.meanings?.[0]?.definitions?.[0]?.example || '';
    const exampleVi = dict?.exampleVi || '';
    const partOfSpeech = dict?.partOfSpeech || '';
    const englishDefinition = dict?.englishDefinition || '';
    const defaultMnemonic = `Mẹo nhớ: Hãy đặt câu với "${word}" (${partOfSpeech}) để ghi nhớ lâu hơn nhé Cô Ly!`;

    const imageUrl = generateVocabImageUrl({
      word,
      meaning,
      partOfSpeech,
    });

    return NextResponse.json({
      word,
      phonetic: dict?.phonetic || '',
      meaning: meaning || 'Đang cập nhật nghĩa...',
      englishDefinition,
      partOfSpeech,
      note: defaultMnemonic,
      mnemonic: defaultMnemonic,
      exampleEn: example || '',
      exampleVi: exampleVi || '',
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

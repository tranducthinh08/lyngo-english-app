import { NextRequest, NextResponse } from 'next/server';
import { lookupDictionaryWord, getGoogleTranslateUrl, getCambridgeDictionaryUrl } from '@/lib/cambridge';

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const word = (searchParams.get('word') || '').trim();

  if (!word) {
    return NextResponse.json({ error: 'Missing word parameter' }, { status: 400 });
  }

  const customKey = req.headers.get('x-gemini-key');
  const apiKey = (customKey || process.env.GEMINI_API_KEY || '').trim();
  const googleTranslateUrl = getGoogleTranslateUrl(word);
  const cambridgeUrl = getCambridgeDictionaryUrl(word);

  // 1. Nếu có Gemini API Key, dùng Gemini để dịch nghĩa tiếng Việt & định nghĩa Cambridge chuẩn xác nhất
  if (apiKey) {
    const CANDIDATE_MODELS = ['gemini-3.5-flash-lite', 'gemini-flash-latest'];
    for (const modelCandidate of CANDIDATE_MODELS) {
      try {
        const prompt = `You are a professional Cambridge English-Vietnamese Dictionary lexicographer.
Provide an accurate, complete Cambridge dictionary entry for the English word or phrase: "${word}".
Return ONLY a valid JSON object without markdown fences, with these exact keys:
"word": string (the normalized word),
"phonetic": string (standard IPA phonetics, e.g. "/ˈpɪk.tʃər/"),
"partOfSpeech": string (part of speech in Vietnamese, e.g. "thán từ", "danh từ", "động từ", "tính từ", "trạng từ", "cụm từ"),
"vietnamese": string (accurate, concise Vietnamese translation of meaning),
"englishDefinition": string (authentic Cambridge-style clear English definition),
"example": string (a natural example sentence in English demonstrating usage),
"exampleVi": string (accurate Vietnamese translation of the example sentence),
"mnemonic": string (a witty, fun Vietnamese mnemonic hook or sound-alike wordplay to remember this word easily)`;

        const geminiRes = await fetch(
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
                temperature: 0.1,
                maxOutputTokens: 350,
                thinkingConfig: { thinkingBudget: 0 }
              }
            }),
            signal: AbortSignal.timeout(4000)
          }
        );

        if (geminiRes.ok) {
          const data = await geminiRes.json();
          const rawText = data.candidates?.[0]?.content?.parts?.[0]?.text || '';
          const cleanJson = rawText.replace(/^```[a-z]*\n?/i, '').replace(/\n?```$/i, '').trim();
          const parsed = JSON.parse(cleanJson);

          return NextResponse.json({
            word: parsed.word || word,
            phonetic: parsed.phonetic || '',
            vietnamese: parsed.vietnamese || '',
            partOfSpeech: parsed.partOfSpeech || 'từ vựng',
            englishDefinition: parsed.englishDefinition || '',
            example: parsed.example || '',
            exampleVi: parsed.exampleVi || '',
            mnemonic: parsed.mnemonic || '',
            googleTranslateUrl,
            cambridgeUrl,
            meanings: [
              {
                partOfSpeech: parsed.partOfSpeech || 'từ vựng',
                definitions: [
                  {
                    definition: parsed.englishDefinition || parsed.vietnamese,
                    example: parsed.example ? `${parsed.example}${parsed.exampleVi ? ` (${parsed.exampleVi})` : ''}` : ''
                  }
                ]
              }
            ]
          });
        }
      } catch (err) {
        console.warn(`[api/dictionary] Model ${modelCandidate} failed or timed out:`, err);
      }
    }
  }

  // 2. Fallback sang Free Dictionary API + Google Translate đầy đủ
  const dictData = await lookupDictionaryWord(word);
  const mnemonicFallback = `Mẹo nhớ: Đặt câu ví dụ hoặc liên tưởng từ "${word}" (${dictData?.partOfSpeech || ''}) với tình huống quen thuộc!`;
  return NextResponse.json({
    ...dictData,
    mnemonic: mnemonicFallback,
    googleTranslateUrl,
    cambridgeUrl
  });
}

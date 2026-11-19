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

  // 1. Nếu có Gemini API Key, dùng Gemini để dịch nghĩa tiếng Việt chuẩn xác nhất
  if (apiKey) {
    try {
      const prompt = `Translate this English word or phrase into Vietnamese. Return ONLY valid JSON with keys "word", "phonetic", "vietnamese", "partOfSpeech", "example", "exampleVi":
Word: "${word}"`;

      const geminiRes = await fetch(
        `https://generativelanguage.googleapis.com/v1beta/models/gemini-3.1-flash-lite:generateContent`,
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
              maxOutputTokens: 250,
              thinkingConfig: { thinkingBudget: 0 }
            }
          }),
          signal: AbortSignal.timeout(3500) // Timeout 3.5s
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
          example: parsed.example || '',
          exampleVi: parsed.exampleVi || '',
          googleTranslateUrl,
          cambridgeUrl,
          meanings: [
            {
              partOfSpeech: parsed.partOfSpeech || 'nghĩa',
              definitions: [
                {
                  definition: parsed.vietnamese,
                  example: parsed.example ? `${parsed.example} (${parsed.exampleVi || ''})` : ''
                }
              ]
            }
          ]
        });
      }
    } catch (err) {
      console.warn('Gemini quick translation timed out or failed, falling back:', err);
    }
  }

  // 2. Fallback sang Free Dictionary API
  const dictData = await lookupDictionaryWord(word);
  return NextResponse.json({
    ...dictData,
    googleTranslateUrl,
    cambridgeUrl
  });
}

import { NextRequest, NextResponse } from 'next/server';

export const dynamic = 'force-dynamic';

/**
 * Tách văn bản dài thành các đoạn nhỏ <= 180 ký tự theo ranh giới từ
 * để không vượt quá giới hạn query của Google Translate TTS (tw-ob)
 */
function splitTextForTts(text: string, maxLen = 180): string[] {
  if (text.length <= maxLen) return [text];

  const words = text.split(/\s+/);
  const chunks: string[] = [];
  let current = '';

  for (const word of words) {
    if (!current) {
      current = word;
    } else if ((current + ' ' + word).length <= maxLen) {
      current += ' ' + word;
    } else {
      chunks.push(current);
      current = word;
    }
  }
  if (current) {
    chunks.push(current);
  }
  return chunks;
}

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const text = (searchParams.get('text') || '').trim();
  const lang = searchParams.get('lang') || 'en';

  if (!text) {
    return NextResponse.json({ error: 'Missing text parameter' }, { status: 400 });
  }

  try {
    const chunks = splitTextForTts(text, 180);

    // Gọi song song các đoạn âm thanh từ Google TTS
    const buffers = await Promise.all(
      chunks.map(async (chunk) => {
        const googleTtsUrl = `https://translate.google.com/translate_tts?ie=UTF-8&tl=${encodeURIComponent(lang)}&client=tw-ob&q=${encodeURIComponent(chunk)}`;

        const res = await fetch(googleTtsUrl, {
          headers: {
            'User-Agent':
              'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
            Referer: 'https://translate.google.com/',
          },
        });

        if (!res.ok) {
          throw new Error(`Google TTS error ${res.status}`);
        }

        return res.arrayBuffer();
      })
    );

    // Nối trực tiếp các frame nhị phân MPEG của MP3
    const totalLength = buffers.reduce((acc, b) => acc + b.byteLength, 0);
    const combined = new Uint8Array(totalLength);
    let offset = 0;
    for (const b of buffers) {
      combined.set(new Uint8Array(b), offset);
      offset += b.byteLength;
    }

    return new NextResponse(combined, {
      headers: {
        'Content-Type': 'audio/mpeg',
        'Cache-Control': 'public, max-age=86400',
      },
    });
  } catch (error: unknown) {
    console.error('Error fetching Google TTS:', error);
    return NextResponse.json({ error: 'Failed to generate speech audio' }, { status: 500 });
  }
}

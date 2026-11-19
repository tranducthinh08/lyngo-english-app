import { NextRequest, NextResponse } from 'next/server';

export const dynamic = 'force-dynamic';

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const rawWord = searchParams.get('word') || '';
    const word = rawWord.trim().slice(0, 80);

    if (!word) {
      return NextResponse.json({ images: [] });
    }

    // Tạo query tìm kiếm ảnh nghệ thuật / nhiếp ảnh chất lượng cao
    const query = `${word} high quality photography aesthetic`;
    const tokenRes = await fetch(`https://duckduckgo.com/?q=${encodeURIComponent(query)}`, {
      headers: {
        'User-Agent':
          'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
      },
      signal: AbortSignal.timeout(4500),
    });

    const html = await tokenRes.text();
    const vqdMatch = html.match(/vqd=([\d-]+)/);

    if (!vqdMatch) {
      return NextResponse.json({ images: [] });
    }

    const vqd = vqdMatch[1];
    const imgRes = await fetch(
      `https://duckduckgo.com/i.js?l=us-en&o=json&q=${encodeURIComponent(query)}&vqd=${vqd}&f=,,,type:photo,`,
      {
        headers: {
          'User-Agent':
            'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
        },
        signal: AbortSignal.timeout(4500),
      }
    );

    const data = await imgRes.json();
    const results: string[] = [];

    if (Array.isArray(data.results)) {
      for (const item of data.results) {
        if (item.image && typeof item.image === 'string' && item.image.startsWith('http')) {
          results.push(item.image);
          if (results.length >= 6) break;
        }
      }
    }

    return NextResponse.json({ images: results });
  } catch (err) {
    console.warn('Lỗi tìm kiếm ảnh thực tế:', err);
    return NextResponse.json({ images: [] });
  }
}

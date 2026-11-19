import { NextRequest, NextResponse } from 'next/server';

export const maxDuration = 60; // 60 seconds timeout

// Danh sách các model Gemini ưu tiên theo thứ tự tốc độ & khả năng phản hồi (tinh gọn để tránh cascade kéo dài)
const GEMINI_CANDIDATES = [
  'gemini-3.1-flash-lite',
  'gemini-3.5-flash',
  'gemini-3.8-flash',
];

export async function POST(req: NextRequest) {
  const startTime = Date.now();

  try {
    const formData = await req.formData();
    const file = formData.get('image') as File | null;
    const base64Data = formData.get('base64') as string | null;
    const engine = (formData.get('engine') as string | null) || 'gemini';
    const customKey = (formData.get('apiKey') as string | null) || req.headers.get('x-gemini-key');
    const groqKey = (formData.get('groqApiKey') as string | null) || req.headers.get('x-groq-key') || process.env.GROQ_API_KEY || '';

    const geminiApiKey = (customKey || process.env.GEMINI_API_KEY || '').trim();

    let mimeType = 'image/jpeg';
    let imageBytesBase64 = '';

    if (file) {
      mimeType = file.type || 'image/jpeg';
      const arrayBuffer = await file.arrayBuffer();
      imageBytesBase64 = Buffer.from(arrayBuffer).toString('base64');
    } else if (base64Data) {
      if (base64Data.includes(';base64,')) {
        const parts = base64Data.split(';base64,');
        mimeType = parts[0].replace('data:', '');
        imageBytesBase64 = parts[1];
      } else {
        imageBytesBase64 = base64Data;
      }
    } else {
      return NextResponse.json({ error: 'Không tìm thấy hình ảnh trang sách tải lên' }, { status: 400 });
    }

    const ocrPrompt = `You are a high-precision OCR assistant for physical English books.
Transcribe all English text from this book photograph faithfully.
Rules:
1. Fix hyphenated line breaks (e.g. "infor- / mation" -> "information").
2. Preserve original paragraph structure with double newlines.
3. Ignore fingers holding the page, book binding shadows, or background noise.
4. Output ONLY the raw English text. Do not wrap in markdown codeblocks (no \`\`\`), no introductory or concluding chatter.`;

    // -------------------------------------------------------------
    // 1. NẾU CHỌN ĐỘNG CƠ GROQ LPU (Siêu tốc < 1s)
    // -------------------------------------------------------------
    if (engine === 'groq') {
      if (!groqKey) {
        return NextResponse.json({
          error: 'Chưa có Groq API Key. Cô Ly có thể nhập API Key miễn phí từ console.groq.com hoặc chuyển sang Gemini AI nhé! 🐾'
        }, { status: 400 });
      }

      const groqRes = await fetch('https://api.groq.com/openai/v1/chat/completions', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${groqKey}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          model: 'llama-3.2-11b-vision-preview',
          messages: [
            {
              role: 'user',
              content: [
                { type: 'text', text: ocrPrompt },
                {
                  type: 'image_url',
                  image_url: {
                    url: `data:${mimeType};base64,${imageBytesBase64}`
                  }
                }
              ]
            }
          ],
          temperature: 0.1,
          max_tokens: 2500
        }),
        cache: 'no-store'
      });

      const groqData = await groqRes.json();
      if (!groqRes.ok) {
        throw new Error(groqData.error?.message || `Groq API báo lỗi mã ${groqRes.status}`);
      }

      let textResult = groqData.choices?.[0]?.message?.content || '';
      textResult = textResult.replace(/^```[a-z]*\n?/i, '').replace(/\n?```$/i, '').trim();

      return NextResponse.json({
        text: textResult,
        modelUsed: 'Groq Llama-3.2 11B Vision',
        engine: 'groq',
        durationSeconds: ((Date.now() - startTime) / 1000).toFixed(1),
        isDemo: false
      });
    }

    // -------------------------------------------------------------
    // 2. NẾU CHỌN ĐỘNG CƠ GEMINI AI (Cascade thông minh & tắt Thinking ngầm)
    // -------------------------------------------------------------
    if (!geminiApiKey) {
      return NextResponse.json({
        warning: 'Chưa có Gemini API Key. Cô Ly có thể nhập API Key trong mục Cài Đặt ⚙️ hoặc chọn chế độ Quét Offline.',
        text: `It is only with the heart that one can see rightly; what is essential is invisible to the eye.

"Men have forgotten this truth," said the fox. "But you must not forget it. You become responsible, forever, for what you have tamed. You are responsible for your rose."

"I am responsible for my rose," the little prince repeated, so that he would be sure to remember.

The stars are beautiful, because of a flower that cannot be seen. What makes the desert beautiful is that somewhere it hides a well.`,
        isDemo: true
      });
    }

    const requestBody = {
      contents: [
        {
          parts: [
            { text: ocrPrompt },
            {
              inline_data: {
                mime_type: mimeType,
                data: imageBytesBase64
              }
            }
          ]
        }
      ],
      generationConfig: {
        temperature: 0.1,
        topP: 0.95,
        maxOutputTokens: 2500,
        // TẮT HOÀN TOÀN THINKING BUDGET: Tăng tốc gấp 3-5 lần, không tạo token suy nghĩ ẩn
        thinkingConfig: {
          thinkingBudget: 0
        }
      }
    };

    let textResult = '';
    let usedModel = '';
    let lastError = '';

    // Cascade: Tự động thử qua các model từ nhẹ đến mạnh nếu gặp 503 High Demand hoặc Timeout
    for (const modelCandidate of GEMINI_CANDIDATES) {
      try {
        const res = await fetch(
          `https://generativelanguage.googleapis.com/v1beta/models/${modelCandidate}:generateContent?key=${encodeURIComponent(geminiApiKey)}`,
          {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(requestBody),
            cache: 'no-store',
            signal: AbortSignal.timeout(6500), // Tối đa 6.5s mỗi candidate để cascade nhanh gọn
          }
        );

        const data = await res.json();

        if (res.ok) {
          const rawText = data.candidates?.[0]?.content?.parts?.[0]?.text;
          if (rawText) {
            textResult = rawText.replace(/^```[a-z]*\n?/i, '').replace(/\n?```$/i, '').trim();
            usedModel = modelCandidate;
            break; // Thành công!
          }
        } else {
          const errMsg = data.error?.message || `HTTP ${res.status}`;
          lastError = errMsg;
          console.warn(`[Gemini Cascade] Model ${modelCandidate} tạm bận (${res.status}): ${errMsg.slice(0, 80)}`);
          // Tiếp tục thử model tiếp theo trong danh sách
        }
      } catch (errCandidate) {
        lastError = errCandidate instanceof Error ? errCandidate.message : String(errCandidate);
        console.warn(`[Gemini Cascade] Model ${modelCandidate} gặp lỗi kết nối:`, lastError);
      }
    }

    if (!textResult) {
      return NextResponse.json({
        error: `Máy chủ Google AI hiện đang quá tải (503 High Demand). Mèo Cam đề xuất Cô Ly chuyển sang chế độ "💻 Quét Cục Bộ (Offline)" không cần mạng ở trên hoặc thử lại sau vài giây nhé! 🐾 (${lastError.slice(0, 100)})`
      }, { status: 503 });
    }

    const durationSeconds = ((Date.now() - startTime) / 1000).toFixed(1);

    return NextResponse.json({
      text: textResult,
      modelUsed: usedModel,
      engine: 'gemini',
      durationSeconds,
      isDemo: false
    });
  } catch (error: unknown) {
    const errorMessage = error instanceof Error ? error.message : 'Lỗi không xác định';
    console.error('Lỗi khi OCR:', error);
    return NextResponse.json(
      { error: `Không thể hoàn tất OCR: ${errorMessage}` },
      { status: 500 }
    );
  }
}

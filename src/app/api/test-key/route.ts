import { NextRequest, NextResponse } from 'next/server';

export const dynamic = 'force-dynamic';

async function verifyGeminiKey(key: string) {
  if (!key) {
    return NextResponse.json({
      success: false,
      error: 'Vui lòng nhập API Key để kiểm tra'
    }, { status: 400 });
  }

  try {
    // Gọi trực tiếp Google ModelService.ListModels
    const res = await fetch(`https://generativelanguage.googleapis.com/v1beta/models?key=${encodeURIComponent(key.trim())}`, {
      headers: {
        'Accept': 'application/json',
      },
      cache: 'no-store'
    });

    const data = await res.json();

    if (!res.ok) {
      const errMsg = data.error?.message || 'Không thể kết nối đến Google Gemini API';
      const status = data.error?.status || res.status;

      let userFriendlyMsg = errMsg;
      if (errMsg.includes('API_KEY_INVALID') || status === 'INVALID_ARGUMENT') {
        userFriendlyMsg = 'Mã API Key không hợp lệ. Cô vui lòng sao chép lại từ https://aistudio.google.com/app/apikey';
      } else if (errMsg.includes('PERMISSION_DENIED') || errMsg.includes('has not been used')) {
        userFriendlyMsg = 'Dự án Google Cloud của bạn chưa bật Generative Language API. Vui lòng tạo API Key mới từ Google AI Studio (miễn phí).';
      }

      return NextResponse.json({
        success: false,
        error: userFriendlyMsg,
        rawError: errMsg
      }, { status: res.status });
    }

    // Lọc các model hỗ trợ generateContent, loại bỏ các model cũ đã ngừng hoạt động như gemini-2.0
    const allModels: Array<{ name: string; supportedGenerationMethods?: string[] }> = data.models || [];
    const contentModels = allModels
      .filter(m => m.supportedGenerationMethods?.includes('generateContent'))
      .map(m => m.name.replace(/^models\//, ''))
      .filter(m => !m.includes('gemini-2.0'));

    if (contentModels.length === 0) {
      return NextResponse.json({
        success: false,
        error: 'API Key hoạt động nhưng không có model nào hỗ trợ nhận diện văn bản'
      });
    }

    // Tìm model ưu tiên thế hệ mới nhất
    const preferred = [
      'gemini-3.8-flash',
      'gemini-3.5-flash',
      'gemini-3.1-flash-lite',
      'gemini-3.0-flash',
      'gemini-2.5-flash',
      'gemini-1.5-flash-latest',
      'gemini-1.5-flash',
      'gemini-1.5-pro'
    ];
    let bestModel = contentModels[0];
    for (const p of preferred) {
      const found = contentModels.find(m => m.includes(p));
      if (found) {
        bestModel = found;
        break;
      }
    }

    return NextResponse.json({
      success: true,
      message: `Kết nối thành công! Đã tìm thấy ${contentModels.length} mô hình AI khả dụng.`,
      bestModel,
      availableModels: contentModels.slice(0, 5)
    });
  } catch (err: unknown) {
    const error = err as Error;
    return NextResponse.json({
      success: false,
      error: `Lỗi kết nối mạng đến Google: ${error.message}`
    }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json().catch(() => ({}));
    const key = body.key || req.headers.get('x-gemini-key') || process.env.GEMINI_API_KEY || '';
    return verifyGeminiKey(key);
  } catch {
    return NextResponse.json({ success: false, error: 'Dữ liệu yêu cầu không hợp lệ' }, { status: 400 });
  }
}

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const key = searchParams.get('key') || req.headers.get('x-gemini-key') || process.env.GEMINI_API_KEY || '';
  return verifyGeminiKey(key);
}

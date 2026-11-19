/**
 * Trình tạo và tìm kiếm ảnh minh họa từ vựng chất lượng cao
 * 1. fetchRealVocabImages: Tìm ảnh chụp thực tế / nhiếp ảnh nghệ thuật (National Geographic, Unsplash, v.v.)
 * 2. generateVocabImageUrl: Fallback sang AI FLUX với phong cách Cinematic Photography / Fine Art Masterpiece (không vẽ hoạt hình mờ)
 */

export interface ImageGenOptions {
  word: string;
  meaning?: string;
  mnemonic?: string;
  partOfSpeech?: string;
  seed?: number;
  width?: number;
  height?: number;
  style?: 'photographic' | 'fine-art' | 'cinematic';
}

/**
 * Tìm ảnh chụp thực tế chất lượng cao theo từ vựng tiếng Anh
 */
export async function fetchRealVocabImages(word: string): Promise<string[]> {
  const cleanWord = word.trim();
  if (!cleanWord) return [];

  try {
    const res = await fetch(`/api/vocab-image?word=${encodeURIComponent(cleanWord)}`);
    if (!res.ok) return [];
    const data = await res.json();
    if (Array.isArray(data.images) && data.images.length > 0) {
      return data.images;
    }
  } catch (err) {
    console.warn('Lỗi khi tải ảnh thực tế:', err);
  }

  // Nếu không tải được ảnh thực tế, fallback sang 1 ảnh AI Cinematic chất lượng cao
  return [generateVocabImageUrl({ word: cleanWord, style: 'photographic' })];
}

/**
 * Tạo URL tranh minh họa AI bằng FLUX theo phong cách Cinematic Photography đỉnh cao
 * Tuyệt đối không sinh tranh hoạt hình mờ, dị tật hoặc watermark
 */
export function generateVocabImageUrl(options: ImageGenOptions): string {
  const {
    word,
    seed = Math.floor(Math.random() * 900000) + 100000,
    width = 720,
    height = 480,
    style = 'photographic'
  } = options;

  const cleanWord = word
    .trim()
    .replace(/["\\]/g, ' ')
    .replace(/\s+/g, ' ')
    .slice(0, 80);

  let styleDesc = 'award-winning National Geographic editorial photography, 35mm lens, realistic depth of field, stunning natural morning lighting, vivid sharp textures, hyperrealistic';
  if (style === 'fine-art') {
    styleDesc = 'oil on canvas museum masterpiece, classical fine art composition, rich textures, dramatic chiaroscuro lighting';
  } else if (style === 'cinematic') {
    styleDesc = 'cinematic 8k movie still, anamorphic lens, beautiful atmospheric volumetric lighting, highly detailed';
  }

  // Prompt nghiêm ngặt cấm chữ, cấm watermark, cấm biến dạng
  const prompt = `A breathtaking visual depiction of the concept "${cleanWord}", ${styleDesc}, 8k resolution, photorealistic, pristine quality, no text, no letters, no typography, no logo, no watermark, perfectly composed`;

  return `https://image.pollinations.ai/prompt/${encodeURIComponent(prompt)}?width=${width}&height=${height}&model=flux&nologo=true&seed=${seed}`;
}

/**
 * Tải trước ảnh để đảm bảo khi render lên UI không bị giật nháy
 */
export async function preloadImageUrl(url: string, timeoutMs = 6000): Promise<boolean> {
  if (typeof window === 'undefined') return true;

  return new Promise((resolve) => {
    const img = new Image();
    let isSettled = false;

    const timer = setTimeout(() => {
      if (!isSettled) {
        isSettled = true;
        resolve(true); // Vẫn giải phóng giao diện nếu quá thời gian
      }
    }, timeoutMs);

    img.onload = () => {
      if (!isSettled) {
        isSettled = true;
        clearTimeout(timer);
        resolve(true);
      }
    };

    img.onerror = () => {
      if (!isSettled) {
        isSettled = true;
        clearTimeout(timer);
        resolve(false);
      }
    };

    img.src = url;
  });
}

import { createClient, SupabaseClient } from '@supabase/supabase-js';

let supabaseInstance: SupabaseClient | null = null;
let lastUsedUrl = '';
let lastUsedKey = '';

export const DEFAULT_SUPABASE_URL = 'https://zkdsjfcszhtvsgplomtb.supabase.co';
export const DEFAULT_SUPABASE_KEY = 'sb_publishable_zFmo4EFFmowGroNOKUdScg_BGbdwaMY';

/**
 * Lấy cấu hình Supabase từ biến môi trường hoặc LocalStorage
 */
export function getSupabaseConfig(): { url: string; key: string; isConfigured: boolean } {
  let url = (process.env.NEXT_PUBLIC_SUPABASE_URL || DEFAULT_SUPABASE_URL).trim();
  let key = (process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || DEFAULT_SUPABASE_KEY).trim();

  // Cho phép lấy từ localStorage nếu người dùng cấu hình qua giao diện Settings
  if (typeof window !== 'undefined') {
    const localUrl = localStorage.getItem('lyngo_supabase_url');
    const localKey = localStorage.getItem('lyngo_supabase_anon_key');
    if (localUrl !== null && localUrl !== undefined && localUrl !== '') url = localUrl.trim();
    if (localKey !== null && localKey !== undefined && localKey !== '') key = localKey.trim();
  }

  const isConfigured = Boolean(url && key && url.startsWith('http'));
  return { url, key, isConfigured };
}

/**
 * Lưu cấu hình Supabase trực tiếp vào LocalStorage
 */
export function saveSupabaseConfig(url: string, key: string) {
  if (typeof window === 'undefined') return;
  const cleanUrl = url.trim();
  const cleanKey = key.trim();

  if (cleanUrl) {
    localStorage.setItem('lyngo_supabase_url', cleanUrl);
  } else {
    localStorage.removeItem('lyngo_supabase_url');
  }

  if (cleanKey) {
    localStorage.setItem('lyngo_supabase_anon_key', cleanKey);
  } else {
    localStorage.removeItem('lyngo_supabase_anon_key');
  }

  // Hủy instance cũ để lần sau khởi tạo lại với config mới
  supabaseInstance = null;
  lastUsedUrl = '';
  lastUsedKey = '';
}

/**
 * Khởi tạo singleton client an toàn (không bao giờ crash app nếu chưa có config)
 */
export function getSupabaseClient(): SupabaseClient | null {
  const { url, key, isConfigured } = getSupabaseConfig();

  if (!isConfigured) {
    return null;
  }

  if (supabaseInstance && lastUsedUrl === url && lastUsedKey === key) {
    return supabaseInstance;
  }

  try {
    supabaseInstance = createClient(url, key, {
      auth: {
        persistSession: false,
        autoRefreshToken: false,
      },
    });
    lastUsedUrl = url;
    lastUsedKey = key;
    return supabaseInstance;
  } catch (err) {
    console.warn('[Supabase] Không thể khởi tạo client:', err);
    return null;
  }
}

export function isSupabaseConfigured(): boolean {
  return getSupabaseConfig().isConfigured;
}

/**
 * Kiểm tra kết nối tới Supabase và xác minh xem bảng đã được tạo chưa
 */
export async function testSupabaseConnection(): Promise<{
  success: boolean;
  message: string;
  error?: string;
}> {
  const client = getSupabaseClient();
  if (!client) {
    return {
      success: false,
      message: 'Chưa cấu hình Supabase URL hoặc Anon Key meow~',
    };
  }

  try {
    // Thử truy vấn bảng albums
    const { error } = await client.from('albums').select('id').limit(1);

    if (error) {
      if (error.code === '42P01' || error.code === 'PGRST205') {
        return {
          success: false,
          message: 'Kết nối Supabase Cloud thành công nhưng chưa tìm thấy bảng "albums". Cô Ly vui lòng chạy script supabase/schema.sql trên Supabase SQL Editor nhé! 🐾',
          error: error.message,
        };
      }
      if (error.code === '42501' || error.message?.toLowerCase().includes('permission denied')) {
        return {
          success: false,
          message: 'Lỗi 42501: Chưa cấp quyền (GRANT) cho bảng Supabase. Cô Ly vui lòng chạy script cấp quyền trong Supabase SQL Editor nhé! 🐾',
          error: error.message,
        };
      }
      return {
        success: false,
        message: `Lỗi kết nối Supabase: ${error.message}`,
        error: error.message,
      };
    }

    return {
      success: true,
      message: 'Kết nối Supabase Cloud thành công! Đã sẵn sàng đồng bộ sách và từ vựng của Cô Ly 🐾',
    };
  } catch (err: unknown) {
    const error = err as Error;
    return {
      success: false,
      message: `Không thể kết nối mạng tới Supabase: ${error.message}`,
      error: error.message,
    };
  }
}

/**
 * Tải ảnh trang sách hoặc ảnh bìa lên Supabase Storage bucket 'book-images'
 * Trả về Public URL hoặc null nếu thất bại / chưa cấu hình
 */
export async function uploadBookImage(
  imageSource: File | Blob | string,
  filePath: string
): Promise<string | null> {
  const client = getSupabaseClient();
  if (!client) return null;

  try {
    let fileBlob: Blob;

    if (typeof imageSource === 'string') {
      // Nếu là Base64
      if (imageSource.startsWith('data:')) {
        const parts = imageSource.split(',');
        const mimeMatch = parts[0].match(/:(.*?);/);
        const mimeType = mimeMatch ? mimeMatch[1] : 'image/jpeg';
        const b64Data = atob(parts[1]);
        const u8arr = new Uint8Array(b64Data.length);
        for (let i = 0; i < b64Data.length; i++) {
          u8arr[i] = b64Data.charCodeAt(i);
        }
        fileBlob = new Blob([u8arr], { type: mimeType });
      } else if (imageSource.startsWith('http://') || imageSource.startsWith('https://')) {
        // Đã là URL trên mạng rồi, không cần upload lại
        return imageSource;
      } else {
        return null;
      }
    } else {
      fileBlob = imageSource;
    }

    const { error: uploadError } = await client.storage
      .from('book-images')
      .upload(filePath, fileBlob, {
        upsert: true,
        contentType: fileBlob.type || 'image/jpeg',
      });

    if (uploadError) {
      console.warn('[Supabase Storage] Lỗi upload ảnh:', uploadError.message);
      return null;
    }

    const { data } = client.storage.from('book-images').getPublicUrl(filePath);
    return data.publicUrl;
  } catch (err) {
    console.warn('[Supabase Storage] Ngoại lệ khi upload ảnh:', err);
    return null;
  }
}

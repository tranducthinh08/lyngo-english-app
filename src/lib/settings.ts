'use client';

const GEMINI_KEY_STORAGE = 'lyngo_gemini_api_key';
const FONT_SIZE_STORAGE = 'lyngo_reader_font_size';
const SERIF_MODE_STORAGE = 'lyngo_reader_serif_mode';
const CURSOR_SIZE_STORAGE = 'lyngo_cat_cursor_size';

export const DEFAULT_CURSOR_SIZE = 32;
export const MIN_CURSOR_SIZE = 20;
export const MAX_CURSOR_SIZE = 48;

export function getCursorSize(): number {
  if (typeof window === 'undefined') return DEFAULT_CURSOR_SIZE;
  const val = localStorage.getItem(CURSOR_SIZE_STORAGE);
  if (!val) return DEFAULT_CURSOR_SIZE;
  const parsed = parseInt(val, 10);
  return isNaN(parsed) ? DEFAULT_CURSOR_SIZE : Math.min(Math.max(parsed, MIN_CURSOR_SIZE), MAX_CURSOR_SIZE);
}

export function setCursorSize(size: number) {
  if (typeof window === 'undefined') return;
  const clamped = Math.min(Math.max(size, MIN_CURSOR_SIZE), MAX_CURSOR_SIZE);
  localStorage.setItem(CURSOR_SIZE_STORAGE, clamped.toString());
  window.dispatchEvent(new CustomEvent('lyngo_cursor_size_change', { detail: clamped }));
}

export function getStoredGeminiKey(): string {
  if (typeof window === 'undefined') return '';
  return localStorage.getItem(GEMINI_KEY_STORAGE) || '';
}

export function setStoredGeminiKey(key: string) {
  if (typeof window === 'undefined') return;
  if (!key) {
    localStorage.removeItem(GEMINI_KEY_STORAGE);
  } else {
    localStorage.setItem(GEMINI_KEY_STORAGE, key.trim());
  }
}

export function getReaderFontSize(): number {
  if (typeof window === 'undefined') return 18;
  const val = localStorage.getItem(FONT_SIZE_STORAGE);
  return val ? parseInt(val, 10) : 18;
}

export function setReaderFontSize(size: number) {
  if (typeof window === 'undefined') return;
  localStorage.setItem(FONT_SIZE_STORAGE, size.toString());
}

export function getReaderSerifMode(): boolean {
  if (typeof window === 'undefined') return true;
  const val = localStorage.getItem(SERIF_MODE_STORAGE);
  return val !== null ? val === 'true' : true; // Mặc định dùng font serif kiểu sách thật
}

export function setReaderSerifMode(isSerif: boolean) {
  if (typeof window === 'undefined') return;
  localStorage.setItem(SERIF_MODE_STORAGE, isSerif.toString());
}

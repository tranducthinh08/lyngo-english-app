'use client';

import React, { useState, useEffect, useRef } from 'react';
import { useRouter } from 'next/navigation';
import {
  Camera,
  Upload,
  BookOpen,
  ArrowRight,
  Check,
  Loader2,
  AlertCircle,
  Zap,
  Cpu,
  WifiOff,
  Sparkles
} from 'lucide-react';
import { db } from '@/lib/db';
import { Album, PageItem } from '@/types';
import { getStoredGeminiKey } from '@/lib/settings';
import { syncService } from '@/lib/syncService';
import { uploadBookImage, isSupabaseConfigured } from '@/lib/supabase';
import CameraCapture from '@/components/scanner/CameraCapture';
import CuteCat from '@/components/common/CuteCat';
import { compressImageForOCR } from '@/lib/imageCompressor';

type OcrEngine = 'gemini' | 'groq' | 'offline';

export default function ScanPage() {
  const router = useRouter();

  const [albums, setAlbums] = useState<Album[]>([]);
  const [selectedAlbumId, setSelectedAlbumId] = useState<string>('');
  const [isCreatingNewAlbum, setIsCreatingNewAlbum] = useState(false);
  const [newAlbumTitle, setNewAlbumTitle] = useState('');
  const [newAlbumAuthor, setNewAlbumAuthor] = useState('');

  const [pageTitle, setPageTitle] = useState('Trang mới');
  const [pageNumber, setPageNumber] = useState<string>('1');

  const [imagePreview, setImagePreview] = useState<string>('');
  const [showCamera, setShowCamera] = useState(false);

  // Động cơ quét (Gemini Flash-Lite mặc định, Groq LPU siêu tốc, Offline cục bộ)
  const [selectedEngine, setSelectedEngine] = useState<OcrEngine>('gemini');
  const [groqApiKeyInput, setGroqApiKeyInput] = useState<string>('');
  const [showGroqInput, setShowGroqInput] = useState(false);

  // Trạng thái nén & tối ưu tốc độ
  const [isCompressing, setIsCompressing] = useState(false);
  const [compressionInfo, setCompressionInfo] = useState<{
    originalKB: number;
    compressedKB: number;
    percentSaved: number;
  } | null>(null);

  const [isScanning, setIsScanning] = useState(false);
  const [elapsedSeconds, setElapsedSeconds] = useState<number>(0);
  const [uploadProgress, setUploadProgress] = useState<number>(0);
  const [scanPhase, setScanPhase] = useState<'idle' | 'uploading' | 'ai_reading' | 'offline_worker'>('idle');
  const [extractedText, setExtractedText] = useState('');
  const [scanWarning, setScanWarning] = useState<string | null>(null);
  const [scanDuration, setScanDuration] = useState<string | null>(null);
  const [scanModelUsed, setScanModelUsed] = useState<string | null>(null);

  const fileInputRef = useRef<HTMLInputElement>(null);
  const timerRef = useRef<NodeJS.Timeout | null>(null);

  useEffect(() => {
    db.albums.toArray().then((list) => {
      setAlbums(list);
      if (list.length > 0) {
        setSelectedAlbumId(list[0].id);
      } else {
        setIsCreatingNewAlbum(true);
      }
    });

    const savedGroq = localStorage.getItem('lyngo_groq_key') || '';
    if (savedGroq) setGroqApiKeyInput(savedGroq);
  }, []);

  // Đồng hồ bấm giờ trực tiếp khi đang scan
  useEffect(() => {
    if (isScanning) {
      const start = Date.now();
      setElapsedSeconds(0);
      timerRef.current = setInterval(() => {
        setElapsedSeconds(Number(((Date.now() - start) / 1000).toFixed(1)));
      }, 100);
    } else {
      if (timerRef.current) clearInterval(timerRef.current);
    }
    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
    };
  }, [isScanning]);

  // Xử lý nén ảnh tự động ngay khi chọn ảnh
  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setIsCompressing(true);
    setScanDuration(null);
    setScanModelUsed(null);
    try {
      const result = await compressImageForOCR(file, 1600, 0.85);
      setImagePreview(result.dataUrl);
      const percent = result.originalSizeKB > result.compressedSizeKB
        ? Math.round(((result.originalSizeKB - result.compressedSizeKB) / result.originalSizeKB) * 100)
        : 0;

      setCompressionInfo({
        originalKB: result.originalSizeKB,
        compressedKB: result.compressedSizeKB,
        percentSaved: percent,
      });
      setExtractedText('');
      setScanWarning(null);
    } catch (err) {
      console.error('Lỗi khi nén ảnh:', err);
    } finally {
      setIsCompressing(false);
    }
  };

  // Quét ảnh theo động cơ được chọn
  const handleStartOCR = async () => {
    if (!imagePreview) return;

    setIsScanning(true);
    setUploadProgress(0);
    setScanPhase('uploading');
    setScanWarning(null);
    setScanDuration(null);
    setScanModelUsed(null);

    const startTime = Date.now();

    // ---------------------------------------------------------
    // TRƯỜNG HỢP 1: QUÉT OFFLINE CỤC BỘ BẰNG TESSERACT.JS
    // ---------------------------------------------------------
    if (selectedEngine === 'offline') {
      try {
        setScanPhase('offline_worker');
        const { createWorker } = await import('tesseract.js');
        const worker = await createWorker('eng');
        const ret = await worker.recognize(imagePreview);
        await worker.terminate();

        const cleanText = (ret.data.text || '').trim();
        if (!cleanText) {
          throw new Error('Không nhận diện được chữ rõ ràng trên ảnh. Cô Ly hãy chụp lại ảnh góc thẳng và đủ sáng nhé!');
        }

        const duration = ((Date.now() - startTime) / 1000).toFixed(1);
        setExtractedText(cleanText);
        setScanDuration(duration);
        setScanModelUsed('Tesseract Engine (Offline)');
      } catch (err: unknown) {
        console.error('Lỗi Offline OCR:', err);
        alert(`Lỗi quét offline: ${err instanceof Error ? err.message : String(err)}`);
      } finally {
        setIsScanning(false);
        setScanPhase('idle');
      }
      return;
    }

    // ---------------------------------------------------------
    // TRƯỜNG HỢP 2: QUÉT QUA SERVER (GEMINI FLASH HOẶC GROQ LPU)
    // ---------------------------------------------------------
    try {
      const apiKey = getStoredGeminiKey();
      const formData = new FormData();
      formData.append('base64', imagePreview);
      formData.append('engine', selectedEngine);

      if (apiKey) {
        formData.append('apiKey', apiKey);
      }

      if (selectedEngine === 'groq' && groqApiKeyInput) {
        formData.append('groqApiKey', groqApiKeyInput.trim());
        localStorage.setItem('lyngo_groq_key', groqApiKeyInput.trim());
      }

      interface OcrResponse {
        text: string;
        durationSeconds?: string;
        modelUsed?: string;
        engine?: string;
        warning?: string;
        error?: string;
      }

      const data = await new Promise<OcrResponse>((resolve, reject) => {
        const xhr = new XMLHttpRequest();
        xhr.open('POST', '/api/ocr');

        xhr.upload.onprogress = (event) => {
          if (event.lengthComputable) {
            const percent = Math.min(100, Math.round((event.loaded / event.total) * 100));
            setUploadProgress(percent);
            if (percent >= 100) {
              setScanPhase('ai_reading');
            }
          }
        };

        xhr.onload = () => {
          try {
            const json = JSON.parse(xhr.responseText);
            if (xhr.status >= 200 && xhr.status < 300) {
              resolve(json);
            } else {
              reject(new Error(json.error || `Lỗi từ máy chủ (${xhr.status})`));
            }
          } catch {
            reject(new Error(`Phản hồi không hợp lệ từ máy chủ (${xhr.status})`));
          }
        };

        xhr.onerror = () => {
          reject(new Error('Lỗi kết nối mạng khi tải lên ảnh'));
        };

        xhr.send(formData);
      });

      setExtractedText(data.text);
      if (data.durationSeconds) {
        setScanDuration(data.durationSeconds);
      }
      if (data.modelUsed) {
        setScanModelUsed(data.modelUsed);
      }
      if (data.warning) {
        setScanWarning(data.warning);
      }
    } catch (err: unknown) {
      console.error('Scan error:', err);
      const msg = err instanceof Error ? err.message : 'Không thể scan ảnh này';
      if (msg.includes('503') || msg.includes('quá tải') || msg.includes('High Demand')) {
        setScanWarning('Google Gemini tạm bận. Cô Ly có thể bấm thử lại hoặc chuyển qua tab "💻 Quét Cục Bộ (Offline)" để đọc ngay lập tức mà không cần mạng nhé! 🐾');
      } else {
        alert(`Lỗi meow: ${msg}`);
      }
    } finally {
      setIsScanning(false);
      setScanPhase('idle');
    }
  };

  const handleSaveAndRead = async () => {
    if (!extractedText.trim()) {
      alert('Vui lòng quét hoặc nhập nội dung văn bản trang sách meow~');
      return;
    }

    let finalAlbumId = selectedAlbumId;

    if (isCreatingNewAlbum) {
      if (!newAlbumTitle.trim()) {
        alert('Vui lòng nhập tên cuốn sách / Album meow~');
        return;
      }
      finalAlbumId = `album-${Date.now()}`;
      const newAlbum: Album = {
        id: finalAlbumId,
        title: newAlbumTitle.trim(),
        author: newAlbumAuthor.trim() || undefined,
        coverImage: imagePreview || undefined,
        description: `Tủ sách của Cô Ly & Mèo Cam - Tạo ngày ${new Date().toLocaleDateString('vi-VN')}`,
        createdAt: Date.now(),
        updatedAt: Date.now(),
      };
      await db.albums.add(newAlbum);
    }

    const pageId = `page-${Date.now()}`;
    let finalPageImage = imagePreview;

    // Tải ảnh trang sách lên Supabase Storage nếu đã kết nối
    if (imagePreview && isSupabaseConfigured()) {
      try {
        const cloudUrl = await uploadBookImage(imagePreview, `pages/${pageId}.jpg`);
        if (cloudUrl) {
          finalPageImage = cloudUrl;
        }
      } catch (err) {
        console.warn('Lỗi upload ảnh trang lên Cloud:', err);
      }
    }

    const newPage: PageItem = {
      id: pageId,
      albumId: finalAlbumId,
      title: pageTitle.trim() || 'Trang sách',
      pageNumber: pageNumber || 1,
      originalImage: finalPageImage,
      extractedText: extractedText.trim(),
      createdAt: Date.now(),
      updatedAt: Date.now(),
    };

    await db.pages.add(newPage);

    // Tự động đồng bộ với Supabase Cloud
    syncService.triggerSync(1000);

    router.push(`/reader/${pageId}`);
  };

  return (
    <div className="max-w-4xl mx-auto px-4 py-8 space-y-8">
      {/* Tiêu đề trang Mèo Cam */}
      <div className="text-center space-y-3">
        <div className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full bg-orange-100 text-orange-950 text-xs font-bold border-2 border-orange-300 shadow-2xs">
          <span>🐾</span>
          Mèo Cam Soi Sách Siêu Tốc (Đã tối ưu tắt Thinking ngầm & Hỗ trợ Đa Động Cơ)
        </div>
        <div className="flex items-center justify-center gap-3">
          <CuteCat size={44} mood="reading" />
          <h1 className="font-serif font-black text-3xl sm:text-4xl text-orange-950">
            Chụp & Soi Trang Sách 📸
          </h1>
        </div>
        <p className="text-sm text-orange-900/80 max-w-xl mx-auto font-medium">
          Chụp trang sách tiếng Anh cô Ly đang đọc. Mèo Cam đã kết nối API Key và tối ưu thuật toán giúp scan siêu nhanh chỉ trong chớp mắt!
        </p>

        {/* BỘ CHỌN ĐỘNG CƠ QUÉT (ENGINE SWITCHER) */}
        <div className="inline-flex flex-wrap items-center justify-center p-1.5 bg-orange-200/60 rounded-2xl border-2 border-orange-300 gap-1.5 max-w-lg mx-auto shadow-inner">
          <button
            type="button"
            onClick={() => setSelectedEngine('gemini')}
            className={`px-3.5 py-1.5 rounded-xl text-xs font-extrabold flex items-center gap-1.5 transition-all ${
              selectedEngine === 'gemini'
                ? 'bg-orange-500 text-white shadow-md shadow-orange-500/30'
                : 'text-orange-950 hover:bg-orange-100'
            }`}
          >
            <Zap className="w-3.5 h-3.5 fill-current" />
            <span>Gemini Flash-Lite</span>
            <span className="text-[10px] opacity-80">(Mặc định ~2s)</span>
          </button>

          <button
            type="button"
            onClick={() => {
              setSelectedEngine('groq');
              setShowGroqInput(true);
            }}
            className={`px-3.5 py-1.5 rounded-xl text-xs font-extrabold flex items-center gap-1.5 transition-all ${
              selectedEngine === 'groq'
                ? 'bg-amber-600 text-white shadow-md shadow-amber-600/30'
                : 'text-orange-950 hover:bg-orange-100'
            }`}
          >
            <Cpu className="w-3.5 h-3.5" />
            <span>Groq LPU</span>
            <span className="text-[10px] opacity-80">(Cực nhanh &lt;1s)</span>
          </button>

          <button
            type="button"
            onClick={() => setSelectedEngine('offline')}
            className={`px-3.5 py-1.5 rounded-xl text-xs font-extrabold flex items-center gap-1.5 transition-all ${
              selectedEngine === 'offline'
                ? 'bg-emerald-600 text-white shadow-md shadow-emerald-600/30'
                : 'text-orange-950 hover:bg-orange-100'
            }`}
          >
            <WifiOff className="w-3.5 h-3.5" />
            <span>Quét Cục Bộ</span>
            <span className="text-[10px] opacity-80">(Offline)</span>
          </button>
        </div>

        {/* Ô nhập Groq Key nếu chọn Groq */}
        {selectedEngine === 'groq' && showGroqInput && (
          <div className="max-w-md mx-auto p-3 bg-amber-50 rounded-2xl border-2 border-amber-300 text-left space-y-2 text-xs">
            <div className="flex items-center justify-between font-bold text-amber-950">
              <span className="flex items-center gap-1">
                <Sparkles className="w-3.5 h-3.5 text-amber-600" />
                Nhập Groq API Key (Miễn phí từ console.groq.com)
              </span>
              <button
                onClick={() => setShowGroqInput(false)}
                className="text-amber-700 hover:text-amber-900"
              >
                ✕
              </button>
            </div>
            <input
              type="password"
              value={groqApiKeyInput}
              onChange={(e) => setGroqApiKeyInput(e.target.value)}
              placeholder="gsk_..."
              className="w-full px-3 py-1.5 rounded-xl border border-amber-300 bg-white font-mono text-xs text-amber-950"
            />
          </div>
        )}
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6 items-start">
        {/* CỘT TRÁI: CHỤP / TẢI ẢNH */}
        <div className="bg-white/95 rounded-3xl p-6 border-2 border-orange-200/90 shadow-md space-y-5">
          <h2 className="font-serif font-black text-lg text-orange-950 flex items-center gap-2">
            <span className="w-7 h-7 rounded-full bg-orange-500 text-white text-xs flex items-center justify-center font-sans font-bold shadow-2xs">1</span>
            Hình ảnh trang sách giấy 🐾
          </h2>

          {isCompressing ? (
            <div className="py-16 text-center space-y-3 border-2 border-dashed border-orange-300 rounded-3xl bg-orange-50/50">
              <Loader2 className="w-8 h-8 animate-spin text-orange-600 mx-auto" />
              <p className="text-xs font-bold text-orange-950">Đang tối ưu hóa dung lượng ảnh siêu tốc...</p>
            </div>
          ) : imagePreview ? (
            <div className="space-y-3">
              <div className="relative rounded-2xl overflow-hidden border-2 border-orange-300 bg-orange-50 max-h-80 flex items-center justify-center">
                <img
                  src={imagePreview}
                  alt="Ảnh trang sách"
                  className="w-full h-auto max-h-80 object-contain"
                />
              </div>

              {/* Thông báo nén ảnh thành công */}
              {compressionInfo && compressionInfo.percentSaved > 10 && (
                <div className="p-2.5 rounded-2xl bg-emerald-50 border border-emerald-300 text-emerald-900 text-xs font-bold flex items-center gap-1.5 shadow-2xs">
                  <Zap className="w-4 h-4 text-emerald-600 shrink-0 fill-current" />
                  <span>
                    Đã nén tối ưu: {compressionInfo.originalKB}KB ➔ {compressionInfo.compressedKB}KB (Giảm {compressionInfo.percentSaved}%, upload tức thì!)
                  </span>
                </div>
              )}

              <div className="flex gap-2">
                <button
                  onClick={() => setShowCamera(true)}
                  className="flex-1 py-2 px-3 rounded-2xl bg-orange-100 text-orange-900 text-xs font-bold hover:bg-orange-200 flex items-center justify-center gap-1.5 transition-colors border border-orange-200"
                >
                  <Camera className="w-4 h-4 text-orange-700" /> Chụp lại 📸
                </button>
                <button
                  onClick={() => fileInputRef.current?.click()}
                  className="flex-1 py-2 px-3 rounded-2xl bg-orange-100 text-orange-900 text-xs font-bold hover:bg-orange-200 flex items-center justify-center gap-1.5 transition-colors border border-orange-200"
                >
                  <Upload className="w-4 h-4 text-orange-700" /> Đổi ảnh khác
                </button>
              </div>
            </div>
          ) : (
            <div className="space-y-3">
              <button
                onClick={() => setShowCamera(true)}
                className="w-full py-4 px-4 rounded-2xl bg-gradient-to-r from-orange-500 to-amber-500 text-white font-extrabold shadow-lg shadow-orange-500/20 hover:scale-102 flex items-center justify-center gap-2.5 transition-all active:scale-98"
              >
                <Camera className="w-5 h-5" />
                <span className="font-serif font-bold text-base">Bật Camera Chụp Trang Sách 🐾</span>
              </button>

              <div className="relative flex py-2 items-center">
                <div className="grow border-t-2 border-orange-100"></div>
                <span className="shrink mx-4 text-xs font-bold text-orange-400">HOẶC</span>
                <div className="grow border-t-2 border-orange-100"></div>
              </div>

              <div
                onClick={() => fileInputRef.current?.click()}
                className="border-2 border-dashed border-orange-300 rounded-3xl p-6 text-center cursor-pointer hover:bg-orange-50/70 transition-colors bg-white"
              >
                <Upload className="w-8 h-8 text-orange-500 mx-auto mb-2" />
                <p className="text-sm font-bold text-orange-950">Chọn hoặc kéo thả ảnh sách</p>
                <p className="text-xs text-orange-700 mt-1 font-medium">Hỗ trợ ảnh JPG, PNG từ điện thoại & máy tính</p>
              </div>
            </div>
          )}

          <input
            type="file"
            ref={fileInputRef}
            accept="image/*"
            onChange={handleFileChange}
            className="hidden"
          />

          {imagePreview && (
            <div className="space-y-3">
              <button
                onClick={handleStartOCR}
                disabled={isScanning || isCompressing}
                className="w-full py-3.5 px-4 rounded-2xl bg-gradient-to-r from-orange-600 to-amber-600 text-white font-extrabold shadow-lg shadow-orange-950/20 hover:scale-102 flex items-center justify-center gap-2 transition-all disabled:opacity-50 active:scale-98"
              >
                {isScanning ? (
                  <>
                    <Loader2 className="w-5 h-5 animate-spin text-orange-200" />
                    <span>
                      {selectedEngine === 'offline'
                        ? `Trình duyệt đang quét (${elapsedSeconds}s)...`
                        : scanPhase === 'uploading'
                        ? `Đang gửi ảnh (${uploadProgress}%)...`
                        : `AI đang soi chữ (${elapsedSeconds}s)...`}
                    </span>
                  </>
                ) : (
                  <>
                    <CuteCat size={22} mood="paw" />
                    <span className="font-black text-sm">
                      {selectedEngine === 'offline'
                        ? 'Quét Bằng Trình Duyệt Offline 💻'
                        : selectedEngine === 'groq'
                        ? 'Soi Siêu Tốc Bằng Groq LPU 🚀'
                        : 'Mèo Cam Soi Chữ Siêu Tốc Meow! ⚡'}
                    </span>
                  </>
                )}
              </button>

              {/* Đồng hồ & Thanh tiến trình thời gian thực */}
              {isScanning && (
                <div className="p-3.5 rounded-2xl bg-orange-50 border-2 border-orange-300 space-y-2 animate-in fade-in">
                  <div className="flex items-center justify-between text-xs font-bold text-orange-950">
                    <span className="flex items-center gap-1.5">
                      <Loader2 className="w-3.5 h-3.5 animate-spin text-orange-600" />
                      <span>
                        {selectedEngine === 'offline'
                          ? 'Đang nhận diện chữ trong máy tính...'
                          : scanPhase === 'uploading'
                          ? 'Đang truyền ảnh lên máy chủ...'
                          : 'Đang bóc tách từng đoạn văn...'}
                      </span>
                    </span>
                    <span className="text-orange-700 font-mono font-black text-sm bg-orange-200/60 px-2 py-0.5 rounded-lg">
                      ⏱️ {elapsedSeconds}s
                    </span>
                  </div>

                  {selectedEngine !== 'offline' && (
                    <div className="w-full h-2.5 bg-orange-200/60 rounded-full overflow-hidden p-0.5 border border-orange-200">
                      <div
                        className="h-full bg-gradient-to-r from-orange-500 to-amber-500 rounded-full transition-all duration-200"
                        style={{ width: `${Math.max(5, uploadProgress)}%` }}
                      />
                    </div>
                  )}

                  <p className="text-[11px] text-orange-800/80 text-center font-medium">
                    🐾 Đã tối ưu tắt Thinking ngầm, tốc độ cực nhanh không phải chờ đợi lâu!
                  </p>
                </div>
              )}
            </div>
          )}

          {scanWarning && (
            <div className="p-3.5 bg-orange-100 rounded-2xl border-2 border-orange-300 text-xs text-orange-950 font-bold flex items-start gap-2.5 shadow-2xs">
              <AlertCircle className="w-4 h-4 text-orange-700 shrink-0 mt-0.5" />
              <div className="space-y-1">
                <p>{scanWarning}</p>
                <div className="pt-1">
                  <button
                    onClick={() => {
                      setSelectedEngine('offline');
                      handleStartOCR();
                    }}
                    className="px-2.5 py-1 bg-emerald-600 text-white rounded-lg text-[11px] font-extrabold hover:bg-emerald-700 transition-colors"
                  >
                    Bấm để chuyển sang Quét Cục Bộ (Offline) ngay 🚀
                  </button>
                </div>
              </div>
            </div>
          )}
        </div>

        {/* CỘT PHẢI: KẾT QUẢ VĂN BẢN & LƯU VÀO ALBUM */}
        <div className="bg-white/95 rounded-3xl p-6 border-2 border-orange-200/90 shadow-md space-y-5">
          <div className="flex items-center justify-between">
            <h2 className="font-serif font-black text-lg text-orange-950 flex items-center gap-2">
              <span className="w-7 h-7 rounded-full bg-orange-500 text-white text-xs flex items-center justify-center font-sans font-bold shadow-2xs">2</span>
              Lưu vào Album & Đọc sách 📖
            </h2>
            {scanDuration && (
              <span className="text-[11px] font-bold text-emerald-800 bg-emerald-100 px-2.5 py-1 rounded-full border border-emerald-300 flex items-center gap-1 shadow-2xs">
                <Zap className="w-3 h-3 text-emerald-600 fill-current" /> Xong trong {scanDuration}s! {scanModelUsed ? `(${scanModelUsed})` : ''}
              </span>
            )}
          </div>

          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <label className="text-xs font-bold text-orange-950 flex items-center gap-1">
                <BookOpen className="w-3.5 h-3.5 text-orange-600" /> Cuốn sách / Album:
              </label>
              <button
                type="button"
                onClick={() => setIsCreatingNewAlbum(!isCreatingNewAlbum)}
                className="text-xs text-orange-700 hover:text-orange-950 font-bold flex items-center gap-1"
              >
                {isCreatingNewAlbum ? 'Chọn album có sẵn' : '+ Tạo album mới 🐾'}
              </button>
            </div>

            {isCreatingNewAlbum ? (
              <div className="space-y-2 p-3 bg-orange-50 rounded-2xl border-2 border-orange-200">
                <input
                  type="text"
                  placeholder="Tên cuốn sách (vd: Atomic Habits, The Little Prince...)"
                  value={newAlbumTitle}
                  onChange={(e) => setNewAlbumTitle(e.target.value)}
                  className="w-full px-3 py-2 rounded-xl border-2 border-orange-300 bg-white text-xs font-bold text-orange-950 focus:outline-none focus:ring-1 focus:ring-orange-500"
                />
                <input
                  type="text"
                  placeholder="Tên tác giả (không bắt buộc)"
                  value={newAlbumAuthor}
                  onChange={(e) => setNewAlbumAuthor(e.target.value)}
                  className="w-full px-3 py-1.5 rounded-xl border-2 border-orange-300 bg-white text-xs text-orange-950 focus:outline-none"
                />
              </div>
            ) : (
              <select
                aria-label="Chọn cuốn sách / Album"
                value={selectedAlbumId}
                onChange={(e) => setSelectedAlbumId(e.target.value)}
                className="w-full px-3 py-2.5 rounded-2xl border-2 border-orange-200 bg-white text-xs font-bold text-orange-950 focus:outline-none"
              >
                {albums.map((a) => (
                  <option key={a.id} value={a.id}>
                    🐾 {a.title} {a.author ? `— ${a.author}` : ''}
                  </option>
                ))}
              </select>
            )}
          </div>

          {/* Tên trang & Số trang */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-bold text-orange-950 mb-1">Tiêu đề trang</label>
              <input
                type="text"
                value={pageTitle}
                onChange={(e) => setPageTitle(e.target.value)}
                placeholder="vd: Chapter 1, Trang 23..."
                className="w-full px-3 py-2 rounded-xl border-2 border-orange-200 bg-white text-xs text-orange-950 focus:outline-none font-medium"
              />
            </div>
            <div>
              <label className="block text-xs font-bold text-orange-950 mb-1">Số trang</label>
              <input
                type="text"
                value={pageNumber}
                onChange={(e) => setPageNumber(e.target.value)}
                placeholder="1"
                className="w-full px-3 py-2 rounded-xl border-2 border-orange-200 bg-white text-xs text-orange-950 focus:outline-none font-medium"
              />
            </div>
          </div>

          {/* Nội dung trích xuất */}
          <div>
            <label className="block text-xs font-bold text-orange-950 mb-1 flex items-center justify-between">
              <span>Nội dung văn bản số hóa</span>
              {extractedText && (
                <span className="text-[11px] text-emerald-700 font-bold flex items-center gap-1">
                  <Check className="w-3.5 h-3.5" /> Mèo Cam đã soi xong! 🐾
                </span>
              )}
            </label>
            <textarea
              rows={8}
              value={extractedText}
              onChange={(e) => setExtractedText(e.target.value)}
              placeholder="Sau khi scan, văn bản sách sẽ hiển thị tại đây meow~. Cô Ly có thể chỉnh sửa nếu cần..."
              className="w-full px-3.5 py-2.5 rounded-2xl border-2 border-orange-200 bg-white text-orange-950 font-serif text-sm leading-relaxed focus:ring-2 focus:ring-orange-500 focus:outline-none placeholder-orange-300 font-medium"
            />
          </div>

          <button
            onClick={handleSaveAndRead}
            disabled={!extractedText.trim()}
            className="w-full py-3.5 px-4 rounded-2xl bg-gradient-to-r from-orange-500 to-amber-500 text-white font-black shadow-lg shadow-orange-500/20 hover:scale-102 flex items-center justify-center gap-2 transition-all disabled:opacity-40 active:scale-98"
          >
            <span>Lưu vào Album & Đọc Ngay Meow!</span>
            <ArrowRight className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* Modal Bật Camera */}
      {showCamera && (
        <CameraCapture
          onCapture={async (dataUrl) => {
            setShowCamera(false);
            setIsCompressing(true);
            try {
              const res = await compressImageForOCR(dataUrl, 1600, 0.85);
              setImagePreview(res.dataUrl);
              setCompressionInfo({
                originalKB: res.originalSizeKB,
                compressedKB: res.compressedSizeKB,
                percentSaved: res.originalSizeKB > res.compressedSizeKB
                  ? Math.round(((res.originalSizeKB - res.compressedSizeKB) / res.originalSizeKB) * 100)
                  : 0,
              });
              setExtractedText('');
            } catch {
              setImagePreview(dataUrl);
            } finally {
              setIsCompressing(false);
            }
          }}
          onClose={() => setShowCamera(false)}
        />
      )}
    </div>
  );
}

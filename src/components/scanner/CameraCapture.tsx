'use client';

import React, { useRef, useState, useEffect, useCallback } from 'react';
import { Camera, RefreshCw, X, FlipHorizontal } from 'lucide-react';

interface CameraCaptureProps {
  onCapture: (base64Image: string) => void;
  onClose: () => void;
}

export default function CameraCapture({ onCapture, onClose }: CameraCaptureProps) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const [facingMode, setFacingMode] = useState<'environment' | 'user'>('environment');
  const [error, setError] = useState<string | null>(null);

  const stopActiveStream = useCallback(() => {
    if (streamRef.current) {
      streamRef.current.getTracks().forEach((track) => track.stop());
      streamRef.current = null;
    }
  }, []);

  const startCamera = useCallback(async (mode: 'environment' | 'user') => {
    try {
      stopActiveStream();
      setError(null);

      const constraints: MediaStreamConstraints = {
        video: {
          facingMode: { ideal: mode },
          width: { ideal: 1920 },
          height: { ideal: 1080 },
        },
        audio: false,
      };

      const mediaStream = await navigator.mediaDevices.getUserMedia(constraints);
      streamRef.current = mediaStream;

      if (videoRef.current) {
        videoRef.current.srcObject = mediaStream;
      }
    } catch (err: unknown) {
      console.error('Không thể mở camera:', err);
      const errObj = err as { name?: string };
      if (errObj.name === 'NotAllowedError') {
        setError('Vui lòng cấp quyền truy cập Camera trên trình duyệt để chụp trang sách.');
      } else {
        setError('Không tìm thấy thiết bị Camera khả dụng. Bạn có thể dùng tính năng Tải ảnh lên.');
      }
    }
  }, [stopActiveStream]);

  useEffect(() => {
    startCamera(facingMode);
    return () => {
      stopActiveStream();
    };
  }, [facingMode, startCamera, stopActiveStream]);

  const handleCapture = () => {
    if (!videoRef.current) return;
    const video = videoRef.current;

    const canvas = document.createElement('canvas');
    canvas.width = video.videoWidth || 1280;
    canvas.height = video.videoHeight || 720;
    const ctx = canvas.getContext('2d');
    if (ctx) {
      ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
      const dataUrl = canvas.toDataURL('image/jpeg', 0.9);
      stopActiveStream();
      onCapture(dataUrl);
    }
  };

  const toggleFacingMode = () => {
    setFacingMode((prev) => (prev === 'environment' ? 'user' : 'environment'));
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-md p-4">
      <div className="relative w-full max-w-xl bg-slate-900 rounded-3xl overflow-hidden shadow-2xl border border-slate-700 flex flex-col">
        {/* Header */}
        <div className="p-4 flex items-center justify-between text-white border-b border-slate-800">
          <div className="flex items-center gap-2">
            <Camera className="w-5 h-5 text-amber-400" />
            <h3 className="font-serif font-bold text-base">Căn chỉnh trang sách giấy vào khung</h3>
          </div>
          <button
            onClick={() => {
              stopActiveStream();
              onClose();
            }}
            className="p-1.5 rounded-full hover:bg-slate-800 text-slate-300"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Video stream container */}
        <div className="relative aspect-3/4 sm:aspect-4/3 w-full bg-black flex items-center justify-center overflow-hidden">
          {error ? (
            <div className="p-6 text-center text-rose-300 space-y-3">
              <p className="text-sm">{error}</p>
              <button
                onClick={() => startCamera(facingMode)}
                className="px-4 py-2 rounded-xl bg-slate-800 text-white text-xs font-medium hover:bg-slate-700 flex items-center gap-1.5 mx-auto"
              >
                <RefreshCw className="w-4 h-4" /> Thử lại
              </button>
            </div>
          ) : (
            <>
              <video
                ref={videoRef}
                autoPlay
                playsInline
                muted
                className="w-full h-full object-cover"
              />

              {/* Khung hướng dẫn căn chỉnh trang sách */}
              <div className="absolute inset-8 sm:inset-12 border-2 border-dashed border-amber-400/80 rounded-2xl pointer-events-none flex flex-col justify-between p-3">
                <span className="text-[11px] font-mono text-amber-300 bg-black/50 px-2 py-0.5 rounded-md self-start">
                  Căn trang sách vào viền vàng
                </span>
                <span className="text-[11px] font-mono text-amber-300 bg-black/50 px-2 py-0.5 rounded-md self-end">
                  Giữ máy chắc tay & đủ sáng
                </span>
              </div>
            </>
          )}
        </div>

        {/* Footer controls */}
        <div className="p-4 bg-slate-950 flex items-center justify-around border-t border-slate-800">
          <button
            onClick={toggleFacingMode}
            title="Đổi camera trước/sau"
            className="p-3 rounded-full bg-slate-800 text-slate-300 hover:text-white hover:bg-slate-700 transition-colors"
          >
            <FlipHorizontal className="w-5 h-5" />
          </button>

          {/* Nút Chụp hình to chính giữa */}
          <button
            onClick={handleCapture}
            disabled={!!error}
            title="Bấm để chụp trang sách"
            className="w-16 h-16 rounded-full bg-amber-500 hover:bg-amber-400 text-amber-950 flex items-center justify-center shadow-lg shadow-amber-500/40 active:scale-90 transition-transform disabled:opacity-40"
          >
            <div className="w-12 h-12 rounded-full border-4 border-amber-950 flex items-center justify-center">
              <Camera className="w-6 h-6" />
            </div>
          </button>

          <button
            onClick={() => {
              stopActiveStream();
              onClose();
            }}
            className="px-4 py-2 rounded-xl text-xs font-medium text-slate-400 hover:text-white"
          >
            Đóng
          </button>
        </div>
      </div>
    </div>
  );
}

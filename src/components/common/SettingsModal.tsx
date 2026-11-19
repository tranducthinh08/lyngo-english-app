'use client';

import React, { useState, useEffect } from 'react';
import { X, Key, Check, ExternalLink, Type, Loader2, AlertCircle, CheckCircle2, Cloud, Database, RefreshCw } from 'lucide-react';
import { getStoredGeminiKey, setStoredGeminiKey, getReaderFontSize, setReaderFontSize, getReaderSerifMode, setReaderSerifMode } from '@/lib/settings';
import { getSupabaseConfig, saveSupabaseConfig, testSupabaseConnection } from '@/lib/supabase';
import { syncService } from '@/lib/syncService';
import CuteCat from '@/components/common/CuteCat';

interface SettingsModalProps {
  onClose: () => void;
}

export default function SettingsModal({ onClose }: SettingsModalProps) {
  const [apiKey, setApiKey] = useState('');
  const [fontSize, setFontSize] = useState(18);
  const [isSerif, setIsSerif] = useState(true);
  const [isSaved, setIsSaved] = useState(false);

  // Cấu hình Supabase Cloud
  const [supabaseUrl, setSupabaseUrl] = useState('');
  const [supabaseKey, setSupabaseKey] = useState('');
  const [isTestingSupabase, setIsTestingSupabase] = useState(false);
  const [supabaseTestResult, setSupabaseTestResult] = useState<{
    success: boolean;
    message?: string;
    error?: string;
  } | null>(null);
  const [isSyncing, setIsSyncing] = useState(false);
  const [syncFeedback, setSyncFeedback] = useState<string | null>(null);

  // Trạng thái kiểm tra key Gemini
  const [isTestingKey, setIsTestingKey] = useState(false);
  const [testResult, setTestResult] = useState<{
    success: boolean;
    message?: string;
    error?: string;
    bestModel?: string;
  } | null>(null);

  useEffect(() => {
    setApiKey(getStoredGeminiKey());
    setFontSize(getReaderFontSize());
    setIsSerif(getReaderSerifMode());

    const sb = getSupabaseConfig();
    setSupabaseUrl(sb.url);
    setSupabaseKey(sb.key);
  }, []);

  const handleTestSupabase = async () => {
    if (!supabaseUrl.trim() || !supabaseKey.trim()) {
      setSupabaseTestResult({
        success: false,
        message: 'Vui lòng nhập cả Supabase URL và Anon Public Key nhé!'
      });
      return;
    }

    setIsTestingSupabase(true);
    setSupabaseTestResult(null);

    // Lưu tạm thời để test
    saveSupabaseConfig(supabaseUrl, supabaseKey);

    const res = await testSupabaseConnection();
    setSupabaseTestResult(res);
    setIsTestingSupabase(false);
  };

  const handleManualSync = async () => {
    if (!supabaseUrl.trim() || !supabaseKey.trim()) {
      alert('Vui lòng nhập cấu hình Supabase trước khi đồng bộ meow~');
      return;
    }

    saveSupabaseConfig(supabaseUrl, supabaseKey);
    setIsSyncing(true);
    setSyncFeedback(null);

    const ok = await syncService.runFullSync();
    setIsSyncing(false);

    if (ok) {
      setSyncFeedback('Đồng bộ thành công! Sách và từ vựng đã sẵn sàng trên Mây 🐾');
    } else {
      setSyncFeedback('Đồng bộ chưa hoàn tất, vui lòng kiểm tra lại kết nối!');
    }
  };

  const handleTestKey = async () => {
    if (!apiKey.trim()) {
      setTestResult({
        success: false,
        error: 'Vui lòng dán mã API Key trước khi kiểm tra meow~'
      });
      return;
    }

    setIsTestingKey(true);
    setTestResult(null);

    try {
      const res = await fetch('/api/test-key', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ key: apiKey.trim() }),
      });
      const data = await res.json();

      if (res.ok && data.success) {
        setTestResult({
          success: true,
          message: data.message,
          bestModel: data.bestModel
        });
      } else {
        setTestResult({
          success: false,
          error: data.error || 'Không thể xác thực API Key với Google'
        });
      }
    } catch (err: unknown) {
      const error = err as Error;
      setTestResult({
        success: false,
        error: `Lỗi kết nối mạng: ${error.message}`
      });
    } finally {
      setIsTestingKey(false);
    }
  };

  const handleSave = () => {
    setStoredGeminiKey(apiKey);
    setReaderFontSize(fontSize);
    setReaderSerifMode(isSerif);

    saveSupabaseConfig(supabaseUrl, supabaseKey);
    if (supabaseUrl.trim() && supabaseKey.trim()) {
      syncService.triggerSync(400);
    }

    setIsSaved(true);
    setTimeout(() => {
      setIsSaved(false);
      onClose();
    }, 800);
  };

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/45 backdrop-blur-sm p-4 overflow-y-auto">
      <div className="bg-[#fffdfa] rounded-3xl border-2 border-orange-200 shadow-modal max-w-lg w-full max-h-[90vh] flex flex-col overflow-hidden my-auto animate-in fade-in zoom-in-95 duration-150">
        {/* Header */}
        <div className="px-6 py-4 border-b border-orange-200 flex items-center justify-between bg-gradient-to-r from-orange-100 via-amber-50 to-orange-100 shrink-0">
          <div className="flex items-center gap-3">
            <CuteCat size={38} mood="reading" />
            <div>
              <h2 className="font-serif font-black text-xl text-orange-950 flex items-center gap-1.5">
                Cài Đặt Mèo Cam <span>🐾</span>
              </h2>
              <p className="text-xs text-orange-800 font-medium">Khóa API và kiểu hiển thị cho Cô Ly :3</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-full text-orange-800 hover:bg-orange-200 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content */}
        <div className="p-6 space-y-5 flex-1 overflow-y-auto min-h-0">
          {/* Gemini API Key */}
          <div className="space-y-2">
            <label className="block text-sm font-bold text-orange-950 flex items-center justify-between">
              <span className="flex items-center gap-1.5">
                <Key className="w-4 h-4 text-orange-600" />
                Google Gemini API Key (Soi Sách AI)
              </span>
              <a
                href="https://aistudio.google.com/app/apikey"
                target="_blank"
                rel="noreferrer"
                className="text-xs text-orange-700 hover:text-orange-900 underline flex items-center gap-1 font-bold"
              >
                Lấy Key miễn phí <ExternalLink className="w-3 h-3" />
              </a>
            </label>

            <div className="flex gap-2">
              <input
                type="password"
                value={apiKey}
                onChange={(e) => {
                  setApiKey(e.target.value);
                  setTestResult(null);
                }}
                placeholder="Dán AIzaSy... vào đây meow~"
                className="w-full px-3.5 py-2.5 rounded-2xl border-2 border-orange-300 bg-white text-orange-950 placeholder-orange-300 focus:outline-none focus:ring-2 focus:ring-orange-500 font-mono text-sm font-bold"
              />
              <button
                type="button"
                onClick={handleTestKey}
                disabled={isTestingKey}
                className="px-3.5 py-2.5 rounded-2xl bg-orange-100 text-orange-950 font-bold text-xs hover:bg-orange-200 border-2 border-orange-300 shrink-0 transition-colors flex items-center gap-1 disabled:opacity-50"
              >
                {isTestingKey ? (
                  <>
                    <Loader2 className="w-3.5 h-3.5 animate-spin" />
                    <span>Đang thử...</span>
                  </>
                ) : (
                  <span>Kiểm tra 🐾</span>
                )}
              </button>
            </div>

            {/* Kết quả kiểm tra API Key */}
            {testResult && (
              <div
                className={`p-3 rounded-2xl border-2 text-xs font-bold flex items-start gap-2 ${
                  testResult.success
                    ? 'bg-emerald-50 border-emerald-300 text-emerald-900'
                    : 'bg-rose-50 border-rose-300 text-rose-900'
                }`}
              >
                {testResult.success ? (
                  <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0 mt-0.5" />
                ) : (
                  <AlertCircle className="w-4 h-4 text-rose-600 shrink-0 mt-0.5" />
                )}
                <div className="space-y-0.5">
                  <p>{testResult.message || testResult.error}</p>
                  {testResult.bestModel && (
                    <p className="text-[11px] text-emerald-700 font-mono font-medium">
                      Mô hình tối ưu sẽ dùng: {testResult.bestModel}
                    </p>
                  )}
                </div>
              </div>
            )}

            <p className="text-xs text-orange-800/80 leading-relaxed font-medium">
              * Khóa API được lưu trực tiếp trên máy của cô, 100% an toàn. Bấm nút &quot;Kiểm tra 🐾&quot; để Mèo Cam kiểm tra xem khóa đã hợp lệ chưa nhé!
            </p>
          </div>

          <hr className="border-orange-200" />

          {/* Supabase Cloud Database */}
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <label className="text-sm font-bold text-orange-950 flex items-center gap-1.5">
                <Cloud className="w-4 h-4 text-orange-600" />
                Cơ sở dữ liệu đám mây Supabase (Đồng bộ đa thiết bị)
              </label>
              <a
                href="https://supabase.com/dashboard"
                target="_blank"
                rel="noreferrer"
                className="text-xs text-orange-700 hover:text-orange-900 underline flex items-center gap-1 font-bold"
              >
                Supabase Dashboard <ExternalLink className="w-3 h-3" />
              </a>
            </div>

            <div className="space-y-2">
              <div>
                <span className="text-[11px] font-bold text-orange-900">Project URL:</span>
                <input
                  type="text"
                  value={supabaseUrl}
                  onChange={(e) => {
                    setSupabaseUrl(e.target.value);
                    setSupabaseTestResult(null);
                  }}
                  placeholder="https://xyzcompany.supabase.co"
                  className="w-full px-3 py-2 rounded-xl border-2 border-orange-200 bg-white text-orange-950 placeholder-orange-300 focus:outline-none focus:ring-2 focus:ring-orange-500 font-mono text-xs font-medium"
                />
              </div>

              <div>
                <span className="text-[11px] font-bold text-orange-900">Anon Public Key:</span>
                <input
                  type="password"
                  value={supabaseKey}
                  onChange={(e) => {
                    setSupabaseKey(e.target.value);
                    setSupabaseTestResult(null);
                  }}
                  placeholder="eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9..."
                  className="w-full px-3 py-2 rounded-xl border-2 border-orange-200 bg-white text-orange-950 placeholder-orange-300 focus:outline-none focus:ring-2 focus:ring-orange-500 font-mono text-xs font-medium"
                />
              </div>
            </div>

            <div className="flex items-center gap-2 pt-1">
              <button
                type="button"
                onClick={handleTestSupabase}
                disabled={isTestingSupabase}
                className="px-3 py-1.5 rounded-xl bg-orange-100 text-orange-950 font-bold text-xs hover:bg-orange-200 border border-orange-300 transition-colors flex items-center gap-1 disabled:opacity-50"
              >
                {isTestingSupabase ? (
                  <>
                    <Loader2 className="w-3.5 h-3.5 animate-spin" />
                    <span>Đang kết nối...</span>
                  </>
                ) : (
                  <>
                    <Database className="w-3.5 h-3.5 text-orange-600" />
                    <span>Kiểm tra kết nối ☁️</span>
                  </>
                )}
              </button>

              <button
                type="button"
                onClick={handleManualSync}
                disabled={isSyncing}
                className="px-3 py-1.5 rounded-xl bg-emerald-100 text-emerald-950 font-bold text-xs hover:bg-emerald-200 border border-emerald-300 transition-colors flex items-center gap-1 disabled:opacity-50"
              >
                {isSyncing ? (
                  <>
                    <Loader2 className="w-3.5 h-3.5 animate-spin text-emerald-600" />
                    <span>Đang đồng bộ...</span>
                  </>
                ) : (
                  <>
                    <RefreshCw className="w-3.5 h-3.5 text-emerald-600" />
                    <span>Đồng bộ ngay 🐾</span>
                  </>
                )}
              </button>
            </div>

            {/* Thông báo kết quả kiểm tra Supabase */}
            {supabaseTestResult && (
              <div
                className={`p-3 rounded-2xl border-2 text-xs font-bold flex items-start gap-2 ${
                  supabaseTestResult.success
                    ? 'bg-emerald-50 border-emerald-300 text-emerald-900'
                    : 'bg-rose-50 border-rose-300 text-rose-900'
                }`}
              >
                {supabaseTestResult.success ? (
                  <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0 mt-0.5" />
                ) : (
                  <AlertCircle className="w-4 h-4 text-rose-600 shrink-0 mt-0.5" />
                )}
                <div>
                  <p>{supabaseTestResult.message}</p>
                </div>
              </div>
            )}

            {/* Thông báo đồng bộ */}
            {syncFeedback && (
              <div className="p-2.5 rounded-xl bg-amber-50 border border-amber-300 text-amber-900 text-xs font-bold flex items-center gap-1.5">
                <span>🐾</span>
                <span>{syncFeedback}</span>
              </div>
            )}

            <p className="text-[11px] text-orange-800/80 leading-relaxed font-medium">
              💡 Chạy file <code>supabase/schema.sql</code> trong SQL Editor của Supabase để khởi tạo bảng và bucket lưu ảnh 1-chạm. Khi kết nối, sách và từ vựng sẽ tự động đồng bộ giữa máy tính & điện thoại của Cô Ly!
            </p>
          </div>

          <hr className="border-orange-200" />

          {/* Cài đặt hiển thị sách */}
          <div className="space-y-4">
            <h3 className="text-sm font-bold text-orange-950 flex items-center gap-1.5">
              <Type className="w-4 h-4 text-orange-600" /> Tùy chỉnh hiển thị trang sách
            </h3>

            {/* Cỡ chữ */}
            <div className="flex items-center justify-between">
              <span className="text-sm font-medium text-orange-900">Cỡ chữ văn bản:</span>
              <div className="flex items-center gap-3">
                <span className="text-xs font-black text-orange-800 bg-orange-100 px-2.5 py-1 rounded-xl border border-orange-200">
                  {fontSize}px
                </span>
                <input
                  type="range"
                  min="16"
                  max="26"
                  step="2"
                  value={fontSize}
                  onChange={(e) => setFontSize(parseInt(e.target.value, 10))}
                  className="w-32 accent-orange-500"
                />
              </div>
            </div>

            {/* Kiểu font */}
            <div className="flex items-center justify-between">
              <span className="text-sm font-medium text-orange-900">Kiểu phông chữ:</span>
              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={() => setIsSerif(true)}
                  className={`px-3.5 py-2 rounded-2xl text-xs font-serif font-bold border-2 transition-all ${
                    isSerif
                      ? 'bg-orange-500 text-white border-orange-600 shadow-md scale-102'
                      : 'bg-white text-orange-900 border-orange-200 hover:bg-orange-50'
                  }`}
                >
                  Sách giấy (Serif) 📖
                </button>
                <button
                  type="button"
                  onClick={() => setIsSerif(false)}
                  className={`px-3.5 py-2 rounded-2xl text-xs font-sans font-bold border-2 transition-all ${
                    !isSerif
                      ? 'bg-orange-500 text-white border-orange-600 shadow-md scale-102'
                      : 'bg-white text-orange-900 border-orange-200 hover:bg-orange-50'
                  }`}
                >
                  Hiện đại (Sans) 🐾
                </button>
              </div>
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="px-6 py-3.5 bg-[#fffdfa] border-t border-orange-200 flex items-center justify-end gap-3 shrink-0">
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 rounded-2xl text-sm font-bold text-orange-800 hover:bg-orange-100 transition-colors"
          >
            Hủy
          </button>
          <button
            type="button"
            onClick={handleSave}
            className="px-6 py-2.5 rounded-2xl text-sm font-black bg-gradient-to-r from-orange-500 to-amber-500 text-white hover:scale-105 shadow-md shadow-orange-500/20 transition-all flex items-center gap-1.5 active:scale-95 cursor-pointer"
          >
            {isSaved ? (
              <>
                <Check className="w-4 h-4 text-emerald-200" /> Mèo Cam đã lưu! 🐾
              </>
            ) : (
              'Lưu cài đặt 🐾'
            )}
          </button>
        </div>
      </div>
    </div>
  );
}

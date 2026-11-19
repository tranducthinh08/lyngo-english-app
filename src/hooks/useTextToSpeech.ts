'use client';

import { useState, useEffect, useRef, useCallback } from 'react';
import { splitIntoSentences, getBestEnglishVoice, getEnglishVoices } from '@/lib/speech';

export type TtsEngine = 'google' | 'browser';

export function useTextToSpeech(fullText: string) {
  const [sentences, setSentences] = useState<string[]>([]);
  const [currentSentenceIndex, setCurrentSentenceIndex] = useState<number>(-1);
  const [isPlaying, setIsPlaying] = useState<boolean>(false);
  const [isPaused, setIsPaused] = useState<boolean>(false);
  const [rate, setRate] = useState<number>(1.0);
  const [engine, setEngine] = useState<TtsEngine>('google'); // Mặc định Google Translate TTS
  const [voices, setVoices] = useState<SpeechSynthesisVoice[]>([]);
  const [selectedVoice, setSelectedVoice] = useState<SpeechSynthesisVoice | null>(null);

  const isPlayingRef = useRef<boolean>(false);
  const currentIndexRef = useRef<number>(-1);
  const rateRef = useRef<number>(1.0);
  const voiceRef = useRef<SpeechSynthesisVoice | null>(null);
  const engineRef = useRef<TtsEngine>('google');
  const sentencesRef = useRef<string[]>([]);

  // HTML5 Audio element cho Google Translate TTS (hoạt động 100% không lo lỗi mute)
  const htmlAudioRef = useRef<HTMLAudioElement | null>(null);
  const activeUtteranceRef = useRef<SpeechSynthesisUtterance | null>(null);

  isPlayingRef.current = isPlaying;
  currentIndexRef.current = currentSentenceIndex;
  rateRef.current = rate;
  voiceRef.current = selectedVoice;
  engineRef.current = engine;
  sentencesRef.current = sentences;

  // Dọn dẹp an toàn Audio element để tránh rò rỉ bộ nhớ và lỗi xung đột luồng âm thanh
  const cleanupHtmlAudio = useCallback(() => {
    if (htmlAudioRef.current) {
      htmlAudioRef.current.onplay = null;
      htmlAudioRef.current.onended = null;
      htmlAudioRef.current.onerror = null;
      htmlAudioRef.current.pause();
      htmlAudioRef.current.src = '';
      htmlAudioRef.current = null;
    }
  }, []);

  // Khởi tạo danh sách câu khi fullText thay đổi
  useEffect(() => {
    const s = splitIntoSentences(fullText);
    setSentences(s);
    sentencesRef.current = s;
    setCurrentSentenceIndex(-1);
    setIsPlaying(false);
    setIsPaused(false);
    cleanupHtmlAudio();
  }, [fullText, cleanupHtmlAudio]);

  // Nạp danh sách giọng đọc từ trình duyệt (cho chế độ browser)
  useEffect(() => {
    if (typeof window === 'undefined' || !window.speechSynthesis) return;

    const loadVoices = () => {
      const v = getEnglishVoices();
      if (v.length > 0) {
        setVoices(v);
        const best = getBestEnglishVoice();
        setSelectedVoice((prev) => prev || best);
      }
    };

    loadVoices();
    if (window.speechSynthesis.onvoiceschanged !== undefined) {
      window.speechSynthesis.onvoiceschanged = loadVoices;
    }
  }, []);

  // -------------------------------------------------------------
  // ĐỘNG CƠ 2: WEB SPEECH API CỦA TRÌNH DUYỆT (Fallback)
  // -------------------------------------------------------------
  const executeBrowserSpeak = useCallback((index: number) => {
    if (typeof window === 'undefined' || !window.speechSynthesis) return;
    const list = sentencesRef.current;
    if (index < 0 || index >= list.length) {
      setIsPlaying(false);
      setIsPaused(false);
      setCurrentSentenceIndex(-1);
      return;
    }

    const text = list[index].trim();
    if (!text) {
      if (isPlayingRef.current && index + 1 < list.length) {
        executeBrowserSpeak(index + 1);
      }
      return;
    }

    if (window.speechSynthesis.paused) {
      window.speechSynthesis.resume();
    }

    const utterance = new SpeechSynthesisUtterance(text);
    activeUtteranceRef.current = utterance;
    (window as unknown as { _lyngoUtterance?: SpeechSynthesisUtterance })._lyngoUtterance = utterance;

    if (voiceRef.current) {
      utterance.voice = voiceRef.current;
      utterance.lang = voiceRef.current.lang || 'en-US';
    } else {
      utterance.lang = 'en-US';
    }

    utterance.volume = 1.0;
    utterance.rate = Math.max(0.5, Math.min(2.0, rateRef.current || 1.0));
    utterance.pitch = 1.0;

    utterance.onstart = () => {
      setCurrentSentenceIndex(index);
      setIsPlaying(true);
      setIsPaused(false);
    };

    utterance.onend = () => {
      if (isPlayingRef.current) {
        const nextIdx = index + 1;
        if (nextIdx < sentencesRef.current.length) {
          executeBrowserSpeak(nextIdx);
        } else {
          setIsPlaying(false);
          setIsPaused(false);
          setCurrentSentenceIndex(-1);
        }
      }
    };

    utterance.onerror = (event) => {
      if (event.error !== 'canceled' && event.error !== 'interrupted') {
        console.warn('Web Speech error:', event.error);
      }
      if (isPlayingRef.current && index + 1 < sentencesRef.current.length) {
        executeBrowserSpeak(index + 1);
      } else {
        setIsPlaying(false);
        setIsPaused(false);
      }
    };

    window.speechSynthesis.speak(utterance);
  }, []);

  // -------------------------------------------------------------
  // ĐỘNG CƠ 1: GOOGLE TRANSLATE TTS (MP3 trực tiếp qua HTML5 Audio)
  // -------------------------------------------------------------
  const playGoogleSentence = useCallback((index: number) => {
    const list = sentencesRef.current;
    if (index < 0 || index >= list.length) {
      setIsPlaying(false);
      setIsPaused(false);
      setCurrentSentenceIndex(-1);
      return;
    }

    const text = list[index].trim();
    if (!text) {
      if (isPlayingRef.current && index + 1 < list.length) {
        playGoogleSentence(index + 1);
      }
      return;
    }

    cleanupHtmlAudio();

    const audioUrl = `/api/tts?text=${encodeURIComponent(text)}&lang=en`;
    const audio = new Audio(audioUrl);
    htmlAudioRef.current = audio;
    audio.playbackRate = rateRef.current;

    audio.onplay = () => {
      setCurrentSentenceIndex(index);
      setIsPlaying(true);
      setIsPaused(false);
    };

    audio.onended = () => {
      if (isPlayingRef.current) {
        const nextIdx = index + 1;
        if (nextIdx < sentencesRef.current.length) {
          playGoogleSentence(nextIdx);
        } else {
          setIsPlaying(false);
          setIsPaused(false);
          setCurrentSentenceIndex(-1);
        }
      }
    };

    audio.onerror = (e) => {
      console.warn('Lỗi phát âm thanh Google TTS:', e);
      executeBrowserSpeak(index);
    };

    audio.play().catch((err) => {
      console.warn('Không thể tự động phát Google Audio:', err);
      executeBrowserSpeak(index);
    });
  }, [executeBrowserSpeak, cleanupHtmlAudio]);

  // -------------------------------------------------------------
  // ĐIỀU KHIỂN CHUNG (TỰ ĐỘNG CHỌN THEO ENGINE)
  // -------------------------------------------------------------
  const playSentence = useCallback((index: number) => {
    setIsPlaying(true);
    setIsPaused(false);

    if (engineRef.current === 'google') {
      playGoogleSentence(index);
    } else {
      if (typeof window !== 'undefined' && window.speechSynthesis) {
        if (window.speechSynthesis.speaking || window.speechSynthesis.pending) {
          window.speechSynthesis.cancel();
          setTimeout(() => executeBrowserSpeak(index), 60);
        } else {
          executeBrowserSpeak(index);
        }
      }
    }
  }, [playGoogleSentence, executeBrowserSpeak]);

  const play = useCallback((startIndex?: number) => {
    const list = sentencesRef.current;
    if (list.length === 0) return;

    if (isPaused) {
      if (engineRef.current === 'google' && htmlAudioRef.current) {
        htmlAudioRef.current.play();
        setIsPaused(false);
        setIsPlaying(true);
        return;
      } else if (typeof window !== 'undefined' && window.speechSynthesis) {
        window.speechSynthesis.resume();
        setIsPaused(false);
        setIsPlaying(true);
        return;
      }
    }

    const targetIdx = startIndex !== undefined
      ? startIndex
      : (currentSentenceIndex >= 0 ? currentSentenceIndex : 0);

    playSentence(targetIdx);
  }, [isPaused, currentSentenceIndex, playSentence]);

  const pause = useCallback(() => {
    setIsPaused(true);
    setIsPlaying(false);

    if (engineRef.current === 'google') {
      if (htmlAudioRef.current) {
        htmlAudioRef.current.pause();
      }
    } else {
      if (typeof window !== 'undefined' && window.speechSynthesis) {
        window.speechSynthesis.pause();
      }
    }
  }, []);

  const stop = useCallback(() => {
    setIsPlaying(false);
    setIsPaused(false);
    setCurrentSentenceIndex(-1);

    cleanupHtmlAudio();
    if (typeof window !== 'undefined' && window.speechSynthesis) {
      window.speechSynthesis.cancel();
    }
  }, [cleanupHtmlAudio]);

  const nextSentence = useCallback(() => {
    const list = sentencesRef.current;
    if (currentSentenceIndex + 1 < list.length) {
      const nextIdx = currentSentenceIndex + 1;
      playSentence(nextIdx);
    }
  }, [currentSentenceIndex, playSentence]);

  const prevSentence = useCallback(() => {
    if (currentSentenceIndex > 0) {
      const prevIdx = currentSentenceIndex - 1;
      playSentence(prevIdx);
    }
  }, [currentSentenceIndex, playSentence]);

  const changeRate = useCallback((newRate: number) => {
    setRate(newRate);
    rateRef.current = newRate;
    if (htmlAudioRef.current) {
      htmlAudioRef.current.playbackRate = newRate;
    }
  }, []);

  const changeVoice = useCallback((voice: SpeechSynthesisVoice) => {
    setSelectedVoice(voice);
    voiceRef.current = voice;
  }, []);

  const selectEngine = useCallback((newEngine: TtsEngine) => {
    setEngine(newEngine);
    engineRef.current = newEngine;
    // Dừng sạch âm thanh của động cơ cũ trước khi chuyển
    cleanupHtmlAudio();
    if (typeof window !== 'undefined' && window.speechSynthesis) {
      window.speechSynthesis.cancel();
    }
    if (isPlaying && currentSentenceIndex >= 0) {
      playSentence(currentSentenceIndex);
    }
  }, [isPlaying, currentSentenceIndex, playSentence, cleanupHtmlAudio]);

  // Thử loa (phát câu test trực tiếp bằng Google Translate TTS)
  const testVoiceSound = useCallback(() => {
    const audio = new Audio('/api/tts?text=Hello%20Co%20Ly!%20Meo%20Cam%20da%20san%20sang%20doc%20sach.&lang=en');
    audio.playbackRate = rateRef.current;
    audio.play().catch((err) => {
      console.warn('Lỗi thử loa:', err);
      if (typeof window !== 'undefined' && window.speechSynthesis) {
        const u = new SpeechSynthesisUtterance('Hello Cô Ly! Mèo Cam đã sẵn sàng đọc sách.');
        window.speechSynthesis.speak(u);
      }
    });
  }, []);

  // Cleanup
  useEffect(() => {
    return () => {
      cleanupHtmlAudio();
      if (typeof window !== 'undefined' && window.speechSynthesis) {
        window.speechSynthesis.cancel();
      }
    };
  }, [cleanupHtmlAudio]);

  return {
    sentences,
    currentSentenceIndex,
    isPlaying,
    isPaused,
    rate,
    engine,
    voices,
    selectedVoice,
    play,
    playSentence,
    pause,
    stop,
    nextSentence,
    prevSentence,
    changeRate,
    changeVoice,
    selectEngine,
    testVoiceSound
  };
}

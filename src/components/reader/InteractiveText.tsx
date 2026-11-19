'use client';

import React, { useRef, useEffect, useMemo } from 'react';
import { Volume2 } from 'lucide-react';
import { VocabNote } from '@/types';
import { getStructuredParagraphs } from '@/lib/speech';

interface InteractiveTextProps {
  text: string;
  activeSentenceIndex: number;
  notes: VocabNote[];
  onSelectWord: (word: string, position: { x: number; y: number }) => void;
  onOpenExistingNote: (note: VocabNote) => void;
  onPlaySentence?: (index: number) => void;
  fontSize?: number;
  isSerif?: boolean;
}

export default function InteractiveText({
  text,
  activeSentenceIndex,
  notes,
  onSelectWord,
  onOpenExistingNote,
  onPlaySentence,
  fontSize = 18,
  isSerif = true,
}: InteractiveTextProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const activeSentenceRef = useRef<HTMLSpanElement>(null);
  const mouseUpTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  // Dọn dẹp timer khi unmount
  useEffect(() => {
    return () => {
      if (mouseUpTimeoutRef.current) {
        clearTimeout(mouseUpTimeoutRef.current);
      }
    };
  }, []);

  // Tự động cuộn đến câu đang đọc nếu đang phát voice
  useEffect(() => {
    if (activeSentenceIndex >= 0 && activeSentenceRef.current) {
      activeSentenceRef.current.scrollIntoView({
        behavior: 'smooth',
        block: 'center',
      });
    }
  }, [activeSentenceIndex]);

  // Tạo map tra cứu các từ đã ghi chú (lowercase)
  const notesMap = useMemo(() => {
    const map = new Map<string, VocabNote>();
    for (const n of notes) {
      map.set(n.word.toLowerCase().trim(), n);
    }
    return map;
  }, [notes]);

  // Bắt sự kiện double-click trên từ
  const handleDoubleClick = (e: React.MouseEvent) => {
    // Hủy bỏ mouseUp pending để tránh giật giao diện hoặc kích hoạt trùng lặp
    if (mouseUpTimeoutRef.current) {
      clearTimeout(mouseUpTimeoutRef.current);
      mouseUpTimeoutRef.current = null;
    }

    const selection = window.getSelection();
    const selectedText = selection ? selection.toString().trim() : '';

    if (selectedText && selectedText.length > 1) {
      const clean = selectedText.replace(/^[^\w]+|[^\w]+$/g, '');
      if (clean) {
        onSelectWord(clean, { x: e.clientX, y: e.clientY });
      }
    }
  };

  // Bắt sự kiện bôi đen cụm từ (MouseUp với debounce để tránh xung đột double-click)
  const handleMouseUp = () => {
    if (mouseUpTimeoutRef.current) {
      clearTimeout(mouseUpTimeoutRef.current);
    }

    mouseUpTimeoutRef.current = setTimeout(() => {
      const selection = window.getSelection();
      if (!selection || selection.isCollapsed) return;

      const selectedText = selection.toString().trim();
      if (selectedText.length >= 2 && /[a-zA-Z]/.test(selectedText)) {
        const range = selection.getRangeAt(0);
        const rect = range.getBoundingClientRect();
        const clean = selectedText.replace(/^[^\w]+|[^\w]+$/g, '');
        if (clean) {
          onSelectWord(clean, {
            x: rect.left + rect.width / 2,
            y: rect.bottom,
          });
        }
      }
    }, 200);
  };

  // Tách đoạn văn & câu đồng bộ 100% với Speech Engine
  const { paragraphs } = useMemo(() => {
    return getStructuredParagraphs(text);
  }, [text]);

  return (
    <div
      ref={containerRef}
      onDoubleClick={handleDoubleClick}
      onMouseUp={handleMouseUp}
      style={{ fontSize: `${fontSize}px` }}
      className={`leading-relaxed text-orange-950/90 select-text transition-all ${
        isSerif ? 'font-serif' : 'font-sans'
      }`}
    >
      {paragraphs.map((pBlock) => (
        <p key={pBlock.paragraphIndex} className="mb-6 tracking-normal">
          {pBlock.sentences.map((sentBlock) => {
            const isActive = sentBlock.globalIndex === activeSentenceIndex;

            return (
              <span
                key={sentBlock.globalIndex}
                ref={isActive ? activeSentenceRef : null}
                className={`group/sentence relative inline transition-all duration-200 rounded-lg px-1 py-0.5 ${
                  isActive
                    ? 'bg-amber-200/95 text-orange-950 font-bold ring-2 ring-orange-400 shadow-sm'
                    : 'hover:bg-orange-100/50'
                }`}
              >
                {/* Nút loa nhỏ khi hover để Cô Ly nghe riêng câu này */}
                {onPlaySentence && (
                  <button
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation();
                      onPlaySentence(sentBlock.globalIndex);
                    }}
                    title="Bấm để Mèo Cam đọc riêng câu này 🎧"
                    className="opacity-0 group-hover/sentence:opacity-100 inline-flex items-center justify-center -translate-y-0.5 p-1 mx-0.5 rounded-full bg-orange-500 text-white hover:bg-orange-600 transition-opacity shadow-2xs cursor-pointer align-middle"
                  >
                    <Volume2 className="w-3 h-3" />
                  </button>
                )}
                {renderSentenceWithNotes(sentBlock.text, notesMap, onOpenExistingNote)}
                {' '}
              </span>
            );
          })}
        </p>
      ))}
    </div>
  );
}

/**
 * Render câu với biểu tượng đệm chân mèo cho các từ & cụm từ cô Ly đã note
 * Hỗ trợ cả từ đơn lẫn cụm từ (collocations/idioms) bằng thuật toán Regex matching ưu tiên cụm từ dài trước
 */
function renderSentenceWithNotes(
  sentence: string,
  notesMap: Map<string, VocabNote>,
  onOpenExistingNote: (note: VocabNote) => void
) {
  if (notesMap.size === 0) {
    return <span>{sentence}</span>;
  }

  // Sắp xếp các từ/cụm từ theo độ dài giảm dần để ưu tiên match cụm dài trước (vd: "bring to bear" trước "bear")
  const sortedKeys = Array.from(notesMap.keys()).sort((a, b) => b.length - a.length);

  // Thoát các ký tự đặc biệt của RegExp
  const escapedTerms = sortedKeys.map((k) => k.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'));
  if (escapedTerms.length === 0) {
    return <span>{sentence}</span>;
  }

  // Khớp chính xác ranh giới từ (\b) để không match nhầm từ con trong từ khác
  const phrasePattern = new RegExp(`(\\b(?:${escapedTerms.join('|')})\\b)`, 'gi');
  const parts = sentence.split(phrasePattern);

  return parts.map((part, idx) => {
    const clean = part.toLowerCase().trim();
    const existingNote = notesMap.get(clean);

    if (existingNote) {
      return (
        <span
          key={idx}
          onClick={(e) => {
            e.stopPropagation();
            onOpenExistingNote(existingNote);
          }}
          title={`Kiểu nhớ của Cô Ly: "${existingNote.meaning}" - Bấm để xem`}
          className="cursor-pointer bg-orange-100 text-orange-950 px-1.5 py-0.5 rounded-md border-b-2 border-orange-400 hover:bg-orange-200 font-bold transition-colors inline-flex items-center gap-1 shadow-2xs"
        >
          {part}
          <span className="text-[11px] text-orange-600 font-sans">🐾</span>
        </span>
      );
    }

    return <span key={idx}>{part}</span>;
  });
}

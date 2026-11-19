import { VocabNote } from '@/types';

export type SM2Rating = 1 | 2 | 3 | 4;

export interface SM2Result {
  interval: number;
  repetitions: number;
  easeFactor: number;
  nextReviewDate: number;
  lastReviewedAt: number;
  status: 'learning' | 'mastered';
}

const ONE_DAY_MS = 24 * 60 * 60 * 1000;

/**
 * Thuật toán SuperMemo SM-2 chuẩn Anki
 * Rating:
 *  1: Học lại (Again) - Quên từ, cần học lại
 *  2: Khó (Hard) - Nhớ mang máng, mất nhiều thời gian
 *  3: Tốt (Good) - Nhớ tốt, đúng nhịp
 *  4: Dễ (Easy) - Nhớ quá rõ, từ quen thuộc
 */
export function calculateSM2(card: VocabNote, rating: SM2Rating): SM2Result {
  let interval = typeof card.interval === 'number' && !isNaN(card.interval) && card.interval > 0 ? card.interval : 1;
  let repetitions = typeof card.repetitions === 'number' && !isNaN(card.repetitions) && card.repetitions >= 0 ? card.repetitions : 0;
  let easeFactor = typeof card.easeFactor === 'number' && !isNaN(card.easeFactor) && card.easeFactor >= 1.3 ? card.easeFactor : 2.5;
  const now = Date.now();

  if (rating === 1) {
    // Học lại: Reset số lần nhớ liên tiếp, khoảng cách về 1 ngày
    repetitions = 0;
    interval = 1;
    easeFactor = Math.max(1.3, easeFactor - 0.2);
  } else if (rating === 2) {
    // Khó: Tăng nhẹ khoảng cách, giảm nhẹ easeFactor
    if (repetitions === 0) {
      interval = 1;
    } else if (repetitions === 1) {
      interval = 3;
    } else {
      interval = Math.max(1, Math.round(interval * 1.2));
    }
    easeFactor = Math.max(1.3, easeFactor - 0.15);
    repetitions += 1;
  } else if (rating === 3) {
    // Tốt: Nhịp tăng chuẩn SM-2 (1 ngày -> 6 ngày -> interval * EF)
    if (repetitions === 0) {
      interval = 1;
    } else if (repetitions === 1) {
      interval = 6;
    } else {
      interval = Math.max(1, Math.round(interval * easeFactor));
    }
    repetitions += 1;
  } else if (rating === 4) {
    // Dễ: Thưởng khoảng cách và tăng hệ số ghi nhớ
    if (repetitions === 0) {
      interval = 3;
    } else if (repetitions === 1) {
      interval = 8;
    } else {
      interval = Math.max(1, Math.round(interval * easeFactor * 1.3));
    }
    easeFactor = Math.min(3.5, easeFactor + 0.15);
    repetitions += 1;
  }

  // Khi chọn "Học lại" (Rating 1), thẻ đến hạn ôn lại sau 10 phút (chuẩn relearning queue Anki)
  const nextReviewDate = rating === 1 ? now + 10 * 60 * 1000 : now + interval * ONE_DAY_MS;
  // Nếu khoảng cách ôn >= 21 ngày thì xem như đã thành thạo (Mastered)
  const status: 'learning' | 'mastered' = interval >= 21 ? 'mastered' : 'learning';

  return {
    interval,
    repetitions,
    easeFactor: Number(easeFactor.toFixed(2)),
    nextReviewDate,
    lastReviewedAt: now,
    status,
  };
}

/**
 * Hiển thị ước tính thời gian ôn tiếp theo trên 4 nút đánh giá
 */
export function formatNextReviewPreview(card: VocabNote, rating: SM2Rating): string {
  const sim = calculateSM2(card, rating);
  const days = sim.interval;

  if (rating === 1) {
    return '<10 phút';
  }
  if (days === 1) {
    return '1 ngày';
  }
  if (days < 7) {
    return `${days} ngày`;
  }
  if (days < 30) {
    const weeks = Math.round(days / 7);
    return `${weeks} tuần`;
  }
  const months = Math.round(days / 30);
  return `${months} tháng`;
}

/**
 * Kiểm tra xem thẻ đã đến hạn cần ôn tập hay chưa
 */
export function isCardDue(card: VocabNote): boolean {
  if (!card.nextReviewDate) return true;
  return card.nextReviewDate <= Date.now();
}

/**
 * Lọc danh sách thẻ đến hạn ôn tập
 */
export function getDueCards(cards: VocabNote[]): VocabNote[] {
  const now = Date.now();
  return cards.filter((c) => !c.nextReviewDate || c.nextReviewDate <= now);
}

/**
 * Thống kê tổng quan thẻ
 */
export function getDeckStats(cards: VocabNote[]) {
  const now = Date.now();
  let dueCount = 0;
  let learningCount = 0;
  let masteredCount = 0;

  for (const c of cards) {
    if (!c.nextReviewDate || c.nextReviewDate <= now) {
      dueCount++;
    }
    if (c.status === 'mastered') {
      masteredCount++;
    } else {
      learningCount++;
    }
  }

  return {
    total: cards.length,
    due: dueCount,
    learning: learningCount,
    mastered: masteredCount,
  };
}

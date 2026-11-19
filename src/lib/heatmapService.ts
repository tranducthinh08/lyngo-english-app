import { db, ReviewLog } from './db';

export interface HeatmapDay {
  date: Date;
  dateStr: string; // YYYY-MM-DD
  count: number;
  level: 0 | 1 | 2 | 3 | 4;
  isToday: boolean;
  isFuture: boolean;
  dayOfWeek: number; // 0 = Mon, ..., 6 = Sun
  month: number; // 0-11
}

export interface HeatmapWeek {
  weekIndex: number;
  days: (HeatmapDay | null)[];
}

export interface HeatmapStats {
  year: number;
  totalReviews: number;
  daysLearnedCount: number;
  daysLearnedPercent: number;
  dailyAverage: number;
  longestStreak: number;
  currentStreak: number;
  weeks: HeatmapWeek[];
  monthsLabels: { label: string; weekIndex: number }[];
}

function formatDateStr(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

/**
 * Ghi lại nhật ký mỗi khi Cô Ly ôn tập 1 từ vựng (chuẩn Anki)
 */
export async function recordReviewActivity(noteId: string, rating: number): Promise<void> {
  if (typeof window === 'undefined') return;
  const now = new Date();
  const dateStr = formatDateStr(now);

  const log: ReviewLog = {
    id: `rev-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
    noteId,
    rating,
    reviewedAt: Date.now(),
    dateStr,
  };

  try {
    await db.reviewLogs.add(log);
  } catch (err) {
    console.warn('Lỗi ghi review log:', err);
  }
}

/**
 * Tính toán toàn bộ ma trận Heatmap 52 tuần x 7 ngày và thống kê Streak chuẩn Anki
 */
export async function getHeatmapStats(targetYear?: number): Promise<HeatmapStats> {
  const now = new Date();
  const year = targetYear || now.getFullYear();
  const todayStr = formatDateStr(now);

  // 1. Tải tất cả review logs thực tế trong năm đó (loại bỏ dứt điểm log giả seed-log)
  const countsByDate = new Map<string, number>();

  try {
    if (typeof window !== 'undefined') {
      // Dọn dẹp sạch log ảo ngẫu nhiên nếu còn sót lại trong máy
      await db.reviewLogs.filter((log) => log.id.startsWith('seed-log-')).delete();

      const logs = await db.reviewLogs.toArray();
      for (const log of logs) {
        if (log.dateStr && log.dateStr.startsWith(String(year))) {
          countsByDate.set(log.dateStr, (countsByDate.get(log.dateStr) || 0) + 1);
        }
      }

      // Quét thêm ngày ôn gần nhất (lastReviewedAt) và ngày tạo từ (createdAt) thực tế từ bảng vocabNotes
      const notes = await db.vocabNotes.toArray();
      for (const note of notes) {
        if (note.lastReviewedAt) {
          const rDateStr = formatDateStr(new Date(note.lastReviewedAt));
          if (rDateStr.startsWith(String(year))) {
            if (!countsByDate.has(rDateStr)) {
              countsByDate.set(rDateStr, 1);
            }
          }
        }
        if (note.createdAt) {
          const cDateStr = formatDateStr(new Date(note.createdAt));
          if (cDateStr.startsWith(String(year))) {
            if (!countsByDate.has(cDateStr)) {
              countsByDate.set(cDateStr, 1);
            }
          }
        }
      }
    }
  } catch (err) {
    console.warn('Lỗi lấy review logs thực tế:', err);
  }

  // 2. Xây dựng lịch cả năm từ ngày 1/1 đến 31/12
  const startDate = new Date(year, 0, 1);
  const endDate = new Date(year, 11, 31);

  // Thứ 2 = 0, Thứ 3 = 1, ..., Chủ nhật = 6
  const getMondayIndex = (d: Date) => (d.getDay() + 6) % 7;

  // Lùi về Thứ 2 đầu tiên của tuần chứa ngày 1/1
  const firstMonday = new Date(startDate);
  const startDayOfWeek = getMondayIndex(startDate);
  firstMonday.setDate(firstMonday.getDate() - startDayOfWeek);

  const weeks: HeatmapWeek[] = [];
  const monthsLabels: { label: string; weekIndex: number }[] = [];
  let lastLabeledMonth = -1;

  const currentPointer = new Date(firstMonday);
  let weekIdx = 0;

  // Duyệt qua tất cả các tuần cho đến khi vượt qua ngày 31/12 và hết tuần đó
  while (currentPointer <= endDate || getMondayIndex(currentPointer) !== 0) {
    const weekDays: (HeatmapDay | null)[] = [];

    for (let dayIndex = 0; dayIndex < 7; dayIndex++) {
      const dayDate = new Date(currentPointer);
      const dayYear = dayDate.getFullYear();
      const dateStr = formatDateStr(dayDate);
      const isToday = dateStr === todayStr;
      const isFuture = dayDate > now;

      // Nhãn tháng: nếu là tuần đầu tiên chuyển sang tháng mới trong năm khảo sát
      if (dayYear === year && dayDate.getMonth() !== lastLabeledMonth && dayIndex === 0) {
        lastLabeledMonth = dayDate.getMonth();
        const monthNames = ['Th1', 'Th2', 'Th3', 'Th4', 'Th5', 'Th6', 'Th7', 'Th8', 'Th9', 'Th10', 'Th11', 'Th12'];
        monthsLabels.push({
          label: monthNames[lastLabeledMonth],
          weekIndex: weekIdx,
        });
      }

      if (dayYear !== year) {
        // Ngày thuộc năm trước hoặc năm sau (ô đệm)
        weekDays.push(null);
      } else {
        const count = countsByDate.get(dateStr) || 0;
        let level: 0 | 1 | 2 | 3 | 4 = 0;
        if (count >= 20) level = 4;
        else if (count >= 10) level = 3;
        else if (count >= 5) level = 2;
        else if (count >= 1) level = 1;

        weekDays.push({
          date: dayDate,
          dateStr,
          count,
          level,
          isToday,
          isFuture,
          dayOfWeek: dayIndex,
          month: dayDate.getMonth(),
        });
      }

      currentPointer.setDate(currentPointer.getDate() + 1);
    }

    weeks.push({
      weekIndex: weekIdx,
      days: weekDays,
    });
    weekIdx++;
  }

  // 3. Tính toán các chỉ số thống kê (Stats chuẩn Anki)
  let totalReviews = 0;
  let daysLearnedCount = 0;
  let longestStreak = 0;
  let tempStreak = 0;

  // Duyệt từ 1/1 đến hôm nay để tính streak và tỷ lệ
  const iterDate = new Date(year, 0, 1);
  const checkLimit = year === now.getFullYear() ? now : endDate;
  let elapsedDaysInYear = 0;

  while (iterDate <= checkLimit) {
    elapsedDaysInYear++;
    const dStr = formatDateStr(iterDate);
    const count = countsByDate.get(dStr) || 0;
    totalReviews += count;

    if (count > 0) {
      daysLearnedCount++;
      tempStreak++;
      if (tempStreak > longestStreak) {
        longestStreak = tempStreak;
      }
    } else {
      tempStreak = 0;
    }

    iterDate.setDate(iterDate.getDate() + 1);
  }

  // Tính Current Streak: đếm ngược từ hôm nay (hoặc hôm qua nếu hôm nay chưa học)
  let currentStreak = 0;
  const streakPointer = new Date(now);
  const todayCount = countsByDate.get(todayStr) || 0;

  if (todayCount > 0) {
    currentStreak++;
    streakPointer.setDate(streakPointer.getDate() - 1);
  } else {
    // Nếu hôm nay chưa học, kiểm tra xem hôm qua có học không
    streakPointer.setDate(streakPointer.getDate() - 1);
  }

  while (streakPointer >= new Date(year, 0, 1)) {
    const dStr = formatDateStr(streakPointer);
    const count = countsByDate.get(dStr) || 0;
    if (count > 0) {
      currentStreak++;
      streakPointer.setDate(streakPointer.getDate() - 1);
    } else {
      break;
    }
  }

  const daysLearnedPercent = elapsedDaysInYear > 0
    ? Math.round((daysLearnedCount / elapsedDaysInYear) * 100)
    : 0;

  const dailyAverage = daysLearnedCount > 0
    ? Math.round(totalReviews / daysLearnedCount)
    : 0;

  return {
    year,
    totalReviews,
    daysLearnedCount,
    daysLearnedPercent,
    dailyAverage,
    longestStreak,
    currentStreak,
    weeks,
    monthsLabels,
  };
}

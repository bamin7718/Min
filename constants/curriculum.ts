import type { Subject, SubjectWeekProgress, WeekStatus, WeekTopic } from '../types';
import { MATH_WEEKS } from './mathCurriculum';
import { VIETNAMESE_WEEKS } from './vietnameseCurriculum';

/**
 * Điểm truy cập chung cho mọi lộ trình theo tuần.
 *
 * Nhờ lớp này, màn hình học tập không phải rẽ nhánh theo từng môn — thêm lộ
 * trình cho môn mới chỉ cần khai báo thêm một dòng ở đây.
 */
const CURRICULUMS: Partial<Record<Subject, WeekTopic[]>> = {
  'Toán': MATH_WEEKS,
  'Tiếng Việt': VIETNAMESE_WEEKS,
  // Tiếng Anh chưa có lộ trình theo tuần: vẫn rút đề ngẫu nhiên như trước
};

/** Lộ trình của một môn, `null` nếu môn đó chưa tổ chức theo tuần */
export function getCurriculum(subject: Subject): WeekTopic[] | null {
  return CURRICULUMS[subject] ?? null;
}

export function hasCurriculum(subject: Subject): boolean {
  return getCurriculum(subject) !== null;
}

export function getCurriculumWeek(
  subject: Subject,
  weekNumber: number,
): WeekTopic | undefined {
  return getCurriculum(subject)?.find((week) => week.weekNumber === weekNumber);
}

/** Tổng số tuần của lộ trình, 0 nếu môn chưa có lộ trình */
export function totalWeeks(subject: Subject): number {
  return getCurriculum(subject)?.length ?? 0;
}

/**
 * Trạng thái một tuần dựa trên tiến độ của chính môn đó.
 * Tuần kế tiếp luôn được mở để học sinh học tiếp.
 */
export function weekStatusFor(
  subject: Subject,
  weekNumber: number,
  completedWeeks: SubjectWeekProgress,
): WeekStatus {
  const done = completedWeeks[subject] ?? 0;
  if (weekNumber <= done) return 'completed';
  if (weekNumber === done + 1) return 'current';
  return 'locked';
}

/** Các giai đoạn lớn của một lộ trình, kèm khoảng tuần */
export function getUnitsOf(subject: Subject): { unit: string; weeks: WeekTopic[] }[] {
  const weeks = getCurriculum(subject) ?? [];
  const groups: { unit: string; weeks: WeekTopic[] }[] = [];

  for (const week of weeks) {
    const last = groups[groups.length - 1];
    if (last && last.unit === week.unit) last.weeks.push(week);
    else groups.push({ unit: week.unit, weeks: [week] });
  }
  return groups;
}

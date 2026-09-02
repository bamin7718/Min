import {
  DEFAULT_GRADE,
  sanitizeGrade,
  weekKey,
  type Subject,
  type SubjectWeekProgress,
  type WeekStatus,
  type WeekTopic,
  type WeekTopicSeed,
} from '../types';
import { GRADE1_MATH_WEEKS, GRADE1_VIETNAMESE_WEEKS } from './grade1Curriculum';
import { GRADE2_MATH_WEEKS, GRADE2_VIETNAMESE_WEEKS } from './grade2Curriculum';
import { GRADE4_MATH_WEEKS, GRADE4_VIETNAMESE_WEEKS } from './grade4Curriculum';
import { GRADE5_MATH_WEEKS, GRADE5_VIETNAMESE_WEEKS } from './grade5Curriculum';
import { MATH_WEEKS } from './mathCurriculum';
import { VIETNAMESE_WEEKS } from './vietnameseCurriculum';

/**
 * Điểm truy cập chung cho mọi lộ trình theo tuần, tra theo **khối lớp và môn**.
 *
 * Nhờ lớp này, màn hình học tập không phải rẽ nhánh theo từng môn hay từng lớp —
 * thêm một lộ trình mới chỉ cần thêm một dòng vào `CURRICULUMS`.
 *
 * Khối lớp được thêm ở bản 1.0.9. Trước đó sổ đăng ký chỉ tra theo môn vì app chỉ
 * có nội dung Lớp 3; dữ liệu Lớp 3 được giữ **nguyên vẹn** và đăng ký lại ở khoá
 * `3`, nên tiến độ và `masteredQuestionIds` của học sinh cũ không đổi gì.
 */

/**
 * Gắn khối lớp cho từng tuần.
 *
 * Các tệp dữ liệu khai `WeekTopicSeed` (không có `grade`) và khối lớp được gắn
 * tại đúng chỗ đăng ký. Làm vậy vì hai lẽ: dữ liệu Lớp 3 nằm trong hai tệp hơn
 * 400 KB nên thêm một trường vào 70 mục là sửa rất nhiều chỗ, và quan trọng hơn
 * là một tuần không thể tự khai khối lớp lệch với chỗ nó được đăng ký.
 *
 * `.map()` chạy một lần lúc nạp module nên không ảnh hưởng gì tới lúc làm bài.
 */
function withGrade(grade: number, weeks: WeekTopicSeed[]): WeekTopic[] {
  return weeks.map((week) => ({ ...week, grade }));
}

const CURRICULUMS: Record<number, Partial<Record<Subject, WeekTopic[]>>> = {
  1: {
    'Toán': withGrade(1, GRADE1_MATH_WEEKS),
    'Tiếng Việt': withGrade(1, GRADE1_VIETNAMESE_WEEKS),
  },
  2: {
    'Toán': withGrade(2, GRADE2_MATH_WEEKS),
    'Tiếng Việt': withGrade(2, GRADE2_VIETNAMESE_WEEKS),
  },
  3: {
    'Toán': withGrade(3, MATH_WEEKS),
    'Tiếng Việt': withGrade(3, VIETNAMESE_WEEKS),
  },
  4: {
    'Toán': withGrade(4, GRADE4_MATH_WEEKS),
    'Tiếng Việt': withGrade(4, GRADE4_VIETNAMESE_WEEKS),
  },
  5: {
    'Toán': withGrade(5, GRADE5_MATH_WEEKS),
    'Tiếng Việt': withGrade(5, GRADE5_VIETNAMESE_WEEKS),
  },
  // Tiếng Anh chưa có lộ trình theo tuần ở bất kỳ lớp nào: vẫn rút đề ngẫu nhiên
};

/** Các khối lớp đã có nội dung, tăng dần */
export const GRADES_WITH_CONTENT: number[] = Object.keys(CURRICULUMS)
  .map(Number)
  .sort((a, b) => a - b);

/**
 * Khối lớp dùng để tra nội dung.
 *
 * Khối lớp trên hồ sơ có thể là 1-12, nhưng chỉ một phần trong đó có bài. Lớp
 * chưa có nội dung sẽ **quay về Lớp 3** — bộ đề đầy đủ nhất và cũng là nội dung
 * gốc của app. Trả về mảng rỗng thì màn hình Học Tập trống trơn, tệ hơn nhiều so
 * với việc học sinh Lớp 8 tạm làm đề Lớp 3.
 */
export function contentGradeFor(profileGrade: number): number {
  const grade = sanitizeGrade(profileGrade);
  return CURRICULUMS[grade] ? grade : DEFAULT_GRADE;
}

/** Khối lớp trên hồ sơ có nội dung riêng hay đang phải dùng nội dung lớp khác */
export function hasOwnContent(profileGrade: number): boolean {
  return CURRICULUMS[sanitizeGrade(profileGrade)] !== undefined;
}

/** Lộ trình của một môn trong một khối lớp, `null` nếu chưa tổ chức theo tuần */
export function getCurriculum(grade: number, subject: Subject): WeekTopic[] | null {
  return CURRICULUMS[contentGradeFor(grade)]?.[subject] ?? null;
}

export function hasCurriculum(grade: number, subject: Subject): boolean {
  return getCurriculum(grade, subject) !== null;
}

/** Các môn có lộ trình theo tuần ở khối lớp này */
export function subjectsWithCurriculum(grade: number): Subject[] {
  const byGrade = CURRICULUMS[contentGradeFor(grade)] ?? {};
  return (Object.keys(byGrade) as Subject[]).filter((subject) => byGrade[subject]);
}

/**
 * Môn KHÔNG gắn với khối lớp nào — tức không có lộ trình ở bất kỳ lớp nào đã
 * đăng ký, nên nó rút đề ngẫu nhiên từ một bộ đề dùng chung.
 *
 * Hiện chỉ có Tiếng Anh. Kiểm bằng cách quét sổ đăng ký thay vì so tên môn: mai
 * này soạn lộ trình Tiếng Anh cho một lớp nào đó thì môn ấy tự động được lọc
 * theo lớp, không phải sửa thêm chỗ nào.
 */
export function isGradeAgnosticSubject(subject: Subject): boolean {
  return !GRADES_WITH_CONTENT.some((grade) => CURRICULUMS[grade]?.[subject]);
}

/** Các môn nên hiện ở màn Học Tập cho khối lớp này */
export function subjectsForGrade(grade: number, all: Subject[]): Subject[] {
  const weekly = new Set(subjectsWithCurriculum(grade));
  return all.filter((subject) => weekly.has(subject) || isGradeAgnosticSubject(subject));
}

export function getCurriculumWeek(
  grade: number,
  subject: Subject,
  weekNumber: number,
): WeekTopic | undefined {
  return getCurriculum(grade, subject)?.find((week) => week.weekNumber === weekNumber);
}

/** Tổng số tuần của lộ trình, 0 nếu môn chưa có lộ trình */
export function totalWeeks(grade: number, subject: Subject): number {
  return getCurriculum(grade, subject)?.length ?? 0;
}

/**
 * Trạng thái một tuần dựa trên tiến độ của chính môn đó **trong chính khối lớp
 * đó**. Tuần kế tiếp luôn được mở để học sinh học tiếp.
 */
export function weekStatusFor(
  grade: number,
  subject: Subject,
  weekNumber: number,
  completedWeeks: SubjectWeekProgress,
): WeekStatus {
  const done = completedWeeks[weekKey(contentGradeFor(grade), subject)] ?? 0;
  if (weekNumber <= done) return 'completed';
  if (weekNumber === done + 1) return 'current';
  return 'locked';
}

/** Số tuần cao nhất đã hoàn thành của một môn trong một khối lớp */
export function completedWeeksOf(
  grade: number,
  subject: Subject,
  completedWeeks: SubjectWeekProgress,
): number {
  return completedWeeks[weekKey(contentGradeFor(grade), subject)] ?? 0;
}

/** Các giai đoạn lớn của một lộ trình, kèm khoảng tuần */
export function getUnitsOf(
  grade: number,
  subject: Subject,
): { unit: string; weeks: WeekTopic[] }[] {
  const weeks = getCurriculum(grade, subject) ?? [];
  const groups: { unit: string; weeks: WeekTopic[] }[] = [];

  for (const week of weeks) {
    const last = groups[groups.length - 1];
    if (last && last.unit === week.unit) last.weeks.push(week);
    else groups.push({ unit: week.unit, weeks: [week] });
  }
  return groups;
}

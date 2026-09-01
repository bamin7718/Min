import { getCurriculumWeek } from '../constants/curriculum';
import { shuffleQuestionOptions } from '../constants/mockData';
import type { Question, Subject } from '../types';

/**
 * Bộ sinh đề cho một tuần học.
 *
 * Mỗi tuần có một ngân hàng câu hỏi; mỗi lượt làm bài rút ngẫu nhiên một phần
 * và trộn lại thứ tự đáp án, để học sinh không học vẹt theo vị trí.
 */

/** Số câu mỗi đề */
export const QUESTIONS_PER_QUIZ = 10;

export interface QuizSession {
  subject: Subject;
  weekNumber: number;
  /**
   * Id các câu theo đúng thứ tự của đề.
   * Lưu lại để "Làm lại đề này" dựng đúng bộ câu đó, không rút đề khác.
   */
  questionIds: string[];
  /** Câu hỏi đã trộn sẵn thứ tự đáp án, sẵn sàng hiển thị */
  questions: Question[];
}

/** Trộn mảng (Fisher–Yates), không đụng vào mảng gốc */
function shuffle<T>(items: T[]): T[] {
  const result = [...items];
  for (let i = result.length - 1; i > 0; i -= 1) {
    const j = Math.floor(Math.random() * (i + 1));
    [result[i], result[j]] = [result[j], result[i]];
  }
  return result;
}

/** Toàn bộ ngân hàng câu hỏi của một tuần */
export function getWeekBank(subject: Subject, weekNumber: number): Question[] {
  return getCurriculumWeek(subject, weekNumber)?.questions ?? [];
}

/**
 * Rút một đề mới cho tuần: lấy ngẫu nhiên tối đa `QUESTIONS_PER_QUIZ` câu từ
 * ngân hàng của tuần rồi trộn thứ tự đáp án.
 *
 * Ưu tiên câu CHƯA từng trả lời đúng, để học sinh gặp kiến thức mới trước; khi
 * đã chinh phục hết mới quay lại các câu cũ.
 *
 * Ngân hàng nhỏ hơn 10 câu thì lấy hết — trả về ít câu hơn chứ không lặp câu.
 */
export function generateQuizForWeek(
  subject: Subject,
  weekNumber: number,
  masteredQuestionIds: string[] = [],
  count: number = QUESTIONS_PER_QUIZ,
): QuizSession | null {
  const bank = getWeekBank(subject, weekNumber);
  if (bank.length === 0) return null;

  const mastered = new Set(masteredQuestionIds);
  const fresh = shuffle(bank.filter((question) => !mastered.has(question.id)));
  const reviewed = shuffle(bank.filter((question) => mastered.has(question.id)));

  const picked = [...fresh, ...reviewed].slice(0, Math.min(count, bank.length));

  return {
    subject,
    weekNumber,
    questionIds: picked.map((question) => question.id),
    questions: picked.map(shuffleQuestionOptions),
  };
}

/**
 * Dựng lại ĐÚNG bộ câu hỏi của một đề đã làm.
 *
 * Giữ nguyên danh sách và thứ tự câu, nhưng **trộn lại thứ tự đáp án** — cùng
 * một câu mà đáp án đổi chỗ thì học sinh phải đọc lại chứ không nhớ "lần trước
 * bấm ô B".
 */
export function rebuildQuiz(session: QuizSession): QuizSession {
  const bank = getWeekBank(session.subject, session.weekNumber);
  const byId = new Map(bank.map((question) => [question.id, question]));

  const questions = session.questionIds
    .map((id) => byId.get(id))
    .filter((question): question is Question => question !== undefined)
    .map(shuffleQuestionOptions);

  return { ...session, questions };
}

/** Số câu trong ngân hàng của một tuần */
export function bankSize(subject: Subject, weekNumber: number): number {
  return getWeekBank(subject, weekNumber).length;
}

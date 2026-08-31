/**
 * Kiểu dữ liệu dùng chung cho toàn ứng dụng
 * "Học tập & Quản lý thời gian chơi game - Lớp 3"
 */

/** Các môn học của học sinh Lớp 3 được hỗ trợ */
export type Subject = 'Toán' | 'Tiếng Việt' | 'Tiếng Anh';

/** Thông tin hiển thị của một môn học trên màn hình chọn môn */
export interface SubjectInfo {
  key: Subject;
  /** Emoji minh hoạ, dễ nhận biết với học sinh 8 tuổi */
  emoji: string;
  /** Mô tả ngắn hiển thị trên thẻ môn học */
  description: string;
  /** Màu chủ đạo của thẻ môn học */
  color: string;
  /** Màu nền nhạt của thẻ môn học */
  softColor: string;
}

/** Một câu hỏi trắc nghiệm 4 lựa chọn */
export interface Question {
  id: string;
  subject: Subject;
  /** Nội dung câu hỏi */
  content: string;
  /** Đúng 4 lựa chọn, tương ứng A / B / C / D */
  options: [string, string, string, string];
  /** Chỉ số (0-3) của lựa chọn đúng trong `options` */
  correctAnswer: number;
  /** Số phút chơi game được cộng khi trả lời đúng */
  rewardMinutes: number;
  /** Lời giải thích ngắn, hiện ra sau khi học sinh trả lời */
  explanation?: string;
}

/** Kết quả một lần trả lời của học sinh */
export interface AnswerRecord {
  questionId: string;
  selectedAnswer: number;
  isCorrect: boolean;
  /** Điểm nhận được từ câu này */
  pointsEarned: number;
  /** Số phút chơi game nhận được từ câu này */
  minutesEarned: number;
}

/** Kết quả tổng kết của một bài test (một môn học) */
export interface QuizResult {
  id: string;
  subject: Subject;
  totalQuestions: number;
  correctCount: number;
  pointsEarned: number;
  minutesEarned: number;
  answers: AnswerRecord[];
  /** Thời điểm hoàn thành bài test, dạng ISO string */
  completedAt: string;
}

/** Tiến độ tích luỹ của học sinh (phần thưởng / ví thời gian chơi game) */
export interface UserProgress {
  /** Tổng điểm tích luỹ từ trước tới nay */
  totalPoints: number;
  /** Số phút chơi game còn khả dụng */
  accumulatedGameMinutes: number;
  /** Thời điểm cập nhật gần nhất, dạng ISO string */
  lastUpdated: string;
}

/**
 * Bản ghi được lưu xuống AsyncStorage.
 * Dùng giây thay vì phút để đồng hồ đếm ngược không bị mất số dư lẻ.
 */
export interface StoredProgress {
  version: 1;
  totalPoints: number;
  /** Số giây chơi game còn khả dụng (nguồn dữ liệu gốc) */
  availableSeconds: number;
  /** Danh sách id các câu đã từng trả lời đúng */
  masteredQuestionIds: string[];
  lastUpdated: string;
}

/**
 * Dữ liệu đồng bộ lên Supabase: `UserProgress` kèm danh sách câu đã chinh phục,
 * để quy tắc "câu đã đúng thì không cộng phút nữa" vẫn đúng trên máy khác.
 */
export interface ProgressSyncPayload extends UserProgress {
  masteredQuestionIds: string[];
}

/** Trạng thái đồng bộ hiển thị cho phụ huynh */
export type SyncState =
  /** Chưa cấu hình biến môi trường Supabase */
  | 'disabled'
  /** Đã cấu hình nhưng chưa đăng nhập */
  | 'signedOut'
  | 'syncing'
  | 'synced'
  | 'error';

/** Kết quả một lời gọi tới Supabase */
export type SyncResult<T> = { ok: true; data: T } | { ok: false; error: string };

/** Các trò chơi tích hợp trong Góc Game */
export type GameId = 'mario-mini' | 'color-sort';

/** Thông tin hiển thị của một trò chơi trên lưới Góc Game */
export interface GameInfo {
  id: GameId;
  name: string;
  emoji: string;
  description: string;
  color: string;
  softColor: string;
}

/** Danh sách các tab ở thanh điều hướng dưới cùng */
export type RootTabParamList = {
  HocTap: undefined;
  GocGame: undefined;
};

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
  /** Tuần Toán cao nhất đã vượt qua trong lộ trình 35 tuần (0 = chưa qua tuần nào) */
  highestCompletedWeek: number;
  lastUpdated: string;
}

/**
 * Dữ liệu đồng bộ lên Supabase: `UserProgress` kèm danh sách câu đã chinh phục,
 * để quy tắc "câu đã đúng thì không cộng phút nữa" vẫn đúng trên máy khác.
 */
export interface ProgressSyncPayload extends UserProgress {
  masteredQuestionIds: string[];
  /** Tuần Toán cao nhất đã vượt qua, để tiến độ lộ trình đồng bộ được */
  highestCompletedWeek: number;
}

/** Trạng thái đồng bộ hiển thị cho phụ huynh */
export type SyncState =
  /** Chưa cấu hình máy chủ đồng bộ */
  | 'disabled'
  /** Đã cấu hình nhưng chưa đăng nhập */
  | 'signedOut'
  /** Đã đăng nhập, chưa có gì cần đồng bộ */
  | 'idle'
  /** Mất mạng — thay đổi đang xếp trong hàng đợi ở Local */
  | 'offline'
  | 'syncing'
  | 'synced'
  | 'error';

/** Kết quả một lời gọi tới Supabase */
export type SyncResult<T> = { ok: true; data: T } | { ok: false; error: string };

/** Vai trò tài khoản */
export type UserRole = 'student' | 'parent';

/** Tài khoản đang đăng nhập, lưu trong AsyncStorage */
export interface SessionUser {
  userId: string;
  username: string;
  role: UserRole;
}

/** Phiên đăng nhập: thông tin user kèm token đã ký để server xác thực */
export interface AuthSession extends SessionUser {
  token: string;
}

/** Trạng thái của một tuần học trên màn hình chọn tuần */
export type WeekStatus = 'completed' | 'current' | 'locked';

/**
 * Một tuần trong lộ trình Toán Lớp 3 (35 tuần).
 * Xem dữ liệu tại `constants/mathCurriculum.ts`.
 */
export interface WeekTopic {
  /** Số tuần, từ 1 đến 35 */
  weekNumber: number;
  /** Tên bài học của tuần */
  title: string;
  /** Danh sách câu hỏi của tuần */
  questions: Question[];
  /** Giai đoạn lớn chứa tuần này, ví dụ "Các số đến 10 000" */
  unit: string;
  /** Độ khó 1-3, dùng để tính phút chơi game thưởng khi hoàn thành tuần */
  difficulty: 1 | 2 | 3;
}

/** Các trò chơi tích hợp trong Góc Game */
export type GameId = 'mario-mini' | 'color-sort' | 'penalty';

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

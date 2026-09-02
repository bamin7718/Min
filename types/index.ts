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
  /**
   * Đoạn văn ngắn hiển thị phía trên câu hỏi.
   * Dùng cho dạng bài Tập đọc — Hiểu văn bản của môn Tiếng Việt.
   */
  passage?: string;
  /** Nhãn dạng bài, ví dụ "Luyện từ và câu", để hiển thị cho học sinh */
  skill?: string;
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
  /**
   * `2` từ bản 1.0.8: thêm `answerStats`, `parentSettings`, `dailyUsage`.
   * Bản ghi `version: 1` vẫn đọc được — ba trường mới nhận giá trị mặc định.
   */
  version: 2;
  totalPoints: number;
  /** Số giây chơi game còn khả dụng (nguồn dữ liệu gốc) */
  availableSeconds: number;
  /** Danh sách id các câu đã từng trả lời đúng */
  masteredQuestionIds: string[];
  /** Tuần cao nhất đã vượt qua của từng môn */
  completedWeeks: SubjectWeekProgress;
  /** Số câu đã làm và số câu đúng, cho báo cáo của phụ huynh */
  answerStats: AnswerStats;
  /** Hạn mức và hệ số thưởng do phụ huynh đặt */
  parentSettings: ParentSettings;
  /** Số giây đã chơi trong ngày hôm nay */
  dailyUsage: DailyUsage;
  lastUpdated: string;
}

/**
 * Dữ liệu đồng bộ lên Turso DB: `UserProgress` kèm danh sách câu đã chinh phục,
 * để quy tắc "câu đã đúng thì không cộng phút nữa" vẫn đúng trên máy khác.
 */
export interface ProgressSyncPayload extends UserProgress {
  masteredQuestionIds: string[];
  /** Tuần cao nhất đã vượt qua của từng môn */
  completedWeeks: SubjectWeekProgress;
  /** Thống kê làm bài, để báo cáo giống nhau trên mọi thiết bị */
  answerStats: AnswerStats;
  /** Cấu hình của phụ huynh — đặt trên máy này thì máy khác cũng phải theo */
  parentSettings: ParentSettings;
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

/** Kết quả một lời gọi tới máy chủ đồng bộ (Turso DB qua api/*) */
export type SyncResult<T> =
  | { ok: true; data: T }
  | {
      ok: false;
      error: string;
      /**
       * `true` khi máy chủ trả lời nhưng KHÔNG có endpoint đó (vd server Metro
       * lúc `npx expo start` trả về trang HTML cho mọi đường dẫn). Khác hẳn lỗi
       * mạng: lúc đó app chuyển sang Local Mode chứ không báo "mất mạng".
       */
      endpointMissing?: true;
    };

/**
 * Vai trò tài khoản.
 *
 * Từ bản 1.0.8, màn hình Đăng ký KHÔNG còn cho chọn vai trò — mọi tài khoản mới
 * đều là `student`. Cột này vẫn giữ vì các tài khoản `parent` tạo từ bản cũ phải
 * đăng nhập được; nhưng quyền vào khu vực phụ huynh giờ dựa vào **mã PIN** chứ
 * không dựa vào vai trò nữa.
 */
export type UserRole = 'student' | 'parent';

/** Khối lớp nhỏ nhất / lớn nhất chọn được, và giá trị mặc định */
export const MIN_GRADE = 1;
export const MAX_GRADE = 12;
export const DEFAULT_GRADE = 3;

/** Ép khối lớp về khoảng 1-12 */
export function sanitizeGrade(raw: unknown): number {
  const value = Math.floor(Number(raw));
  if (!Number.isFinite(value)) return DEFAULT_GRADE;
  return Math.min(MAX_GRADE, Math.max(MIN_GRADE, value));
}

/**
 * Bộ avatar chọn được.
 *
 * Dùng emoji chứ không dùng ảnh: app chưa có tệp ảnh nhân vật nào, mà thêm ảnh
 * vào `assets/` sẽ làm bundle OTA phình lên. Emoji có sẵn trên mọi máy, hiện
 * đúng ở mọi cỡ và không tốn byte nào.
 */
export const AVATAR_CHOICES = [
  '🦊', '🐼', '🐯', '🐰', '🐧', '🐨',
  '🦁', '🐸', '🐙', '🦄', '🐳', '🦉',
] as const;

export const DEFAULT_AVATAR = AVATAR_CHOICES[0];

/** Avatar không nằm trong danh sách thì trả về avatar mặc định */
export function sanitizeAvatar(raw: unknown): string {
  return typeof raw === 'string' && (AVATAR_CHOICES as readonly string[]).includes(raw)
    ? raw
    : DEFAULT_AVATAR;
}

/** Tài khoản đang đăng nhập, lưu trong AsyncStorage */
export interface SessionUser {
  userId: string;
  /** Tên đăng nhập — là ID, KHÔNG đổi được sau khi tạo */
  username: string;
  /** Họ và tên, thứ hiện trên header và trong lời chào */
  displayName: string;
  /** Khối lớp 1-12. Chỉ là dữ liệu hồ sơ: nội dung câu hỏi vẫn là Lớp 3. */
  grade: number;
  /** Emoji avatar, lấy từ `AVATAR_CHOICES` */
  avatar: string;
  role: UserRole;
  /** Đã đặt mã PIN phụ huynh chưa — quyết định hiện "Nhập PIN" hay "Đặt PIN" */
  hasPin: boolean;
}

/** Phiên đăng nhập: thông tin user kèm token đã ký để server xác thực */
export interface AuthSession extends SessionUser {
  token: string;
}

/* ------------------------------------------------------------------ */
/* Cấu hình của phụ huynh                                              */
/* ------------------------------------------------------------------ */

export interface ParentSettings {
  /**
   * Trần số phút chơi game mỗi ngày. `0` = không giới hạn.
   *
   * Khác `MAX_ACCUMULATED_MINUTES` (trần cho ví thời gian): cái này giới hạn số
   * phút được TIÊU trong một ngày, nên con có tích được 120 phút thì vẫn không
   * chơi quá hạn mức ngày.
   */
  dailyLimitMinutes: number;
  /** Nhân số phút thưởng mỗi câu đúng. 1 = giữ nguyên như đề bài định. */
  rewardMultiplier: number;
}

export const DEFAULT_PARENT_SETTINGS: ParentSettings = {
  dailyLimitMinutes: 0,
  rewardMultiplier: 1,
};

/** Các mức nhân phút thưởng cho phụ huynh chọn */
export const REWARD_MULTIPLIER_CHOICES = [0.5, 1, 1.5, 2] as const;

export function sanitizeParentSettings(raw: unknown): ParentSettings {
  const source = (raw ?? {}) as Partial<ParentSettings>;
  const limit = Math.floor(Number(source.dailyLimitMinutes));
  const multiplier = Number(source.rewardMultiplier);
  return {
    dailyLimitMinutes:
      Number.isFinite(limit) && limit > 0 ? Math.min(600, limit) : 0,
    rewardMultiplier: (REWARD_MULTIPLIER_CHOICES as readonly number[]).includes(multiplier)
      ? multiplier
      : 1,
  };
}

/* ------------------------------------------------------------------ */
/* Thống kê làm bài                                                    */
/* ------------------------------------------------------------------ */

/**
 * Số câu đã trả lời và số câu đúng, tính dồn từ trước tới nay.
 *
 * Lưu hai con số này chứ không lưu số câu SAI: sai = đã trả lời − đúng, mà giữ
 * cả ba thì chỉ cần một lần cộng lệch là ba số tự mâu thuẫn nhau.
 *
 * Trước bản này app chỉ lưu `masteredQuestionIds` (id câu đã đúng), không hề
 * đếm câu sai — nên báo cáo chỉ có dữ liệu từ bản 1.0.8 trở đi.
 */
export interface AnswerStats {
  answered: number;
  correct: number;
}

export const EMPTY_ANSWER_STATS: AnswerStats = { answered: 0, correct: 0 };

export function sanitizeAnswerStats(raw: unknown): AnswerStats {
  const source = (raw ?? {}) as Partial<AnswerStats>;
  const answered = Math.max(0, Math.floor(Number(source.answered) || 0));
  const correct = Math.max(0, Math.floor(Number(source.correct) || 0));
  // Đúng không thể nhiều hơn đã trả lời — dữ liệu hỏng thì kẹp lại
  return { answered, correct: Math.min(correct, answered) };
}

/** Số giây đã chơi trong MỘT ngày, để áp hạn mức ngày của phụ huynh */
export interface DailyUsage {
  /** Ngày theo giờ địa phương, dạng `YYYY-MM-DD` */
  day: string;
  secondsPlayed: number;
}

export function todayKey(now: Date): string {
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())}`;
}

export function sanitizeDailyUsage(raw: unknown, now: Date): DailyUsage {
  const source = (raw ?? {}) as Partial<DailyUsage>;
  const today = todayKey(now);
  // Bản ghi của ngày khác thì bỏ, hạn mức được tính lại từ đầu mỗi ngày
  if (typeof source.day !== 'string' || source.day !== today) {
    return { day: today, secondsPlayed: 0 };
  }
  const seconds = Number(source.secondsPlayed);
  return { day: today, secondsPlayed: Number.isFinite(seconds) ? Math.max(0, seconds) : 0 };
}

/**
 * Tuần cao nhất đã vượt qua, khoá theo **`"<khối lớp>:<môn>"`** — ví dụ
 * `{"3:Toán": 9, "2:Tiếng Việt": 4}`.
 *
 * Trước bản 1.0.9 khoá chỉ là tên môn (`{"Toán": 9}`). Phải thêm khối lớp vì mỗi
 * lớp có lộ trình riêng: nếu giữ khoá cũ thì bé đang ở tuần 5 của Lớp 2 mà phụ
 * huynh sửa hồ sơ sang Lớp 3 sẽ được coi như đã qua tuần 5 của Lớp 3 — nhảy mất
 * bốn tuần đầu của một chương trình hoàn toàn khác.
 *
 * `Record<string, number>` chứ không phải kiểu khoá chặt: khối lớp là số 1-12
 * nên tổ hợp khoá là mở, mà TypeScript không kiểm được nội dung chuỗi ở runtime
 * nên kiểu chặt chỉ tạo cảm giác an toàn giả.
 */
export type SubjectWeekProgress = Record<string, number>;

/** Khoá tiến độ của một môn trong một khối lớp */
export function weekKey(grade: number, subject: Subject): string {
  return `${sanitizeGrade(grade)}:${subject}`;
}

/** Giá trị khởi tạo: chưa lớp nào, môn nào qua tuần nào */
export const EMPTY_WEEK_PROGRESS: SubjectWeekProgress = {};

/**
 * Trần số tuần dùng cho các hàm sanitize dùng chung.
 *
 * Lỏng hơn số tuần thật của từng lộ trình (Lớp 3 có 35 tuần, các lớp khác đang
 * có 6). Cố ý: `types/` không import `constants/curriculum` được — curriculum đã
 * import types nên sẽ thành phụ thuộc vòng. Chỗ kẹp CHÍNH XÁC theo từng lộ trình
 * nằm ở `PlaytimeContext`, nơi đã có sẵn `totalWeeks`.
 */
export const MAX_CURRICULUM_WEEKS = 40;

const SUBJECT_NAMES: readonly string[] = ['Toán', 'Tiếng Việt', 'Tiếng Anh'];

/**
 * Đọc map tiến độ tuần từ dữ liệu ngoài (AsyncStorage, database, body request)
 * và **nâng cấp khoá cũ** sang dạng có khối lớp.
 *
 * Khoá cũ là tên môn trần (`"Toán"`). Mọi dữ liệu tạo trước bản 1.0.9 đều là của
 * Lớp 3 — app khi đó chỉ có nội dung Lớp 3 — nên chuyển thẳng thành `"3:Toán"`.
 * Khoá đã đúng dạng mới thì giữ nguyên.
 *
 * Khai ở đây, một chỗ duy nhất, vì trước đó có tới BỐN bản sao gần giống nhau
 * (storage, turso, api/progress, PlaytimeContext) — thêm khối lớp mà phải sửa
 * đúng cả bốn là kiểu lỗi chỉ lộ ra ở một trong bốn đường đọc dữ liệu.
 */
export function sanitizeWeekProgress(raw: unknown): SubjectWeekProgress {
  if (typeof raw !== 'object' || raw === null) return {};

  const result: SubjectWeekProgress = {};
  for (const [rawKey, rawValue] of Object.entries(raw as Record<string, unknown>)) {
    const value = Number(rawValue);
    if (!Number.isFinite(value)) continue;
    const week = Math.min(MAX_CURRICULUM_WEEKS, Math.max(0, Math.floor(value)));
    if (week === 0) continue; // 0 là mặc định, không cần lưu

    // Khoá cũ: chỉ có tên môn → coi là của Lớp 3
    if (SUBJECT_NAMES.includes(rawKey)) {
      result[`3:${rawKey}`] = Math.max(result[`3:${rawKey}`] ?? 0, week);
      continue;
    }

    // Khoá mới: "<số>:<tên môn>"
    const separator = rawKey.indexOf(':');
    if (separator <= 0) continue;
    const grade = Number(rawKey.slice(0, separator));
    const subject = rawKey.slice(separator + 1);
    if (!Number.isInteger(grade) || !SUBJECT_NAMES.includes(subject)) continue;

    const key = `${sanitizeGrade(grade)}:${subject}`;
    result[key] = Math.max(result[key] ?? 0, week);
  }
  return result;
}

/** Trạng thái của một tuần học trên màn hình chọn tuần */
export type WeekStatus = 'completed' | 'current' | 'locked';

/**
 * Một tuần học, như nó được KHAI trong các tệp dữ liệu lộ trình.
 *
 * Không có `grade`: khối lớp do `constants/curriculum.ts` gắn vào khi dựng sổ
 * đăng ký. Nếu bắt mỗi tuần tự khai `grade` thì 70 mục của Lớp 3 (trong hai tệp
 * tổng cộng hơn 400 KB) đều phải sửa, và từ đó trở đi mỗi mục mang một con số có
 * thể lệch với chỗ nó được đăng ký.
 */
export interface WeekTopicSeed {
  /** Môn học của lộ trình chứa tuần này */
  subject: Subject;
  /** Số tuần, tính từ 1 */
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

/** Một tuần học kèm khối lớp mà nó thuộc về — dạng dùng trong toàn app */
export interface WeekTopic extends WeekTopicSeed {
  /** Khối lớp 1-12 của lộ trình chứa tuần này */
  grade: number;
}

/** Các trò chơi tích hợp trong Góc Game */
export type GameId =
  | 'mario-mini'
  | 'color-sort'
  | 'penalty'
  | 'zombie'
  | 'racing';

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
  CaiDat: undefined;
};

import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react';
import { AppState, type AppStateStatus } from 'react-native';

import {
  MAX_ACCUMULATED_MINUTES,
  POINTS_PER_CORRECT,
  REPEAT_ANSWER_GIVES_MINUTES,
  REPEAT_ANSWER_GIVES_POINTS,
} from '../constants/mockData';
import { totalWeeks } from '../constants/curriculum';
import { weekBonusMinutes, weekPassThreshold } from '../constants/mathCurriculum';
import { isApiConfigured } from '../lib/authApi';
import {
  readLocalProgress,
  resolveConflict,
  writeLocalProgress,
} from '../lib/storage';
import { syncEngine, type EngineState } from '../lib/syncEngine';
import {
  DEFAULT_PARENT_SETTINGS,
  EMPTY_ANSWER_STATS,
  EMPTY_WEEK_PROGRESS,
  sanitizeAnswerStats,
  sanitizeDailyUsage,
  sanitizeParentSettings,
  sanitizeWeekProgress,
  todayKey,
  weekKey,
  type AnswerStats,
  type DailyUsage,
  type ParentSettings,
  type ProgressSyncPayload,
  type Question,
  type StoredProgress,
  type Subject,
  type SubjectWeekProgress,
  type SyncState,
  type SessionUser,
  type UserProgress,
  type WeekTopic,
} from '../types';
import { useAuth } from './AuthContext';

const MAX_ACCUMULATED_SECONDS = MAX_ACCUMULATED_MINUTES * 60;

/**
 * Khoảng cách tối thiểu giữa hai lần đẩy dữ liệu lên Turso DB.
 * Trong lúc đồng hồ chạy, tiến độ đổi mỗi giây nên cần throttle thay vì debounce
 * (debounce sẽ không bao giờ kịp chạy).
 */
const PUSH_THROTTLE_MS = 15_000;

/** Kết quả trả về khi học sinh trả lời một câu hỏi */
export interface RewardOutcome {
  isCorrect: boolean;
  pointsEarned: number;
  minutesEarned: number;
  /** `true` khi câu này đã từng trả lời đúng nên không cộng thêm phút */
  alreadyMastered: boolean;
}

/** Kết quả sau khi làm xong một tuần Toán */
export interface WeekOutcome {
  /** Đủ số câu đúng để vượt qua tuần hay chưa */
  passed: boolean;
  /** Số câu đúng cần có để qua tuần */
  required: number;
  /** Phút chơi game thưởng thêm (chỉ có ở lần đầu vượt qua tuần) */
  bonusMinutes: number;
  /** Tuần vừa được mở khoá, `null` nếu không mở thêm tuần nào */
  unlockedWeek: number | null;
}

interface PlaytimeContextValue {
  /** Tài khoản đang đăng nhập; `null` nghĩa là chưa đăng nhập */
  currentUser: SessionUser | null;
  /** `false` khi còn đang đọc dữ liệu từ AsyncStorage */
  hydrated: boolean;
  totalPoints: number;
  /** Số giây chơi game khả dụng (nguồn dữ liệu gốc) */
  availableSeconds: number;
  /** Số phút chơi game khả dụng (làm tròn xuống) */
  availableMinutes: number;
  /** Đồng hồ đếm ngược đang chạy hay không */
  isPlaying: boolean;
  /** `true` khi đã hết thời gian chơi game → khoá màn hình Góc Game */
  isLocked: boolean;
  /** Id các câu đã từng trả lời đúng */
  masteredQuestionIds: string[];
  /** Tuần cao nhất đã vượt qua của từng môn (0 = chưa qua tuần nào) */
  completedWeeks: SubjectWeekProgress;
  /** Số câu đã làm và số câu đúng — nguồn của báo cáo trong Cài đặt */
  answerStats: AnswerStats;
  /** Hạn mức ngày và hệ số thưởng do phụ huynh đặt */
  parentSettings: ParentSettings;
  /** Số giây còn được chơi trong hôm nay. `Infinity` khi không đặt hạn mức. */
  remainingTodaySeconds: number;
  /** `true` khi đã dùng hết hạn mức của ngày hôm nay */
  dailyLimitReached: boolean;
  /** Tiến độ ở dạng công khai, dùng để đồng bộ lên Turso DB */
  progress: UserProgress;

  /** Ghi nhận câu trả lời, cộng điểm và quy đổi ra phút chơi game */
  submitAnswer: (question: Question, selectedAnswer: number) => RewardOutcome;
  startPlaying: () => void;
  pausePlaying: () => void;
  /** Ghi nhận kết quả một tuần: mở tuần kế tiếp và cộng phút thưởng */
  completeWeek: (
    week: WeekTopic,
    correctCount: number,
    totalQuestions: number,
  ) => WeekOutcome;
  /**
   * Cộng thêm phút chơi game.
   *
   * KHÔNG nhận mã PIN: việc xác thực PIN do `AuthContext.verifyPin` làm ở
   * server. Màn hình gọi hàm này phải tự đảm bảo đã mở khoá trước.
   */
  grantMinutesByParent: (minutes: number) => boolean;
  /** Lưu cấu hình của phụ huynh (hạn mức ngày, hệ số phút thưởng) */
  saveParentSettings: (settings: ParentSettings) => void;
  /** Xoá toàn bộ tiến độ của tài khoản hiện tại */
  resetProgress: () => boolean;

  // ----- Đồng bộ Turso DB -----
  syncState: SyncState;
  syncError: string | null;
  /** Thiết bị có mạng hay không (theo NetInfo) */
  isOnline: boolean;
  /** Số thay đổi còn chờ đẩy lên server */
  pendingChanges: number;
  /** Thời điểm đồng bộ thành công gần nhất, dạng ISO string */
  lastSyncedAt: string | null;
  /** Đồng bộ ngay lập tức (nút bấm thủ công của phụ huynh) */
  syncNow: () => Promise<void>;
}

const PlaytimeContext = createContext<PlaytimeContextValue | null>(null);

/**
 * Ép map tiến độ về khoảng hợp lệ.
 *
 * `sanitizeWeekProgress` lo phần dạng khoá (và nâng khoá cũ lên dạng có khối
 * lớp); ở đây kẹp thêm theo **số tuần thật của từng lộ trình**, việc mà hàm dùng
 * chung trong `types/` không làm được vì nó không được phép import curriculum.
 * Nhờ bước này, một bản ghi ghi "tuần 20" cho Lớp 1 (chỉ có 6 tuần) sẽ bị đưa về
 * 6 thay vì mở khoá những tuần không tồn tại.
 */
function sanitizeWeeks(raw: unknown): SubjectWeekProgress {
  const cleaned = sanitizeWeekProgress(raw);
  const result: SubjectWeekProgress = {};

  for (const [key, value] of Object.entries(cleaned)) {
    const separator = key.indexOf(':');
    const grade = Number(key.slice(0, separator));
    const subject = key.slice(separator + 1) as Subject;
    const max = totalWeeks(grade, subject);
    // Môn không có lộ trình ở lớp đó thì bỏ hẳn khoá, không giữ số vô nghĩa
    if (max === 0) continue;
    result[key] = Math.min(max, value);
  }
  return result;
}

function clampSeconds(value: number): number {
  if (!Number.isFinite(value)) return 0;
  return Math.min(Math.max(value, 0), MAX_ACCUMULATED_SECONDS);
}

/** So sánh hai mốc thời gian ISO. Turso DB trả về "+00:00" còn `Date` trả "Z". */
function isNewer(candidate: string, reference: string): boolean {
  const a = Date.parse(candidate);
  const b = Date.parse(reference);
  if (Number.isNaN(a) || Number.isNaN(b)) return false;
  return a > b;
}

export function PlaytimeProvider({ children }: { children: React.ReactNode }) {
  const { isConfigured, session } = useAuth();

  /**
   * Tài khoản đang đăng nhập. Mọi dữ liệu — cả trong AsyncStorage lẫn trên
   * Turso — đều tách riêng theo id này.
   */
  const currentUserId = session?.userId ?? null;

  /** Token phiên, dùng cho sync engine */
  const sessionToken = session?.token ?? null;

  const [hydrated, setHydrated] = useState(false);
  const [totalPoints, setTotalPoints] = useState(0);
  const [availableSeconds, setAvailableSeconds] = useState(0);
  const [masteredQuestionIds, setMasteredQuestionIds] = useState<string[]>([]);
  const [completedWeeks, setCompletedWeeks] = useState<SubjectWeekProgress>(
    EMPTY_WEEK_PROGRESS,
  );
  const [answerStats, setAnswerStats] = useState<AnswerStats>(EMPTY_ANSWER_STATS);
  const [parentSettings, setParentSettings] = useState<ParentSettings>(
    DEFAULT_PARENT_SETTINGS,
  );
  /**
   * Số giây đã chơi trong ngày hôm nay.
   *
   * KHÔNG đồng bộ lên server, khác ba trường trên. Tiến độ được đẩy lên dưới
   * dạng ảnh chụp toàn phần với luật "mốc mới nhất thắng", nên nếu đồng bộ thì
   * hai máy chơi song song sẽ liên tục ghi đè số giây của nhau và hạn mức ngày
   * thành ra vô nghĩa. Đánh đổi đã biết: hạn mức tính riêng cho từng máy, con
   * đổi sang máy khác là được thêm một hạn mức nữa.
   */
  const [dailyUsage, setDailyUsage] = useState<DailyUsage>(() =>
    sanitizeDailyUsage(null, new Date()),
  );
  const [isPlaying, setIsPlaying] = useState(false);

  /**
   * Mốc cập nhật của dữ liệu cục bộ. `null` = máy này chưa từng lưu gì
   * (mới cài), khi đó dữ liệu trên Turso DB luôn được ưu tiên.
   */
  const [lastUpdated, setLastUpdated] = useState<string | null>(null);

  const [syncState, setSyncState] = useState<SyncState>('disabled');
  const [syncError, setSyncError] = useState<string | null>(null);
  const [lastSyncedAt, setLastSyncedAt] = useState<string | null>(null);
  const [isOnline, setIsOnline] = useState(true);
  const [pendingChanges, setPendingChanges] = useState(0);

  /** Bản sao state để các hàm async đọc giá trị mới nhất mà không bị stale */
  const stateRef = useRef({
    totalPoints,
    availableSeconds,
    masteredQuestionIds,
    completedWeeks,
    answerStats,
    parentSettings,
    lastUpdated,
  });
  stateRef.current = {
    totalPoints,
    availableSeconds,
    masteredQuestionIds,
    completedWeeks,
    answerStats,
    parentSettings,
    lastUpdated,
  };

  /** Đánh dấu dữ liệu vừa thay đổi */
  const touch = useCallback(() => setLastUpdated(new Date().toISOString()), []);

  // ----- Đọc dữ liệu của tài khoản hiện tại; đổi tài khoản thì tải lại -----
  useEffect(() => {
    let cancelled = false;

    // Chưa đăng nhập: không có dữ liệu nào để hiển thị
    /** Đưa mọi state về mặc định — dùng cho cả lúc đăng xuất và lúc đổi tài khoản */
    const clearAll = () => {
      setHydrated(false);
      setTotalPoints(0);
      setAvailableSeconds(0);
      setMasteredQuestionIds([]);
      setCompletedWeeks(EMPTY_WEEK_PROGRESS);
      setAnswerStats(EMPTY_ANSWER_STATS);
      setParentSettings(DEFAULT_PARENT_SETTINGS);
      setDailyUsage(sanitizeDailyUsage(null, new Date()));
      setLastUpdated(null);
      setIsPlaying(false);
    };

    if (!currentUserId) {
      clearAll();
      return;
    }

    // Xoá sạch state của tài khoản trước rồi mới nạp tài khoản mới,
    // để không có khoảnh khắc nào hiện điểm/giờ của người khác.
    clearAll();

    (async () => {
      try {
        // Đọc thẳng từ Local: chỉ vài ms, không gọi mạng
        const saved = await readLocalProgress(currentUserId);
        if (!cancelled && saved) {
          setTotalPoints(saved.totalPoints);
          setAvailableSeconds(clampSeconds(saved.availableSeconds));
          setMasteredQuestionIds(saved.masteredQuestionIds);
          setCompletedWeeks(sanitizeWeeks(saved.completedWeeks));
          setAnswerStats(sanitizeAnswerStats(saved.answerStats));
          setParentSettings(sanitizeParentSettings(saved.parentSettings));
          // Bản ghi của ngày hôm qua bị bỏ, hạn mức tính lại từ đầu mỗi ngày
          setDailyUsage(sanitizeDailyUsage(saved.dailyUsage, new Date()));
          setLastUpdated(saved.lastUpdated);
        }
      } catch (error) {
        console.warn('[playtime] Không đọc được tiến độ đã lưu:', error);
      } finally {
        if (!cancelled) setHydrated(true);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [currentUserId]);

  // ----- Lưu dữ liệu mỗi khi tiến độ thay đổi (có debounce) -----
  useEffect(() => {
    if (!hydrated || lastUpdated === null || !currentUserId) return;

    const timeoutId = setTimeout(() => {
      const snapshot: StoredProgress = {
        version: 2,
        totalPoints,
        availableSeconds,
        masteredQuestionIds,
        completedWeeks,
        answerStats,
        parentSettings,
        dailyUsage,
        lastUpdated,
      };

      // 1) Ghi Local trước — đây mới là nơi dữ liệu được coi là đã lưu
      void writeLocalProgress(currentUserId, snapshot);

      // 2) Xếp vào hàng đợi để engine đẩy lên server sau. Không await, nên
      //    dù đang offline UI cũng không hề chờ.
      //    `dailyUsage` KHÔNG có trong payload — xem ghi chú ở chỗ khai state.
      if (isApiConfigured && sessionToken) {
        syncEngine.queueProgress(currentUserId, sessionToken, {
          totalPoints,
          accumulatedGameMinutes: Math.floor(availableSeconds / 60),
          masteredQuestionIds,
          completedWeeks,
          answerStats,
          parentSettings,
          lastUpdated,
        });
      }
    }, 600);

    return () => clearTimeout(timeoutId);
  }, [
    hydrated,
    totalPoints,
    availableSeconds,
    masteredQuestionIds,
    completedWeeks,
    answerStats,
    parentSettings,
    dailyUsage,
    lastUpdated,
    currentUserId,
    sessionToken,
  ]);

  // ----- Đồng hồ đếm ngược -----
  // Dùng mốc thời gian thực (Date.now) để không bị lệch khi timer bị điều tiết.
  const lastTickRef = useRef<number>(Date.now());

  useEffect(() => {
    if (!isPlaying) return;

    lastTickRef.current = Date.now();
    // Nhịp 1 giây: đủ mượt cho đồng hồ, đồng thời để effect lưu trữ bên trên
    // (debounce 600ms) vẫn kịp chạy giữa hai lần cập nhật.
    const intervalId = setInterval(() => {
      const now = Date.now();
      const elapsed = (now - lastTickRef.current) / 1000;
      lastTickRef.current = now;
      setAvailableSeconds((prev) => Math.max(0, prev - elapsed));

      // Cùng số giây đó cũng được tính vào hạn mức của ngày hôm nay
      setDailyUsage((prev) => {
        const today = todayKey(new Date(now));
        // Chơi qua nửa đêm: sang ngày mới thì hạn mức tính lại từ 0
        return prev.day === today
          ? { day: today, secondsPlayed: prev.secondsPlayed + elapsed }
          : { day: today, secondsPlayed: elapsed };
      });
      touch();
    }, 1000);

    return () => clearInterval(intervalId);
  }, [isPlaying, touch]);

  /** Trần giây của ngày. `Infinity` khi phụ huynh không đặt hạn mức. */
  const dailyLimitSeconds =
    parentSettings.dailyLimitMinutes > 0
      ? parentSettings.dailyLimitMinutes * 60
      : Number.POSITIVE_INFINITY;

  const remainingTodaySeconds = Math.max(0, dailyLimitSeconds - dailyUsage.secondsPlayed);
  const dailyLimitReached = remainingTodaySeconds <= 0;

  // Hết ví thời gian HOẶC hết hạn mức ngày → tự động dừng và khoá
  useEffect(() => {
    if (isPlaying && (availableSeconds <= 0 || dailyLimitReached)) {
      setIsPlaying(false);
    }
  }, [isPlaying, availableSeconds, dailyLimitReached]);

  // Rời khỏi ứng dụng thì tạm dừng để không "cháy" thời gian oan.
  useEffect(() => {
    const subscription = AppState.addEventListener(
      'change',
      (nextState: AppStateStatus) => {
        if (nextState !== 'active') {
          setIsPlaying(false);
        }
      },
    );
    return () => subscription.remove();
  }, []);

  /* ---------------------------------------------------------------- */
  /* Đồng bộ ngầm qua Sync Engine                                      */
  /* ---------------------------------------------------------------- */

  // Khởi động engine một lần cho cả app; nó tự lắng nghe NetInfo
  useEffect(() => {
    syncEngine.start();
    const unsubscribe = syncEngine.subscribe((engine: EngineState) => {
      setIsOnline(engine.online);
      setPendingChanges(engine.pending);
      setSyncError(engine.error);
      setLastSyncedAt(engine.lastSyncedAt);
      setSyncState(
        !isApiConfigured
          ? 'disabled'
          : engine.status === 'offline'
            ? 'offline'
            : engine.status === 'syncing'
              ? 'syncing'
              : engine.status === 'error'
                ? 'error'
                : engine.status === 'synced'
                  ? 'synced'
                  : 'idle',
      );
    });
    return unsubscribe;
  }, []);

  /**
   * Tải dữ liệu server rồi hợp nhất — chạy NGẦM, không chặn UI.
   * UI đã hiển thị dữ liệu Local từ trước đó vài ms.
   */
  const pullAndMerge = useCallback(async (token: string) => {
    const result = await syncEngine.pull(token);
    if (!result.ok || !result.data) return;

    const remote = result.data;
    const winner = resolveConflict(stateRef.current.lastUpdated, remote.lastUpdated);

    // Local mới hơn thì giữ nguyên; hàng đợi sẽ tự đẩy bản Local lên
    if (winner === 'local') return;

    setIsPlaying(false);
    setTotalPoints(Math.max(0, Math.floor(remote.totalPoints)));
    setAvailableSeconds(clampSeconds(remote.accumulatedGameMinutes * 60));
    setMasteredQuestionIds(remote.masteredQuestionIds);
    setCompletedWeeks(sanitizeWeeks(remote.completedWeeks));
    setAnswerStats(sanitizeAnswerStats(remote.answerStats));
    setParentSettings(sanitizeParentSettings(remote.parentSettings));
    setLastUpdated(remote.lastUpdated);
  }, []);

  // Đăng nhập / đổi tài khoản → kéo dữ liệu về, nhưng không chờ
  useEffect(() => {
    if (!isApiConfigured) {
      setSyncState('disabled');
      return;
    }
    if (!sessionToken) {
      setSyncState('signedOut');
      return;
    }
    if (!hydrated) return;

    void pullAndMerge(sessionToken);
  }, [sessionToken, hydrated, pullAndMerge]);

  const syncNow = useCallback(async () => {
    if (!isApiConfigured || !sessionToken) return;
    await syncEngine.flush();
    await pullAndMerge(sessionToken);
  }, [sessionToken, pullAndMerge]);

  /* ---------------------------------------------------------------- */
  /* Hành động                                                         */
  /* ---------------------------------------------------------------- */

  const submitAnswer = useCallback(
    (question: Question, selectedAnswer: number): RewardOutcome => {
      const isCorrect = selectedAnswer === question.correctAnswer;

      // Đếm MỌI câu đã trả lời, kể cả câu sai và câu làm lại: đây là nguồn duy
      // nhất cho báo cáo "đúng / sai" của phụ huynh. `masteredQuestionIds` không
      // dùng được vì nó chỉ giữ id câu đã đúng, không biết gì về câu sai.
      setAnswerStats((prev) => ({
        answered: prev.answered + 1,
        correct: prev.correct + (isCorrect ? 1 : 0),
      }));

      if (!isCorrect) {
        touch();
        return {
          isCorrect: false,
          pointsEarned: 0,
          minutesEarned: 0,
          alreadyMastered: false,
        };
      }

      const alreadyMastered = masteredQuestionIds.includes(question.id);
      const baseMinutes =
        alreadyMastered && !REPEAT_ANSWER_GIVES_MINUTES ? 0 : question.rewardMinutes;
      // Hệ số phụ huynh đặt. Làm tròn xuống để không bao giờ tặng thêm phút do
      // số lẻ, giống cách `availableMinutes` dùng `floor`.
      const minutesEarned = Math.floor(baseMinutes * parentSettings.rewardMultiplier);
      // Chỉ câu đúng LẦN ĐẦU mới sinh phần thưởng
      const pointsEarned =
        alreadyMastered && !REPEAT_ANSWER_GIVES_POINTS ? 0 : POINTS_PER_CORRECT;

      if (pointsEarned > 0) setTotalPoints((prev) => prev + pointsEarned);
      if (minutesEarned > 0) {
        setAvailableSeconds((prev) => clampSeconds(prev + minutesEarned * 60));
      }
      if (!alreadyMastered) {
        setMasteredQuestionIds((prev) => [...prev, question.id]);
      }
      touch();

      return { isCorrect: true, pointsEarned, minutesEarned, alreadyMastered };
    },
    [masteredQuestionIds, parentSettings.rewardMultiplier, touch],
  );

  const startPlaying = useCallback(() => {
    // Cần cả hai: còn thời gian trong ví VÀ chưa hết hạn mức của ngày hôm nay
    if (availableSeconds > 0 && !dailyLimitReached) setIsPlaying(true);
  }, [availableSeconds, dailyLimitReached]);

  const pausePlaying = useCallback(() => setIsPlaying(false), []);

  const completeWeek = useCallback(
    (week: WeekTopic, correctCount: number, totalQuestions: number): WeekOutcome => {
      const required = weekPassThreshold(totalQuestions);
      const passed = correctCount >= required;

      if (!passed) {
        return { passed: false, required, bonusMinutes: 0, unlockedWeek: null };
      }

      // Chỉ thưởng và mở khoá ở lần ĐẦU vượt qua tuần, để làm lại tuần cũ
      // không thể cộng phút chơi game vô hạn.
      //
      // Khoá gồm cả khối lớp: tuần 3 của Lớp 2 và tuần 3 của Lớp 5 là hai bài
      // hoàn toàn khác nhau, dùng chung một khoá thì qua bài này lại mở bài kia.
      const key = weekKey(week.grade, week.subject);
      const done = completedWeeks[key] ?? 0;
      const isFirstTime = week.weekNumber > done;
      if (!isFirstTime) {
        return { passed: true, required, bonusMinutes: 0, unlockedWeek: null };
      }

      const bonusMinutes = weekBonusMinutes(week);
      setAvailableSeconds((prev) => clampSeconds(prev + bonusMinutes * 60));
      // Chỉ nâng tiến độ của ĐÚNG môn đó trong ĐÚNG khối lớp đó
      setCompletedWeeks((prev) => ({
        ...prev,
        [key]: Math.max(prev[key] ?? 0, week.weekNumber),
      }));
      touch();

      const nextWeek = week.weekNumber + 1;
      return {
        passed: true,
        required,
        bonusMinutes,
        unlockedWeek:
          nextWeek <= totalWeeks(week.grade, week.subject) ? nextWeek : null,
      };
    },
    [completedWeeks, touch],
  );

  const grantMinutesByParent = useCallback(
    (minutes: number) => {
      if (!Number.isFinite(minutes) || minutes <= 0) return false;

      setAvailableSeconds((prev) => clampSeconds(prev + Math.floor(minutes) * 60));
      touch();
      return true;
    },
    [touch],
  );

  const saveParentSettings = useCallback(
    (settings: ParentSettings) => {
      setParentSettings(sanitizeParentSettings(settings));
      touch();
    },
    [touch],
  );

  const resetProgress = useCallback(
    () => {
      setIsPlaying(false);
      setTotalPoints(0);
      setAvailableSeconds(0);
      setMasteredQuestionIds([]);
      setCompletedWeeks(EMPTY_WEEK_PROGRESS);
      setAnswerStats(EMPTY_ANSWER_STATS);
      // CỐ Ý giữ `parentSettings`: đặt lại tiến độ của con không có lý gì phải
      // xoá luôn hạn mức mà phụ huynh vừa cấu hình.
      setDailyUsage(sanitizeDailyUsage(null, new Date()));
      touch();
      return true;
    },
    [touch],
  );

  const availableMinutes = Math.floor(availableSeconds / 60);

  const value = useMemo<PlaytimeContextValue>(
    () => ({
      currentUser: session
        ? {
            userId: session.userId,
            username: session.username,
            displayName: session.displayName,
            grade: session.grade,
            avatar: session.avatar,
            role: session.role,
            hasPin: session.hasPin,
          }
        : null,
      hydrated,
      totalPoints,
      availableSeconds,
      availableMinutes,
      isPlaying,
      // Khoá Góc Game vì một trong hai lý do: hết phút trong ví, hoặc hết hạn
      // mức của ngày. Màn hình đọc `dailyLimitReached` để nói đúng lý do.
      isLocked: availableSeconds <= 0 || dailyLimitReached,
      masteredQuestionIds,
      completedWeeks,
      answerStats,
      parentSettings,
      remainingTodaySeconds,
      dailyLimitReached,
      progress: {
        totalPoints,
        accumulatedGameMinutes: availableMinutes,
        lastUpdated: lastUpdated ?? new Date().toISOString(),
      },
      submitAnswer,
      startPlaying,
      pausePlaying,
      completeWeek,
      grantMinutesByParent,
      saveParentSettings,
      resetProgress,
      syncState,
      syncError,
      isOnline,
      pendingChanges,
      lastSyncedAt,
      syncNow,
    }),
    [
      session,
      hydrated,
      totalPoints,
      availableSeconds,
      availableMinutes,
      isPlaying,
      masteredQuestionIds,
      completedWeeks,
      answerStats,
      parentSettings,
      remainingTodaySeconds,
      dailyLimitReached,
      lastUpdated,
      submitAnswer,
      startPlaying,
      pausePlaying,
      completeWeek,
      grantMinutesByParent,
      saveParentSettings,
      resetProgress,
      syncState,
      syncError,
      isOnline,
      pendingChanges,
      lastSyncedAt,
      syncNow,
    ],
  );

  return <PlaytimeContext.Provider value={value}>{children}</PlaytimeContext.Provider>;
}

export function usePlaytime(): PlaytimeContextValue {
  const context = useContext(PlaytimeContext);
  if (!context) {
    throw new Error('usePlaytime phải được dùng bên trong <PlaytimeProvider>');
  }
  return context;
}

/** Định dạng số giây thành chuỗi MM:SS */
export function formatClock(totalSeconds: number): string {
  const safeSeconds = Math.max(0, Math.ceil(totalSeconds));
  const minutes = Math.floor(safeSeconds / 60);
  const seconds = safeSeconds % 60;
  return `${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}`;
}

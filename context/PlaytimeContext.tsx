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
  DEFAULT_PARENT_PIN,
  MAX_ACCUMULATED_MINUTES,
  POINTS_PER_CORRECT,
  REPEAT_ANSWER_GIVES_MINUTES,
} from '../constants/mockData';
import { TOTAL_WEEKS, weekBonusMinutes, weekPassThreshold } from './../constants/mathCurriculum';
import { isApiConfigured } from '../lib/authApi';
import {
  readLocalProgress,
  resolveConflict,
  writeLocalProgress,
} from '../lib/storage';
import { syncEngine, type EngineState } from '../lib/syncEngine';
import type {
  ProgressSyncPayload,
  Question,
  StoredProgress,
  SyncState,
  SessionUser,
  UserProgress,
  WeekTopic,
} from '../types';
import { useAuth } from './AuthContext';

const MAX_ACCUMULATED_SECONDS = MAX_ACCUMULATED_MINUTES * 60;

/**
 * Khoảng cách tối thiểu giữa hai lần đẩy dữ liệu lên Supabase.
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
  /** Tuần Toán cao nhất đã vượt qua (0 = chưa qua tuần nào) */
  highestCompletedWeek: number;
  /** Tiến độ ở dạng công khai, dùng để đồng bộ Supabase */
  progress: UserProgress;

  /** Ghi nhận câu trả lời, cộng điểm và quy đổi ra phút chơi game */
  submitAnswer: (question: Question, selectedAnswer: number) => RewardOutcome;
  startPlaying: () => void;
  pausePlaying: () => void;
  /** Ghi nhận kết quả một tuần Toán: mở tuần kế tiếp và cộng phút thưởng */
  completeWeek: (week: WeekTopic, correctCount: number) => WeekOutcome;
  /** Kiểm tra mã PIN phụ huynh */
  verifyParentPin: (pin: string) => boolean;
  /** Phụ huynh cấp thêm phút, cần đúng mã PIN. Trả về `true` nếu thành công */
  grantMinutesByParent: (minutes: number, pin: string) => boolean;
  /** Xoá toàn bộ tiến độ (cần đúng mã PIN) */
  resetProgress: (pin: string) => boolean;

  // ----- Đồng bộ Supabase -----
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

function clampSeconds(value: number): number {
  if (!Number.isFinite(value)) return 0;
  return Math.min(Math.max(value, 0), MAX_ACCUMULATED_SECONDS);
}

/** So sánh hai mốc thời gian ISO. Supabase trả về "+00:00" còn `Date` trả "Z". */
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
  const [highestCompletedWeek, setHighestCompletedWeek] = useState(0);
  const [isPlaying, setIsPlaying] = useState(false);

  /**
   * Mốc cập nhật của dữ liệu cục bộ. `null` = máy này chưa từng lưu gì
   * (mới cài), khi đó dữ liệu trên Supabase luôn được ưu tiên.
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
    highestCompletedWeek,
    lastUpdated,
  });
  stateRef.current = {
    totalPoints,
    availableSeconds,
    masteredQuestionIds,
    highestCompletedWeek,
    lastUpdated,
  };

  /** Đánh dấu dữ liệu vừa thay đổi */
  const touch = useCallback(() => setLastUpdated(new Date().toISOString()), []);

  // ----- Đọc dữ liệu của tài khoản hiện tại; đổi tài khoản thì tải lại -----
  useEffect(() => {
    let cancelled = false;

    // Chưa đăng nhập: không có dữ liệu nào để hiển thị
    if (!currentUserId) {
      setHydrated(false);
      setTotalPoints(0);
      setAvailableSeconds(0);
      setMasteredQuestionIds([]);
      setHighestCompletedWeek(0);
      setLastUpdated(null);
      setIsPlaying(false);
      return;
    }

    // Xoá sạch state của tài khoản trước rồi mới nạp tài khoản mới,
    // để không có khoảnh khắc nào hiện điểm/giờ của người khác.
    setHydrated(false);
    setTotalPoints(0);
    setAvailableSeconds(0);
    setMasteredQuestionIds([]);
    setHighestCompletedWeek(0);
    setLastUpdated(null);
    setIsPlaying(false);

    (async () => {
      try {
        // Đọc thẳng từ Local: chỉ vài ms, không gọi mạng
        const saved = await readLocalProgress(currentUserId);
        if (!cancelled && saved) {
          setTotalPoints(saved.totalPoints);
          setAvailableSeconds(clampSeconds(saved.availableSeconds));
          setMasteredQuestionIds(saved.masteredQuestionIds);
          setHighestCompletedWeek(Math.min(TOTAL_WEEKS, saved.highestCompletedWeek));
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
        version: 1,
        totalPoints,
        availableSeconds,
        masteredQuestionIds,
        highestCompletedWeek,
        lastUpdated,
      };

      // 1) Ghi Local trước — đây mới là nơi dữ liệu được coi là đã lưu
      void writeLocalProgress(currentUserId, snapshot);

      // 2) Xếp vào hàng đợi để engine đẩy lên server sau. Không await, nên
      //    dù đang offline UI cũng không hề chờ.
      if (isApiConfigured && sessionToken) {
        syncEngine.queueProgress(currentUserId, sessionToken, {
          totalPoints,
          accumulatedGameMinutes: Math.floor(availableSeconds / 60),
          masteredQuestionIds,
          highestCompletedWeek,
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
    highestCompletedWeek,
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
      touch();
    }, 1000);

    return () => clearInterval(intervalId);
  }, [isPlaying, touch]);

  // Hết thời gian → tự động dừng và khoá
  useEffect(() => {
    if (isPlaying && availableSeconds <= 0) {
      setIsPlaying(false);
    }
  }, [isPlaying, availableSeconds]);

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
    setHighestCompletedWeek(
      Math.min(TOTAL_WEEKS, Math.max(0, Math.floor(remote.highestCompletedWeek))),
    );
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

      if (!isCorrect) {
        return {
          isCorrect: false,
          pointsEarned: 0,
          minutesEarned: 0,
          alreadyMastered: false,
        };
      }

      const alreadyMastered = masteredQuestionIds.includes(question.id);
      const minutesEarned =
        alreadyMastered && !REPEAT_ANSWER_GIVES_MINUTES ? 0 : question.rewardMinutes;

      setTotalPoints((prev) => prev + POINTS_PER_CORRECT);
      if (minutesEarned > 0) {
        setAvailableSeconds((prev) => clampSeconds(prev + minutesEarned * 60));
      }
      if (!alreadyMastered) {
        setMasteredQuestionIds((prev) => [...prev, question.id]);
      }
      touch();

      return {
        isCorrect: true,
        pointsEarned: POINTS_PER_CORRECT,
        minutesEarned,
        alreadyMastered,
      };
    },
    [masteredQuestionIds, touch],
  );

  const startPlaying = useCallback(() => {
    // Chỉ cho chạy đồng hồ khi còn thời gian tích luỹ
    if (availableSeconds > 0) setIsPlaying(true);
  }, [availableSeconds]);

  const pausePlaying = useCallback(() => setIsPlaying(false), []);

  const completeWeek = useCallback(
    (week: WeekTopic, correctCount: number): WeekOutcome => {
      const required = weekPassThreshold(week);
      const passed = correctCount >= required;

      if (!passed) {
        return { passed: false, required, bonusMinutes: 0, unlockedWeek: null };
      }

      // Chỉ thưởng và mở khoá ở lần ĐẦU vượt qua tuần, để làm lại tuần cũ
      // không thể cộng phút chơi game vô hạn.
      const isFirstTime = week.weekNumber > highestCompletedWeek;
      if (!isFirstTime) {
        return { passed: true, required, bonusMinutes: 0, unlockedWeek: null };
      }

      const bonusMinutes = weekBonusMinutes(week);
      setAvailableSeconds((prev) => clampSeconds(prev + bonusMinutes * 60));
      setHighestCompletedWeek((prev) => Math.max(prev, week.weekNumber));
      touch();

      const nextWeek = week.weekNumber + 1;
      return {
        passed: true,
        required,
        bonusMinutes,
        unlockedWeek: nextWeek <= TOTAL_WEEKS ? nextWeek : null,
      };
    },
    [highestCompletedWeek, touch],
  );

  const verifyParentPin = useCallback(
    (pin: string) => pin === DEFAULT_PARENT_PIN,
    [],
  );

  const grantMinutesByParent = useCallback(
    (minutes: number, pin: string) => {
      if (!verifyParentPin(pin)) return false;
      if (!Number.isFinite(minutes) || minutes <= 0) return false;

      setAvailableSeconds((prev) => clampSeconds(prev + Math.floor(minutes) * 60));
      touch();
      return true;
    },
    [touch, verifyParentPin],
  );

  const resetProgress = useCallback(
    (pin: string) => {
      if (!verifyParentPin(pin)) return false;

      setIsPlaying(false);
      setTotalPoints(0);
      setAvailableSeconds(0);
      setMasteredQuestionIds([]);
      setHighestCompletedWeek(0);
      touch();
      return true;
    },
    [touch, verifyParentPin],
  );

  const availableMinutes = Math.floor(availableSeconds / 60);

  const value = useMemo<PlaytimeContextValue>(
    () => ({
      currentUser: session
        ? { userId: session.userId, username: session.username, role: session.role }
        : null,
      hydrated,
      totalPoints,
      availableSeconds,
      availableMinutes,
      isPlaying,
      isLocked: availableSeconds <= 0,
      masteredQuestionIds,
      highestCompletedWeek,
      progress: {
        totalPoints,
        accumulatedGameMinutes: availableMinutes,
        lastUpdated: lastUpdated ?? new Date().toISOString(),
      },
      submitAnswer,
      startPlaying,
      pausePlaying,
      completeWeek,
      verifyParentPin,
      grantMinutesByParent,
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
      highestCompletedWeek,
      lastUpdated,
      submitAnswer,
      startPlaying,
      pausePlaying,
      completeWeek,
      verifyParentPin,
      grantMinutesByParent,
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

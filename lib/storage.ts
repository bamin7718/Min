import AsyncStorage from '@react-native-async-storage/async-storage';

import type { ProgressSyncPayload, StoredProgress } from '../types';

/**
 * Tầng lưu trữ Local — nguồn dữ liệu CHÍNH của ứng dụng.
 *
 * Mọi thao tác đọc/ghi của UI đều đi qua đây và chỉ chạm AsyncStorage, không
 * chờ mạng. Việc đẩy lên server là chuyện của `lib/syncEngine.ts`, diễn ra
 * ngầm phía sau.
 *
 * Dữ liệu tách riêng theo `userId` để đổi tài khoản là đổi hẳn dữ liệu.
 */

const PROGRESS_PREFIX = '@lop3-study-game/progress-v2/';
const QUEUE_KEY = '@lop3-study-game/sync-queue-v1';

export function progressKey(userId: string): string {
  return `${PROGRESS_PREFIX}${userId}`;
}

/* ------------------------------------------------------------------ */
/* Tiến độ                                                             */
/* ------------------------------------------------------------------ */

function sanitizeProgress(raw: Partial<StoredProgress>): StoredProgress {
  return {
    version: 1,
    totalPoints: Math.max(0, Math.floor(raw.totalPoints ?? 0)),
    availableSeconds: Math.max(0, raw.availableSeconds ?? 0),
    masteredQuestionIds: Array.isArray(raw.masteredQuestionIds)
      ? raw.masteredQuestionIds.filter((x): x is string => typeof x === 'string')
      : [],
    highestCompletedWeek: Math.min(35, Math.max(0, Math.floor(raw.highestCompletedWeek ?? 0))),
    lastUpdated: raw.lastUpdated ?? new Date().toISOString(),
  };
}

/** Đọc tiến độ đã lưu của một tài khoản. `null` nếu chưa có. */
export async function readLocalProgress(userId: string): Promise<StoredProgress | null> {
  try {
    const raw = await AsyncStorage.getItem(progressKey(userId));
    if (!raw) return null;
    return sanitizeProgress(JSON.parse(raw) as Partial<StoredProgress>);
  } catch (error) {
    console.warn('[storage] Không đọc được tiến độ:', error);
    return null;
  }
}

/** Ghi tiến độ xuống Local. Đây là nơi dữ liệu được coi là "đã lưu". */
export async function writeLocalProgress(
  userId: string,
  progress: StoredProgress,
): Promise<void> {
  try {
    await AsyncStorage.setItem(progressKey(userId), JSON.stringify(progress));
  } catch (error) {
    console.warn('[storage] Không lưu được tiến độ:', error);
  }
}

export async function clearLocalProgress(userId: string): Promise<void> {
  try {
    await AsyncStorage.removeItem(progressKey(userId));
  } catch (error) {
    console.warn('[storage] Không xoá được tiến độ:', error);
  }
}

/* ------------------------------------------------------------------ */
/* Hàng đợi đồng bộ                                                    */
/* ------------------------------------------------------------------ */

export interface SyncQueueItem {
  /** Tài khoản sở hữu thay đổi này */
  userId: string;
  /** Token phiên để server xác định user_id — không tin tham số client */
  token: string;
  payload: ProgressSyncPayload;
  queuedAt: string;
  /** Số lần đã thử đẩy thất bại, dùng để giãn thời gian thử lại */
  attempts: number;
}

export async function readSyncQueue(): Promise<SyncQueueItem[]> {
  try {
    const raw = await AsyncStorage.getItem(QUEUE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? (parsed as SyncQueueItem[]) : [];
  } catch (error) {
    console.warn('[storage] Không đọc được hàng đợi:', error);
    return [];
  }
}

export async function writeSyncQueue(items: SyncQueueItem[]): Promise<void> {
  try {
    await AsyncStorage.setItem(QUEUE_KEY, JSON.stringify(items));
  } catch (error) {
    console.warn('[storage] Không lưu được hàng đợi:', error);
  }
}

/**
 * Thêm một thay đổi vào hàng đợi.
 *
 * Tiến độ là một ảnh chụp toàn phần (không phải delta), nên chỉ ảnh chụp MỚI
 * NHẤT của mỗi tài khoản là có ý nghĩa. Vì vậy hàm này THAY THẾ mục cũ của
 * cùng userId thay vì nối thêm — hàng đợi không phình to dù offline cả ngày,
 * và không có nguy cơ ghi đè bằng một trạng thái cũ.
 */
export async function enqueueProgress(item: SyncQueueItem): Promise<number> {
  const queue = await readSyncQueue();
  const others = queue.filter((entry) => entry.userId !== item.userId);
  const previous = queue.find((entry) => entry.userId === item.userId);

  const next: SyncQueueItem[] = [
    ...others,
    { ...item, attempts: previous?.attempts ?? 0 },
  ];
  await writeSyncQueue(next);
  return next.length;
}

/** Xoá mục đã đẩy thành công */
export async function dequeueProgress(userId: string): Promise<number> {
  const queue = await readSyncQueue();
  const next = queue.filter((entry) => entry.userId !== userId);
  await writeSyncQueue(next);
  return next.length;
}

/** Ghi nhận một lần thử thất bại */
export async function markAttempt(userId: string): Promise<void> {
  const queue = await readSyncQueue();
  await writeSyncQueue(
    queue.map((entry) =>
      entry.userId === userId ? { ...entry, attempts: entry.attempts + 1 } : entry,
    ),
  );
}

export async function countPending(): Promise<number> {
  return (await readSyncQueue()).length;
}

/* ------------------------------------------------------------------ */
/* Giải quyết xung đột                                                 */
/* ------------------------------------------------------------------ */

/** So hai mốc ISO. Supabase trả "+00:00" còn `Date` trả "Z" nên phải parse. */
function parseTime(value: string): number {
  const time = Date.parse(value);
  return Number.isNaN(time) ? 0 : time;
}

export type ConflictWinner = 'local' | 'remote';

/**
 * Chọn bên thắng khi Local và Server khác nhau: **timestamp mới nhất thắng**.
 *
 * `localLastUpdated === null` nghĩa là máy này chưa từng lưu gì (mới cài), khi
 * đó luôn lấy dữ liệu server về.
 */
export function resolveConflict(
  localLastUpdated: string | null,
  remoteLastUpdated: string,
): ConflictWinner {
  if (localLastUpdated === null) return 'remote';
  return parseTime(remoteLastUpdated) > parseTime(localLastUpdated) ? 'remote' : 'local';
}

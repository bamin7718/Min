import NetInfo, { type NetInfoState } from '@react-native-community/netinfo';

import { fetchProgress, isApiConfigured, pushProgress } from './authApi';
import {
  countPending,
  dequeueProgress,
  enqueueProgress,
  markAttempt,
  readSyncQueue,
} from './storage';
import type { ProgressSyncPayload, SyncResult } from '../types';

/**
 * Sync Engine đồng bộ ngầm.
 *
 * Nguyên tắc: UI không bao giờ chờ engine này. Mọi thay đổi đã được ghi xuống
 * Local trước rồi mới đưa vào hàng đợi ở đây; engine tự đẩy lên server khi có
 * mạng và tự thử lại khi thất bại.
 */

export type EngineStatus = 'idle' | 'syncing' | 'synced' | 'offline' | 'error';

export interface EngineState {
  online: boolean;
  status: EngineStatus;
  /** Số thay đổi còn chờ đẩy lên server */
  pending: number;
  error: string | null;
  lastSyncedAt: string | null;
}

type Listener = (state: EngineState) => void;

/** Giãn thời gian thử lại: 5s, 10s, 20s, 40s... tối đa 5 phút */
function backoffMs(attempts: number): number {
  return Math.min(5_000 * 2 ** Math.max(0, attempts), 300_000);
}

class SyncEngine {
  private state: EngineState = {
    online: true,
    status: 'idle',
    pending: 0,
    error: null,
    lastSyncedAt: null,
  };

  private listeners = new Set<Listener>();
  private unsubscribeNetInfo: (() => void) | null = null;
  private retryTimer: ReturnType<typeof setTimeout> | null = null;
  private flushing = false;
  private started = false;

  /* -------------------- vòng đời -------------------- */

  start(): void {
    if (this.started) return;
    this.started = true;

    this.unsubscribeNetInfo = NetInfo.addEventListener((netState: NetInfoState) => {
      // `isInternetReachable` có thể là null lúc chưa xác định được; khi đó
      // cứ tin `isConnected` để không chặn oan việc đồng bộ.
      const online = Boolean(netState.isConnected) && netState.isInternetReachable !== false;
      const wasOffline = !this.state.online;

      this.patch({ online, status: online ? this.state.status : 'offline' });

      // Vừa có mạng lại → đẩy ngay những gì đang xếp hàng
      if (online && wasOffline) void this.flush();
    });

    void this.refreshPending();
    void this.flush();
  }

  stop(): void {
    this.unsubscribeNetInfo?.();
    this.unsubscribeNetInfo = null;
    if (this.retryTimer) clearTimeout(this.retryTimer);
    this.retryTimer = null;
    this.started = false;
  }

  subscribe(listener: Listener): () => void {
    this.listeners.add(listener);
    listener(this.state);
    return () => this.listeners.delete(listener);
  }

  getState(): EngineState {
    return this.state;
  }

  private patch(partial: Partial<EngineState>): void {
    this.state = { ...this.state, ...partial };
    for (const listener of this.listeners) listener(this.state);
  }

  /**
   * Đặt status nhưng để trạng thái offline luôn thắng.
   *
   * Cần thiết vì một lượt `flush()` có thể đang dở khi mất mạng; nếu ghi đè
   * thẳng thì lượt đó kết thúc sẽ báo "đã đồng bộ" trong lúc thiết bị đã
   * offline từ trước đó.
   */
  private setStatus(status: EngineStatus): void {
    this.patch({ status: this.state.online ? status : 'offline' });
  }

  private async refreshPending(): Promise<void> {
    this.patch({ pending: await countPending() });
  }

  /* -------------------- ghi -------------------- */

  /**
   * Xếp một ảnh chụp tiến độ vào hàng đợi rồi thử đẩy ngay.
   * Hàm này KHÔNG await việc đẩy — gọi xong là trả về liền cho UI.
   */
  queueProgress(userId: string, token: string, payload: ProgressSyncPayload): void {
    // Local Mode: tiến độ đã được ghi thẳng vào AsyncStorage nên không có gì
    // phải xếp hàng. Nếu vẫn xếp thì bảng trạng thái sẽ treo mãi "1 chờ" và
    // phụ huynh tưởng app đang lỗi đồng bộ.
    if (!isApiConfigured) return;

    void (async () => {
      const pending = await enqueueProgress({
        userId,
        token,
        payload,
        queuedAt: new Date().toISOString(),
        attempts: 0,
      });
      this.patch({ pending });
      void this.flush();
    })();
  }

  /* -------------------- đọc -------------------- */

  /** Tải tiến độ từ server. Dùng khi mở app / đổi tài khoản. */
  async pull(token: string): Promise<SyncResult<ProgressSyncPayload | null>> {
    // Local Mode: coi như kéo xong và không có gì trên máy chủ. Trả `ok: true`
    // để nơi gọi không hiểu lầm là lỗi mạng.
    if (!isApiConfigured) return { ok: true, data: null };
    if (!this.state.online) return { ok: false, error: 'Đang offline.' };

    this.setStatus('syncing');
    const result = await fetchProgress(token);

    if (!result.ok) {
      this.patch({ error: result.error });
      this.setStatus('error');
      return result;
    }
    this.patch({ error: null, lastSyncedAt: new Date().toISOString() });
    this.setStatus('synced');
    return result;
  }

  /* -------------------- đẩy hàng đợi -------------------- */

  /** Đẩy toàn bộ hàng đợi lên server. An toàn khi gọi trùng lặp. */
  async flush(): Promise<void> {
    if (this.flushing || !isApiConfigured) return;
    if (!this.state.online) {
      this.patch({ status: 'offline' });
      return;
    }

    const queue = await readSyncQueue();
    if (queue.length === 0) {
      this.patch({ pending: 0 });
      this.setStatus(this.state.lastSyncedAt ? 'synced' : 'idle');
      return;
    }

    this.flushing = true;
    this.setStatus('syncing');

    let failedAttempts = 0;
    let lastError: string | null = null;

    try {
      for (const item of queue) {
        const result = await pushProgress(item.token, item.payload);

        if (result.ok) {
          await dequeueProgress(item.userId);
        } else {
          await markAttempt(item.userId);
          failedAttempts = Math.max(failedAttempts, item.attempts + 1);
          lastError = result.error;
        }
      }
    } finally {
      this.flushing = false;
    }

    const pending = await countPending();

    if (pending === 0) {
      this.patch({ pending: 0, error: null, lastSyncedAt: new Date().toISOString() });
      this.setStatus('synced');
      return;
    }

    this.patch({ pending, error: lastError });
    this.setStatus('error');
    this.scheduleRetry(failedAttempts);
  }

  private scheduleRetry(attempts: number): void {
    if (this.retryTimer) clearTimeout(this.retryTimer);
    this.retryTimer = setTimeout(() => {
      this.retryTimer = null;
      void this.flush();
    }, backoffMs(attempts));
  }
}

/** Một instance duy nhất cho cả app */
export const syncEngine = new SyncEngine();

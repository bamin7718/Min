/**
 * Client-side helper để giao tiếp với /api/zombie-room.
 * Không import React — dùng được trong useRef và ngoài component.
 */
import { isApiConfigured } from './authApi';
import type { ZombieRoomInput, ZombieRoomRecord } from './turso';

export { isApiConfigured as canPlayMultiplayer };

const base = (): string => process.env.EXPO_PUBLIC_PROGRESS_API_URL?.trim() ?? '';

async function post<T>(
  token: string,
  action: string,
  body: Record<string, unknown> = {},
): Promise<T> {
  const res = await fetch(`${base()}/api/zombie-room?action=${action}`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(body),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({})) as { error?: string };
    throw new Error(err.error ?? `HTTP ${res.status}`);
  }
  return res.json() as Promise<T>;
}

export async function createZombieRoomApi(
  token: string,
): Promise<{ code: string; seed: number }> {
  return post(token, 'create');
}

export async function joinZombieRoomApi(
  token: string,
  code: string,
): Promise<{ code: string; seed: number; status: string }> {
  return post(token, 'join', { code });
}

export class ZombieRoomClient {
  private token: string;
  private code: string;
  private role: 'host' | 'guest';

  constructor(token: string, code: string, role: 'host' | 'guest') {
    this.token = token;
    this.code = code;
    this.role = role;
  }

  /** Kiểm tra trạng thái phòng — dùng khi host đang chờ guest vào */
  async poll(): Promise<{ status: string; hasGuest: boolean }> {
    return post(this.token, 'poll', { code: this.code });
  }

  /** Gửi input của mình, nhận lại input đối phương */
  async pushAndPull(input: ZombieRoomInput): Promise<ZombieRoomInput | null> {
    try {
      if (this.role === 'host') {
        const { guestInput } = await post<{ guestInput: ZombieRoomInput | null }>(
          this.token,
          'push-host',
          { code: this.code, input },
        );
        return guestInput;
      } else {
        const { hostInput } = await post<{ hostInput: ZombieRoomInput | null }>(
          this.token,
          'push-guest',
          { code: this.code, input },
        );
        return hostInput;
      }
    } catch {
      return null;
    }
  }

  /** Host bấm bắt đầu — chuyển trạng thái phòng sang 'playing' */
  async start(): Promise<void> {
    await post(this.token, 'start', { code: this.code });
  }

  /** Đóng phòng (thoát game hoặc game kết thúc) */
  async close(): Promise<void> {
    try {
      await post(this.token, 'close', { code: this.code });
    } catch {
      // fire and forget
    }
  }

  /** Đọc toàn bộ thông tin phòng (dùng khi cần seed) */
  async getRoom(): Promise<ZombieRoomRecord | null> {
    try {
      const res = await fetch(`${base()}/api/zombie-room?code=${this.code}`, {
        headers: { Authorization: `Bearer ${this.token}` },
      });
      if (!res.ok) return null;
      return res.json() as Promise<ZombieRoomRecord>;
    } catch {
      return null;
    }
  }
}

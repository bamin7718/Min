import { sessionSecret, verifySessionToken } from '../lib/authCrypto';
import {
  createTursoClient,
  initDatabase,
  readProgress,
  serverTursoConfig,
  writeProgress,
} from '../lib/turso';
import type { ProgressSyncPayload } from '../types';

/**
 * Đọc / ghi tiến độ của học sinh đang đăng nhập.
 *
 * GET  /api/progress   (Authorization: Bearer <session token>)
 * PUT  /api/progress   (Authorization: Bearer <session token>)
 *
 * PHÂN QUYỀN DỮ LIỆU: `user_id` được lấy TỪ TOKEN đã ký, không phải từ tham số
 * client gửi lên. Nhờ vậy dù người dùng có sửa request thế nào cũng chỉ đọc và
 * ghi được đúng dòng của mình (mọi truy vấn đều có `WHERE user_id = ?`).
 */
export const config = { runtime: 'edge' };

const JSON_HEADERS = {
  'Content-Type': 'application/json; charset=utf-8',
  'Cache-Control': 'no-store',
};

function json(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), { status, headers: JSON_HEADERS });
}

/** Không tin gì từ client: kẹp mọi giá trị về khoảng hợp lệ */
function parsePayload(input: unknown): ProgressSyncPayload | null {
  if (typeof input !== 'object' || input === null) return null;
  const raw = input as Record<string, unknown>;

  const toInt = (value: unknown, max: number): number => {
    const n = Number(value);
    if (!Number.isFinite(n)) return 0;
    return Math.min(max, Math.max(0, Math.floor(n)));
  };

  const lastUpdated =
    typeof raw.lastUpdated === 'string' && !Number.isNaN(Date.parse(raw.lastUpdated))
      ? raw.lastUpdated
      : new Date().toISOString();

  const ids = Array.isArray(raw.masteredQuestionIds)
    ? raw.masteredQuestionIds
        .filter((x): x is string => typeof x === 'string' && x.length <= 64)
        .slice(0, 2000)
    : [];

  return {
    totalPoints: toInt(raw.totalPoints, 10_000_000),
    accumulatedGameMinutes: toInt(raw.accumulatedGameMinutes, 100_000),
    masteredQuestionIds: ids,
    highestCompletedWeek: toInt(raw.highestCompletedWeek, 35),
    lastUpdated,
  };
}

function bearerToken(request: Request): string | null {
  const header = request.headers.get('authorization') ?? '';
  const match = /^Bearer\s+(.+)$/i.exec(header.trim());
  return match ? match[1] : null;
}

export default async function handler(request: Request): Promise<Response> {
  const dbConfig = serverTursoConfig();
  const secret = sessionSecret();
  if (!dbConfig || !secret) {
    return json({ error: 'Server chưa cấu hình Turso hoặc AUTH_SECRET.' }, 503);
  }

  const token = bearerToken(request);
  if (!token) return json({ error: 'Thiếu token phiên.' }, 401);

  const userId = await verifySessionToken(token, secret);
  if (!userId) return json({ error: 'Phiên đăng nhập không hợp lệ hoặc đã hết hạn.' }, 401);

  const client = createTursoClient(dbConfig);

  try {
    await initDatabase(client);

    if (request.method === 'GET') {
      return json({ progress: await readProgress(client, userId) });
    }

    if (request.method === 'PUT' || request.method === 'POST') {
      const payload = parsePayload(await request.json().catch(() => null));
      if (!payload) return json({ error: 'Dữ liệu gửi lên không hợp lệ.' }, 400);

      await writeProgress(client, userId, crypto.randomUUID(), payload);
      return json({ ok: true, progress: payload });
    }

    return json({ error: 'Chỉ hỗ trợ GET, PUT.' }, 405);
  } catch (error) {
    console.error('[api/progress]', error);
    return json({ error: 'Không truy cập được database.' }, 502);
  }
}

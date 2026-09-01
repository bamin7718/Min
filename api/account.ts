import { hashSecret, sessionSecret, verifySecret, verifySessionToken } from '../lib/authCrypto';
import {
  createTursoClient,
  findUserById,
  initDatabase,
  serverTursoConfig,
  updatePinHash,
  updateUsername,
} from '../lib/turso';

/**
 * Quản lý tài khoản của chính người đang đăng nhập.
 *
 * POST /api/account?action=rename      { username }
 * POST /api/account?action=verify-pin  { pin }
 * POST /api/account?action=change-pin  { oldPin, newPin }
 *
 * Mọi thao tác lấy `user_id` TỪ session token đã ký, không nhận từ client — nên
 * không thể đổi tên hay PIN của tài khoản khác.
 */
export const config = { runtime: 'edge' };

const JSON_HEADERS = {
  'Content-Type': 'application/json; charset=utf-8',
  'Cache-Control': 'no-store',
};

function json(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), { status, headers: JSON_HEADERS });
}

const USERNAME_PATTERN = /^[a-zA-Z0-9_.-]{3,24}$/;
const PIN_PATTERN = /^\d{4}$/;

function bearerToken(request: Request): string | null {
  const match = /^Bearer\s+(.+)$/i.exec((request.headers.get('authorization') ?? '').trim());
  return match ? match[1] : null;
}

export default async function handler(request: Request): Promise<Response> {
  if (request.method !== 'POST') return json({ error: 'Chỉ hỗ trợ POST.' }, 405);

  const dbConfig = serverTursoConfig();
  const secret = sessionSecret();
  if (!dbConfig || !secret) return json({ error: 'Server chưa cấu hình.' }, 503);

  const token = bearerToken(request);
  const userId = token ? await verifySessionToken(token, secret) : null;
  if (!userId) return json({ error: 'Phiên đăng nhập không hợp lệ hoặc đã hết hạn.' }, 401);

  const action = new URL(request.url).searchParams.get('action');
  const body = (await request.json().catch(() => null)) as Record<string, unknown> | null;
  if (!body) return json({ error: 'Dữ liệu gửi lên không hợp lệ.' }, 400);

  const client = createTursoClient(dbConfig);

  try {
    await initDatabase(client);
    const user = await findUserById(client, userId);
    if (!user) return json({ error: 'Không tìm thấy tài khoản.' }, 404);

    /* ---------------- Đổi tên hiển thị ---------------- */
    if (action === 'rename') {
      const username = typeof body.username === 'string' ? body.username.trim() : '';
      if (!USERNAME_PATTERN.test(username)) {
        return json(
          {
            error:
              'Tên cần 3-24 ký tự, chỉ gồm chữ, số, dấu chấm, gạch dưới hoặc gạch ngang.',
          },
          400,
        );
      }
      if (username.toLowerCase() === user.username.toLowerCase()) {
        // Chỉ đổi hoa/thường thì vẫn cho phép, không coi là trùng chính mình
        await updateUsername(client, userId, username);
        return json({ username });
      }
      const ok = await updateUsername(client, userId, username);
      if (!ok) return json({ error: 'Tên này đã có người dùng.' }, 409);
      return json({ username });
    }

    /* ---------------- Kiểm tra PIN ---------------- */
    if (action === 'verify-pin') {
      if (user.role !== 'parent') {
        return json({ error: 'Chỉ tài khoản phụ huynh mới có mã PIN.' }, 403);
      }
      if (!user.pinHash) return json({ error: 'Tài khoản chưa đặt mã PIN.' }, 409);

      const pin = typeof body.pin === 'string' ? body.pin.trim() : '';
      const ok = await verifySecret(pin, user.pinHash);
      return ok ? json({ ok: true }) : json({ error: 'Mã PIN không đúng.' }, 401);
    }

    /* ---------------- Đổi PIN ---------------- */
    if (action === 'change-pin') {
      if (user.role !== 'parent') {
        return json({ error: 'Chỉ tài khoản phụ huynh mới đổi được mã PIN.' }, 403);
      }

      const oldPin = typeof body.oldPin === 'string' ? body.oldPin.trim() : '';
      const newPin = typeof body.newPin === 'string' ? body.newPin.trim() : '';

      if (!PIN_PATTERN.test(newPin)) {
        return json({ error: 'Mã PIN mới phải gồm đúng 4 chữ số.' }, 400);
      }
      if (user.pinHash && !(await verifySecret(oldPin, user.pinHash))) {
        return json({ error: 'Mã PIN cũ không đúng.' }, 401);
      }

      await updatePinHash(client, userId, await hashSecret(newPin));
      return json({ ok: true });
    }

    return json({ error: 'action không hợp lệ.' }, 400);
  } catch (error) {
    console.error('[api/account]', error);
    return json({ error: 'Máy chủ gặp sự cố. Vui lòng thử lại sau.' }, 502);
  }
}

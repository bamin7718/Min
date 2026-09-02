import { hashSecret, sessionSecret, verifySecret, verifySessionToken } from '../lib/authCrypto';
import {
  createTursoClient,
  findUserById,
  initDatabase,
  serverTursoConfig,
  updatePinHash,
  updateUserProfile,
  type UserRecord,
} from '../lib/turso';
import { sanitizeAvatar, sanitizeGrade } from '../types';

/**
 * Quản lý tài khoản của chính người đang đăng nhập.
 *
 * POST /api/account?action=set-profile { displayName?, grade?, avatar? }
 * POST /api/account?action=verify-pin  { pin }
 * POST /api/account?action=change-pin  { oldPin, newPin }
 *
 * Mọi thao tác lấy `user_id` TỪ session token đã ký, không nhận từ client — nên
 * không thể đổi hồ sơ hay PIN của tài khoản khác.
 */
export const config = { runtime: 'edge' };

const JSON_HEADERS = {
  'Content-Type': 'application/json; charset=utf-8',
  'Cache-Control': 'no-store',
};

function json(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), { status, headers: JSON_HEADERS });
}

const PIN_PATTERN = /^\d{4}$/;
const MIN_DISPLAY_NAME = 2;
const MAX_DISPLAY_NAME = 48;

/** Phần thông tin tài khoản trả về cho client — không có hash nào */
function sessionUser(user: UserRecord) {
  return {
    userId: user.id,
    username: user.username,
    displayName: user.displayName,
    grade: user.grade,
    avatar: user.avatar,
    role: user.role,
    hasPin: user.pinHash !== null,
  };
}

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

    /* ---------------- Cập nhật hồ sơ ---------------- */
    if (action === 'set-profile') {
      const patch: { displayName?: string; grade?: number; avatar?: string } = {};

      if (body.displayName !== undefined) {
        const name = typeof body.displayName === 'string' ? body.displayName.trim() : '';
        if (name.length < MIN_DISPLAY_NAME || name.length > MAX_DISPLAY_NAME) {
          return json(
            { error: `Họ và tên cần ${MIN_DISPLAY_NAME}-${MAX_DISPLAY_NAME} ký tự.` },
            400,
          );
        }
        patch.displayName = name;
      }
      // Khối lớp và avatar được KẸP về giá trị hợp lệ chứ không trả lỗi: client
      // chỉ chọn từ danh sách cố định, gửi giá trị lạ nghĩa là ai đó đang tự gọi
      // API — kẹp lại vẫn an toàn và không cần thêm nhánh lỗi.
      if (body.grade !== undefined) patch.grade = sanitizeGrade(body.grade);
      if (body.avatar !== undefined) patch.avatar = sanitizeAvatar(body.avatar);

      await updateUserProfile(client, userId, patch);

      // Đọc lại để trả về đúng thứ đã nằm trong database, không phải thứ client gửi
      const updated = await findUserById(client, userId);
      if (!updated) return json({ error: 'Không tìm thấy tài khoản.' }, 404);
      return json({ session: sessionUser(updated) });
    }

    /*
     * Hai nhánh PIN dưới đây KHÔNG còn chặn theo vai trò.
     *
     * Trước đây chúng trả 403 cho tài khoản `student`. Từ khi màn hình Đăng ký
     * bỏ phần chọn vai trò, mọi tài khoản mới đều là `student` — giữ ràng buộc
     * cũ thì không ai đặt được PIN và khu vực phụ huynh không bao giờ mở được.
     * Thứ bảo vệ khu vực đó bây giờ là chính mã PIN, không phải cột `role`.
     */

    /* ---------------- Kiểm tra PIN ---------------- */
    if (action === 'verify-pin') {
      if (!user.pinHash) return json({ error: 'Tài khoản chưa đặt mã PIN.' }, 409);

      const pin = typeof body.pin === 'string' ? body.pin.trim() : '';
      const ok = await verifySecret(pin, user.pinHash);
      return ok ? json({ ok: true }) : json({ error: 'Mã PIN không đúng.' }, 401);
    }

    /* ---------------- Đặt hoặc đổi PIN ---------------- */
    if (action === 'change-pin') {
      const oldPin = typeof body.oldPin === 'string' ? body.oldPin.trim() : '';
      const newPin = typeof body.newPin === 'string' ? body.newPin.trim() : '';

      if (!PIN_PATTERN.test(newPin)) {
        return json({ error: 'Mã PIN mới phải gồm đúng 4 chữ số.' }, 400);
      }
      // Chưa có PIN thì đây là lần thiết lập đầu, không đòi PIN cũ
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

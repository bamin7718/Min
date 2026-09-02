import {
  createSessionToken,
  hashSecret,
  sessionSecret,
  verifySecret,
} from '../lib/authCrypto';
import {
  createTursoClient,
  createUser,
  findUserByUsername,
  initDatabase,
  serverTursoConfig,
  type UserRecord,
} from '../lib/turso';
import { DEFAULT_AVATAR, DEFAULT_GRADE, sanitizeGrade } from '../types';

/**
 * Đăng ký / đăng nhập.
 *
 * POST /api/auth?action=register  { username, password, displayName, grade? }
 * POST /api/auth?action=login     { username, password }
 *
 * Toàn bộ việc băm mật khẩu và truy vấn bảng `users` diễn ra ở đây, nơi giữ
 * token Turso. Client chỉ nhận lại một session token đã ký.
 */
export const config = { runtime: 'edge' };

const JSON_HEADERS = {
  'Content-Type': 'application/json; charset=utf-8',
  'Cache-Control': 'no-store',
};

function json(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), { status, headers: JSON_HEADERS });
}

// Cho phép cả dấu gạch ngang: người dùng hay gõ kiểu "minh-anh"
const USERNAME_PATTERN = /^[a-zA-Z0-9_.-]{3,24}$/;
const MIN_PASSWORD = 6;
const MIN_DISPLAY_NAME = 2;
const MAX_DISPLAY_NAME = 48;

function newId(): string {
  return crypto.randomUUID();
}

/**
 * Phần thông tin tài khoản trả về cho client.
 *
 * KHÔNG bao giờ chứa `passwordHash` hay `pinHash` — chỉ có `hasPin` để app biết
 * nên hiện "Nhập mã PIN" hay "Thiết lập mã PIN".
 */
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

export default async function handler(request: Request): Promise<Response> {
  if (request.method !== 'POST') return json({ error: 'Chỉ hỗ trợ POST.' }, 405);

  const dbConfig = serverTursoConfig();
  const secret = sessionSecret();
  if (!dbConfig || !secret) {
    return json(
      {
        error:
          'Server chưa cấu hình. Cần TURSO_DATABASE_URL, TURSO_AUTH_TOKEN và AUTH_SECRET.',
      },
      503,
    );
  }

  const action = new URL(request.url).searchParams.get('action');
  const body = (await request.json().catch(() => null)) as Record<string, unknown> | null;
  if (!body) return json({ error: 'Dữ liệu gửi lên không hợp lệ.' }, 400);

  const username = typeof body.username === 'string' ? body.username.trim() : '';
  const password = typeof body.password === 'string' ? body.password : '';

  if (!USERNAME_PATTERN.test(username)) {
    return json(
      {
        error:
          'Tên đăng nhập cần 3-24 ký tự, chỉ gồm chữ, số, dấu chấm, gạch dưới hoặc gạch ngang.',
      },
      400,
    );
  }
  if (password.length < MIN_PASSWORD) {
    return json({ error: `Mật khẩu phải có ít nhất ${MIN_PASSWORD} ký tự.` }, 400);
  }

  const client = createTursoClient(dbConfig);

  try {
    await initDatabase(client);

    if (action === 'register') {
      /*
       * KHÔNG còn nhận `role` và `pin` từ client.
       *
       * Màn hình Đăng ký đã bỏ phần chọn vai trò, nên mọi tài khoản mới là học
       * sinh. Quan trọng hơn: nếu vẫn đọc `body.role` thì bất kỳ ai cũng có thể
       * gửi `{"role":"parent"}` bằng curl để tự tạo tài khoản phụ huynh — chốt
       * cứng ở server là cách duy nhất khiến điều đó bất khả.
       *
       * Mã PIN được đặt sau, trong Cài đặt (`/api/account?action=change-pin`).
       */
      const displayName =
        typeof body.displayName === 'string' ? body.displayName.trim() : '';
      if (displayName.length < MIN_DISPLAY_NAME || displayName.length > MAX_DISPLAY_NAME) {
        return json(
          {
            error: `Họ và tên cần ${MIN_DISPLAY_NAME}-${MAX_DISPLAY_NAME} ký tự.`,
          },
          400,
        );
      }

      const created = await createUser(
        client,
        {
          id: newId(),
          username,
          displayName,
          grade: sanitizeGrade(body.grade ?? DEFAULT_GRADE),
          avatar: DEFAULT_AVATAR,
          passwordHash: await hashSecret(password),
          role: 'student',
          pinHash: null,
        },
        newId(),
      );

      if (!created) {
        return json({ error: 'Tên đăng nhập này đã có người dùng.' }, 409);
      }

      const user = await findUserByUsername(client, username);
      if (!user) return json({ error: 'Không tạo được tài khoản.' }, 500);

      return json({
        session: {
          ...sessionUser(user),
          token: await createSessionToken(user.id, secret),
        },
      });
    }

    if (action === 'login') {
      const user = await findUserByUsername(client, username);

      // Cùng một thông báo cho cả hai trường hợp, để không tiết lộ
      // tên đăng nhập nào đang tồn tại.
      const failed = json({ error: 'Tên đăng nhập hoặc mật khẩu không đúng.' }, 401);
      if (!user) {
        // Vẫn băm một lần để thời gian phản hồi không khác biệt rõ rệt
        await hashSecret(password);
        return failed;
      }
      if (!(await verifySecret(password, user.passwordHash))) return failed;

      return json({
        session: {
          ...sessionUser(user),
          token: await createSessionToken(user.id, secret),
        },
      });
    }

    return json({ error: 'action phải là "register" hoặc "login".' }, 400);
  } catch (error) {
    // Khối try này bọc cả phần băm mật khẩu lẫn truy vấn database, nên thông
    // báo phải trung tính thay vì đổ oan cho database. Chi tiết lỗi chỉ ghi vào
    // log của Vercel, không trả về client.
    console.error('[api/auth]', error);
    return json(
      { error: 'Máy chủ gặp sự cố khi xử lý yêu cầu. Vui lòng thử lại sau.' },
      502,
    );
  }
}

/**
 * Băm mật khẩu và ký token phiên — CHỈ chạy phía server (`api/*`).
 *
 * Dùng WebCrypto có sẵn trên Vercel Edge và Node 18+, nên không cần thư viện
 * native. Cố tình KHÔNG băm mật khẩu ở client: nếu client băm thì chính cái
 * hash trở thành mật khẩu, và bảng users vẫn phải phơi ra cho client đọc.
 */

const PBKDF2_ITERATIONS = 100_000;
const SALT_BYTES = 16;
const KEY_BITS = 256;

const encoder = new TextEncoder();

function toBase64(bytes: Uint8Array): string {
  let binary = '';
  for (const byte of bytes) binary += String.fromCharCode(byte);
  return btoa(binary);
}

function fromBase64(value: string): Uint8Array {
  const binary = atob(value);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i += 1) bytes[i] = binary.charCodeAt(i);
  return bytes;
}

/** So sánh theo thời gian hằng số để không rò rỉ thông tin qua thời gian phản hồi */
function timingSafeEqual(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i += 1) diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return diff === 0;
}

async function pbkdf2(secret: string, salt: Uint8Array, iterations: number): Promise<string> {
  const keyMaterial = await crypto.subtle.importKey(
    'raw',
    encoder.encode(secret),
    'PBKDF2',
    false,
    ['deriveBits'],
  );
  const bits = await crypto.subtle.deriveBits(
    { name: 'PBKDF2', salt: salt as unknown as BufferSource, iterations, hash: 'SHA-256' },
    keyMaterial,
    KEY_BITS,
  );
  return toBase64(new Uint8Array(bits));
}

/** Băm mật khẩu (hoặc PIN). Kết quả: `pbkdf2$<vòng>$<salt>$<hash>` */
export async function hashSecret(secret: string): Promise<string> {
  const salt = crypto.getRandomValues(new Uint8Array(SALT_BYTES));
  const hash = await pbkdf2(secret, salt, PBKDF2_ITERATIONS);
  return `pbkdf2$${PBKDF2_ITERATIONS}$${toBase64(salt)}$${hash}`;
}

/** Kiểm tra mật khẩu (hoặc PIN) có khớp hash đã lưu */
export async function verifySecret(secret: string, stored: string): Promise<boolean> {
  const parts = stored.split('$');
  if (parts.length !== 4 || parts[0] !== 'pbkdf2') return false;

  const iterations = Number(parts[1]);
  if (!Number.isFinite(iterations) || iterations < 1000) return false;

  try {
    const hash = await pbkdf2(secret, fromBase64(parts[2]), iterations);
    return timingSafeEqual(hash, parts[3]);
  } catch {
    return false;
  }
}

/* ------------------------------------------------------------------ */
/* Token phiên                                                         */
/* ------------------------------------------------------------------ */

/** Số ngày token phiên còn hiệu lực */
const SESSION_DAYS = 30;

interface SessionPayload {
  sub: string; // userId
  exp: number; // giây epoch
}

function base64UrlEncode(value: string): string {
  return btoa(value).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

function base64UrlDecode(value: string): string {
  const padded = value.replace(/-/g, '+').replace(/_/g, '/');
  return atob(padded + '='.repeat((4 - (padded.length % 4)) % 4));
}

async function sign(data: string, secret: string): Promise<string> {
  const key = await crypto.subtle.importKey(
    'raw',
    encoder.encode(secret),
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign'],
  );
  const signature = await crypto.subtle.sign('HMAC', key, encoder.encode(data));
  return toBase64(new Uint8Array(signature))
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=+$/, '');
}

/**
 * Tạo token phiên đã ký.
 *
 * Đây là lý do client KHÔNG thể tự khai mình là ai: mọi request đều phải mang
 * token này, và server lấy `user_id` TỪ TOKEN chứ không tin tham số client gửi.
 */
export async function createSessionToken(userId: string, secret: string): Promise<string> {
  const payload: SessionPayload = {
    sub: userId,
    exp: Math.floor(Date.now() / 1000) + SESSION_DAYS * 86400,
  };
  const body = base64UrlEncode(JSON.stringify(payload));
  return `${body}.${await sign(body, secret)}`;
}

/** Xác thực token và trả về userId. `null` nếu sai chữ ký hoặc đã hết hạn. */
export async function verifySessionToken(
  token: string,
  secret: string,
): Promise<string | null> {
  const [body, signature] = token.split('.');
  if (!body || !signature) return null;

  const expected = await sign(body, secret);
  if (!timingSafeEqual(signature, expected)) return null;

  try {
    const payload = JSON.parse(base64UrlDecode(body)) as SessionPayload;
    if (typeof payload.sub !== 'string' || !payload.sub) return null;
    if (typeof payload.exp !== 'number' || payload.exp * 1000 < Date.now()) return null;
    return payload.sub;
  } catch {
    return null;
  }
}

/** Khoá bí mật để ký token, đọc từ biến môi trường server */
export function sessionSecret(): string | null {
  const secret = process.env.AUTH_SECRET?.trim();
  return secret && secret.length >= 16 ? secret : null;
}

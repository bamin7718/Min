import AsyncStorage from '@react-native-async-storage/async-storage';

import {
  DEFAULT_AVATAR,
  DEFAULT_GRADE,
  sanitizeAvatar,
  sanitizeGrade,
  type AuthSession,
  type SyncResult,
  type UserRole,
} from '../types';
import {
  fromHex,
  pbkdf2Sha256,
  randomBytes,
  timingSafeEqual,
  toHex,
} from './pureCrypto';

/**
 * Tài khoản chạy hoàn toàn trên máy (Local Mode).
 *
 * Dùng khi chưa cấu hình `EXPO_PUBLIC_PROGRESS_API_URL`: học sinh vẫn đăng ký,
 * đăng nhập, đổi tên, đặt mã PIN và lưu tiến độ bình thường — chỉ là dữ liệu
 * nằm trên chính máy đó, không đồng bộ sang máy khác.
 *
 * Mọi hàm ở đây có CÙNG chữ ký với hàm tương ứng trong `lib/authApi.ts`, nên
 * `authApi` chỉ việc chuyển hướng sang đây khi không có máy chủ; `AuthContext`
 * và các màn hình không cần biết mình đang ở chế độ nào.
 *
 * Giới hạn cần nói rõ: dữ liệu nằm trong AsyncStorage của chính máy người dùng.
 * Băm mật khẩu ở đây là để mật khẩu không bị lưu dạng chữ thường (nhiều người
 * dùng lại mật khẩu đó ở nơi khác), chứ không chống được người đã mở được máy.
 */

const ACCOUNTS_KEY = '@lop3-study-game/local-accounts-v1';
/**
 * 10 000 vòng, không phải 100 000 như bản trên máy chủ: ở đây PBKDF2 có thể phải
 * chạy bằng JavaScript thuần (Android không có crypto.subtle), 100 000 vòng sẽ
 * làm màn hình đăng nhập treo vài giây.
 */
const PBKDF2_ITERATIONS = 10_000;
const SALT_BYTES = 16;
const HASH_BYTES = 32;
/** Tiền tố riêng, để không bao giờ lẫn với chuỗi băm do máy chủ tạo */
const HASH_PREFIX = 'pbkdf2local';

interface LocalAccount {
  userId: string;
  username: string;
  /** Họ và tên. Bản ghi cũ không có trường này nên phải đọc phòng hờ. */
  displayName?: string;
  grade?: number;
  avatar?: string;
  role: UserRole;
  passwordHash: string;
  /**
   * Mã PIN mở khu vực phụ huynh.
   *
   * `null` = chưa đặt. Từ bản 1.0.8, MỌI tài khoản đều đặt được PIN (trước đây
   * chỉ tài khoản vai trò `parent` mới có) — vì màn hình Đăng ký không còn cho
   * chọn vai trò, nên nếu vẫn buộc phải là `parent` thì sẽ không tài khoản mới
   * nào mở được khu vực phụ huynh.
   */
  pinHash: string | null;
  /** Chuỗi ngẫu nhiên đại diện cho phiên đăng nhập trên máy này */
  token: string;
  createdAt: string;
}

/* ------------------------------------------------------------------ */
/* Đọc / ghi danh sách tài khoản                                       */
/* ------------------------------------------------------------------ */

async function readAccounts(): Promise<LocalAccount[]> {
  try {
    const raw = await AsyncStorage.getItem(ACCOUNTS_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? (parsed as LocalAccount[]) : [];
  } catch {
    // Dữ liệu hỏng thì coi như chưa có tài khoản nào, hơn là làm app không mở được
    return [];
  }
}

async function writeAccounts(accounts: LocalAccount[]): Promise<void> {
  await AsyncStorage.setItem(ACCOUNTS_KEY, JSON.stringify(accounts));
}

/* ------------------------------------------------------------------ */
/* Băm và kiểm tra                                                     */
/* ------------------------------------------------------------------ */

async function hashSecret(secret: string): Promise<string> {
  const salt = randomBytes(SALT_BYTES);
  const hash = await pbkdf2Sha256(secret, salt, PBKDF2_ITERATIONS, HASH_BYTES);
  return `${HASH_PREFIX}$${PBKDF2_ITERATIONS}$${toHex(salt)}$${toHex(hash)}`;
}

async function verifySecret(secret: string, stored: string): Promise<boolean> {
  const parts = stored.split('$');
  if (parts.length !== 4 || parts[0] !== HASH_PREFIX) return false;

  const iterations = Number(parts[1]);
  if (!Number.isInteger(iterations) || iterations < 1 || iterations > 1_000_000) return false;

  try {
    const salt = fromHex(parts[2]);
    const expected = parts[3];
    const hash = await pbkdf2Sha256(secret, salt, iterations, expected.length / 2);
    return timingSafeEqual(toHex(hash), expected);
  } catch {
    return false;
  }
}

function newToken(): string {
  // Chuỗi ngẫu nhiên, không phải chữ ký: dữ liệu nằm trên máy người dùng nên
  // chữ ký cũng không ngăn được ai sửa AsyncStorage. Vai trò của nó chỉ là gắn
  // phiên đã lưu với đúng một tài khoản.
  return `local.${toHex(randomBytes(24))}`;
}

/* ------------------------------------------------------------------ */
/* Kiểm tra dữ liệu vào                                                */
/* ------------------------------------------------------------------ */

const USERNAME_RE = /^[a-z0-9._-]{3,24}$/;

function normalizeUsername(raw: string): string {
  return raw.trim().toLowerCase();
}

function validateUsername(username: string): string | null {
  if (!USERNAME_RE.test(username)) {
    return 'Tên đăng nhập cần 3-24 kí tự, chỉ gồm chữ thường, số, dấu . _ -';
  }
  return null;
}

function validatePassword(password: string): string | null {
  if (password.length < 6) return 'Mật khẩu cần ít nhất 6 kí tự.';
  return null;
}

function validatePin(pin: string): string | null {
  if (!/^\d{4}$/.test(pin)) return 'Mã PIN cần đúng 4 chữ số.';
  return null;
}

/** Họ và tên: cho phép chữ có dấu và khoảng trắng, khác hẳn tên đăng nhập */
function validateDisplayName(name: string): string | null {
  const trimmed = name.trim();
  if (trimmed.length < 2) return 'Họ và tên cần ít nhất 2 kí tự.';
  if (trimmed.length > 48) return 'Họ và tên không quá 48 kí tự.';
  return null;
}

function toSession(account: LocalAccount): AuthSession {
  return {
    userId: account.userId,
    username: account.username,
    displayName: account.displayName?.trim() || account.username,
    grade: sanitizeGrade(account.grade),
    avatar: sanitizeAvatar(account.avatar),
    role: account.role,
    hasPin: account.pinHash !== null,
    token: account.token,
  };
}

/* ------------------------------------------------------------------ */
/* Các hàm công khai — trùng chữ ký với lib/authApi.ts                 */
/* ------------------------------------------------------------------ */

export interface RegisterInput {
  username: string;
  password: string;
  /** Họ và tên hiển thị */
  displayName: string;
  /** Khối lớp 1-12 */
  grade?: number;
}

export async function registerAccountLocal(
  input: RegisterInput,
): Promise<SyncResult<AuthSession>> {
  const username = normalizeUsername(input.username);

  const usernameError = validateUsername(username);
  if (usernameError) return { ok: false, error: usernameError };
  const nameError = validateDisplayName(input.displayName);
  if (nameError) return { ok: false, error: nameError };
  const passwordError = validatePassword(input.password);
  if (passwordError) return { ok: false, error: passwordError };

  const accounts = await readAccounts();
  if (accounts.some((a) => a.username === username)) {
    return { ok: false, error: 'Tên đăng nhập này đã có người dùng trên máy.' };
  }

  const account: LocalAccount = {
    userId: `local-${toHex(randomBytes(8))}`,
    username,
    displayName: input.displayName.trim(),
    grade: sanitizeGrade(input.grade ?? DEFAULT_GRADE),
    avatar: DEFAULT_AVATAR,
    // Đăng ký không còn chọn vai trò: mọi tài khoản mới là học sinh, và khu vực
    // phụ huynh mở bằng mã PIN đặt sau trong Cài đặt.
    role: 'student',
    passwordHash: await hashSecret(input.password),
    pinHash: null,
    token: newToken(),
    createdAt: new Date().toISOString(),
  };

  await writeAccounts([...accounts, account]);
  return { ok: true, data: toSession(account) };
}

export async function loginAccountLocal(input: {
  username: string;
  password: string;
}): Promise<SyncResult<AuthSession>> {
  const username = normalizeUsername(input.username);
  const accounts = await readAccounts();
  const account = accounts.find((a) => a.username === username);

  // Cùng một câu báo lỗi cho "không có tài khoản" và "sai mật khẩu", để không
  // tiết lộ tên đăng nhập nào đang tồn tại.
  const wrong: SyncResult<AuthSession> = {
    ok: false,
    error: 'Tên đăng nhập hoặc mật khẩu không đúng.',
  };
  if (!account) return wrong;
  if (!(await verifySecret(input.password, account.passwordHash))) return wrong;

  // Cấp phiên mới mỗi lần đăng nhập, để đăng xuất trên máy này là hết hiệu lực
  const refreshed: LocalAccount = { ...account, token: newToken() };
  await writeAccounts(accounts.map((a) => (a.userId === account.userId ? refreshed : a)));
  return { ok: true, data: toSession(refreshed) };
}

async function findByToken(
  token: string,
): Promise<{ accounts: LocalAccount[]; account: LocalAccount } | null> {
  const accounts = await readAccounts();
  const account = accounts.find((a) => a.token === token);
  return account ? { accounts, account } : null;
}

export interface ProfilePatch {
  displayName?: string;
  grade?: number;
  avatar?: string;
}

/**
 * Cập nhật hồ sơ: họ tên, khối lớp, avatar.
 *
 * KHÔNG đổi được `username`: nó là ID đăng nhập, cũng là khoá tra tài khoản, và
 * màn hình Cài đặt hiện nó ở dạng chỉ đọc kèm icon khoá. Muốn đổi tên hiển thị
 * thì sửa `displayName` — đó mới là thứ hiện trên header.
 */
export async function updateProfileLocal(
  token: string,
  patch: ProfilePatch,
): Promise<SyncResult<AuthSession>> {
  if (patch.displayName !== undefined) {
    const error = validateDisplayName(patch.displayName);
    if (error) return { ok: false, error };
  }

  const found = await findByToken(token);
  if (!found) return { ok: false, error: 'Phiên đăng nhập đã hết hiệu lực.' };

  const updated: LocalAccount = {
    ...found.account,
    displayName:
      patch.displayName !== undefined
        ? patch.displayName.trim()
        : found.account.displayName,
    grade: patch.grade !== undefined ? sanitizeGrade(patch.grade) : found.account.grade,
    avatar:
      patch.avatar !== undefined ? sanitizeAvatar(patch.avatar) : found.account.avatar,
  };
  await writeAccounts(
    found.accounts.map((a) => (a.userId === updated.userId ? updated : a)),
  );
  return { ok: true, data: toSession(updated) };
}

export async function verifyPinLocal(
  token: string,
  pin: string,
): Promise<SyncResult<null>> {
  const found = await findByToken(token);
  if (!found) return { ok: false, error: 'Phiên đăng nhập đã hết hiệu lực.' };
  if (!found.account.pinHash) {
    return { ok: false, error: 'Tài khoản này chưa đặt mã PIN.' };
  }
  if (!(await verifySecret(pin, found.account.pinHash))) {
    return { ok: false, error: 'Mã PIN không đúng.' };
  }
  return { ok: true, data: null };
}

export async function changePinLocal(
  token: string,
  oldPin: string,
  newPin: string,
): Promise<SyncResult<null>> {
  const error = validatePin(newPin);
  if (error) return { ok: false, error };

  const found = await findByToken(token);
  if (!found) return { ok: false, error: 'Phiên đăng nhập đã hết hiệu lực.' };
  /*
   * KHÔNG còn chặn theo vai trò. Trước đây chỉ tài khoản `parent` mới đổi được
   * PIN, nhưng màn hình Đăng ký đã bỏ phần chọn vai trò nên mọi tài khoản mới
   * đều là `student` — giữ ràng buộc cũ thì không ai đặt được PIN và khu vực
   * phụ huynh thành ra không bao giờ mở được.
   */
  // Đã có PIN thì phải nhập đúng PIN cũ; chưa có thì cho đặt mới luôn
  if (found.account.pinHash && !(await verifySecret(oldPin, found.account.pinHash))) {
    return { ok: false, error: 'Mã PIN cũ không đúng.' };
  }

  const updated = { ...found.account, pinHash: await hashSecret(newPin) };
  await writeAccounts(
    found.accounts.map((a) => (a.userId === updated.userId ? updated : a)),
  );
  return { ok: true, data: null };
}

/** Số tài khoản đang có trên máy — dùng cho màn hình Cài đặt và bài kiểm thử */
export async function countLocalAccounts(): Promise<number> {
  return (await readAccounts()).length;
}

/** Xoá sạch tài khoản trên máy. Chỉ dùng trong kiểm thử. */
export async function clearLocalAccounts(): Promise<void> {
  await AsyncStorage.removeItem(ACCOUNTS_KEY);
}

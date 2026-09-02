import { Platform } from 'react-native';

import type { AuthSession, ProgressSyncPayload, SyncResult } from '../types';
import {
  changePinLocal,
  loginAccountLocal,
  registerAccountLocal,
  updateProfileLocal,
  verifyPinLocal,
  type ProfilePatch,
  type RegisterInput,
} from './localAuth';

export type { ProfilePatch, RegisterInput };

/**
 * Client gọi tới `api/auth` và `api/progress`.
 *
 * App chỉ dùng `fetch` và giữ session token — không giữ token Turso, không tự
 * chạy SQL. Nhờ vậy `WHERE user_id = ?` được server áp đặt chứ không phải do
 * client tự nguyện thêm vào.
 */
const configuredBase = process.env.EXPO_PUBLIC_PROGRESS_API_URL?.trim();

function apiBase(): string | null {
  if (configuredBase) return configuredBase.replace(/\/+$/, '');
  // Bản web cùng origin với serverless function
  if (Platform.OS === 'web') return '';
  return null;
}

/**
 * Có máy chủ đồng bộ hay không.
 *
 * `false` KHÔNG phải lỗi cấu hình: khi đó app tự chuyển sang Local Mode — tài
 * khoản và tiến độ lưu trong AsyncStorage của máy (xem `lib/localAuth.ts`).
 * Mọi hàm dưới đây tự chuyển hướng, nơi gọi không cần rẽ nhánh.
 */
export const isApiConfigured = apiBase() !== null;

const TIMEOUT_MS = 20_000;

interface RequestOptions {
  method: 'GET' | 'POST' | 'PUT';
  path: string;
  token?: string;
  body?: unknown;
}

async function callApi<T>(options: RequestOptions): Promise<SyncResult<T>> {
  const base = apiBase();
  if (base === null) {
    return { ok: false, error: 'Chưa cấu hình EXPO_PUBLIC_PROGRESS_API_URL.' };
  }

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), TIMEOUT_MS);

  try {
    const headers: Record<string, string> = {};
    if (options.body !== undefined) headers['Content-Type'] = 'application/json';
    if (options.token) headers.Authorization = `Bearer ${options.token}`;

    const response = await fetch(`${base}${options.path}`, {
      method: options.method,
      headers,
      body: options.body === undefined ? undefined : JSON.stringify(options.body),
      signal: controller.signal,
    });

    // Máy chủ có trả lời, nhưng có đúng là API của mình không? Server Metro lúc
    // `npx expo start` trả về index.html cho MỌI đường dẫn, kèm status 200 —
    // nếu không nhận ra chỗ này thì app cứ tưởng đã đăng nhập lỗi.
    const contentType = response.headers.get('content-type') ?? '';
    const looksLikeApi = contentType.includes('json');
    if (response.status === 404 || !looksLikeApi) {
      return {
        ok: false,
        error: 'Máy chủ này không có API đồng bộ.',
        endpointMissing: true,
      };
    }

    const data = (await response.json().catch(() => null)) as
      | (Record<string, unknown> & { error?: string })
      | null;

    if (!response.ok) {
      return {
        ok: false,
        error: data?.error ?? `Máy chủ trả về lỗi ${response.status}.`,
      };
    }
    return { ok: true, data: data as T };
  } catch (error) {
    const message =
      error instanceof Error && error.name === 'AbortError'
        ? 'Máy chủ phản hồi quá lâu, thử lại nhé.'
        : 'Không kết nối được tới máy chủ. Kiểm tra mạng giúp em.';
    return { ok: false, error: message };
  } finally {
    clearTimeout(timer);
  }
}

/* ------------------------------------------------------------------ */
/* Xác thực                                                            */
/* ------------------------------------------------------------------ */

export async function registerAccount(
  input: RegisterInput,
): Promise<SyncResult<AuthSession>> {
  if (!isApiConfigured) return registerAccountLocal(input);

  const result = await callApi<{ session: AuthSession }>({
    method: 'POST',
    path: '/api/auth?action=register',
    body: input,
  });
  // Máy chủ không có API (vd đang chạy Metro ở localhost) → dùng Local Mode
  if (!result.ok && result.endpointMissing) return registerAccountLocal(input);
  return result.ok ? { ok: true, data: result.data.session } : result;
}

export async function loginAccount(input: {
  username: string;
  password: string;
}): Promise<SyncResult<AuthSession>> {
  if (!isApiConfigured) return loginAccountLocal(input);

  const result = await callApi<{ session: AuthSession }>({
    method: 'POST',
    path: '/api/auth?action=login',
    body: input,
  });
  if (!result.ok && result.endpointMissing) return loginAccountLocal(input);
  return result.ok ? { ok: true, data: result.data.session } : result;
}

/* ------------------------------------------------------------------ */
/* Tiến độ                                                             */
/* ------------------------------------------------------------------ */

export async function fetchProgress(
  token: string,
): Promise<SyncResult<ProgressSyncPayload | null>> {
  // Local Mode: không có gì trên máy chủ để kéo về, nhưng đây KHÔNG phải lỗi —
  // trả thành công với dữ liệu rỗng để syncEngine không báo đỏ.
  if (!isApiConfigured) return { ok: true, data: null };

  const result = await callApi<{ progress: ProgressSyncPayload | null }>({
    method: 'GET',
    path: '/api/progress',
    token,
  });
  // Không có API đồng bộ thì coi như không có gì để kéo — không phải lỗi
  if (!result.ok && result.endpointMissing) return { ok: true, data: null };
  return result.ok ? { ok: true, data: result.data.progress ?? null } : result;
}

export async function pushProgress(
  token: string,
  progress: ProgressSyncPayload,
): Promise<SyncResult<null>> {
  // Local Mode: tiến độ đã nằm sẵn trong AsyncStorage nên coi như đẩy xong.
  if (!isApiConfigured) return { ok: true, data: null };

  const result = await callApi<unknown>({
    method: 'PUT',
    path: '/api/progress',
    token,
    body: progress,
  });
  // Tiến độ đã nằm trong AsyncStorage nên coi như đẩy xong
  if (!result.ok && result.endpointMissing) return { ok: true, data: null };
  return result.ok ? { ok: true, data: null } : result;
}

/* ------------------------------------------------------------------ */
/* Tài khoản                                                           */
/* ------------------------------------------------------------------ */

/**
 * Cập nhật hồ sơ (họ tên, khối lớp, avatar). Trả về phiên đã cập nhật.
 *
 * Trả về cả `AuthSession` chứ không chỉ trường vừa đổi: server là nơi chốt giá
 * trị cuối (cắt bớt khoảng trắng, kẹp khối lớp về 1-12), nên lấy nguyên bản của
 * server chắc chắn hơn là tự đoán ở client.
 */
export async function updateProfile(
  token: string,
  patch: ProfilePatch,
): Promise<SyncResult<AuthSession>> {
  if (!isApiConfigured) return updateProfileLocal(token, patch);

  const result = await callApi<{ session: Omit<AuthSession, 'token'> }>({
    method: 'POST',
    path: '/api/account?action=set-profile',
    token,
    body: patch,
  });
  if (!result.ok && result.endpointMissing) return updateProfileLocal(token, patch);
  // Token không nằm trong phản hồi (server không cấp lại), nên ghép lại ở đây
  return result.ok ? { ok: true, data: { ...result.data.session, token } } : result;
}

/** Kiểm tra mã PIN phụ huynh (xác thực ở server) */
export async function verifyParentPinRemote(
  token: string,
  pin: string,
): Promise<SyncResult<null>> {
  if (!isApiConfigured) return verifyPinLocal(token, pin);

  const result = await callApi<unknown>({
    method: 'POST',
    path: '/api/account?action=verify-pin',
    token,
    body: { pin },
  });
  if (!result.ok && result.endpointMissing) return verifyPinLocal(token, pin);
  return result.ok ? { ok: true, data: null } : result;
}

/** Đổi mã PIN phụ huynh */
export async function changeParentPin(
  token: string,
  oldPin: string,
  newPin: string,
): Promise<SyncResult<null>> {
  if (!isApiConfigured) return changePinLocal(token, oldPin, newPin);

  const result = await callApi<unknown>({
    method: 'POST',
    path: '/api/account?action=change-pin',
    token,
    body: { oldPin, newPin },
  });
  if (!result.ok && result.endpointMissing) return changePinLocal(token, oldPin, newPin);
  return result.ok ? { ok: true, data: null } : result;
}

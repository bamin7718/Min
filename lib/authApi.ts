import { Platform } from 'react-native';

import type { AuthSession, ProgressSyncPayload, SyncResult, UserRole } from '../types';

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

export async function registerAccount(input: {
  username: string;
  password: string;
  role: UserRole;
  pin?: string;
}): Promise<SyncResult<AuthSession>> {
  const result = await callApi<{ session: AuthSession }>({
    method: 'POST',
    path: '/api/auth?action=register',
    body: input,
  });
  return result.ok ? { ok: true, data: result.data.session } : result;
}

export async function loginAccount(input: {
  username: string;
  password: string;
}): Promise<SyncResult<AuthSession>> {
  const result = await callApi<{ session: AuthSession }>({
    method: 'POST',
    path: '/api/auth?action=login',
    body: input,
  });
  return result.ok ? { ok: true, data: result.data.session } : result;
}

/* ------------------------------------------------------------------ */
/* Tiến độ                                                             */
/* ------------------------------------------------------------------ */

export async function fetchProgress(
  token: string,
): Promise<SyncResult<ProgressSyncPayload | null>> {
  const result = await callApi<{ progress: ProgressSyncPayload | null }>({
    method: 'GET',
    path: '/api/progress',
    token,
  });
  return result.ok ? { ok: true, data: result.data.progress ?? null } : result;
}

export async function pushProgress(
  token: string,
  progress: ProgressSyncPayload,
): Promise<SyncResult<null>> {
  const result = await callApi<unknown>({
    method: 'PUT',
    path: '/api/progress',
    token,
    body: progress,
  });
  return result.ok ? { ok: true, data: null } : result;
}

/* ------------------------------------------------------------------ */
/* Tài khoản                                                           */
/* ------------------------------------------------------------------ */

/** Đổi tên hiển thị. Trả về tên đã được server chấp nhận. */
export async function renameAccount(
  token: string,
  username: string,
): Promise<SyncResult<string>> {
  const result = await callApi<{ username: string }>({
    method: 'POST',
    path: '/api/account?action=rename',
    token,
    body: { username },
  });
  return result.ok ? { ok: true, data: result.data.username } : result;
}

/** Kiểm tra mã PIN phụ huynh (xác thực ở server) */
export async function verifyParentPinRemote(
  token: string,
  pin: string,
): Promise<SyncResult<null>> {
  const result = await callApi<unknown>({
    method: 'POST',
    path: '/api/account?action=verify-pin',
    token,
    body: { pin },
  });
  return result.ok ? { ok: true, data: null } : result;
}

/** Đổi mã PIN phụ huynh */
export async function changeParentPin(
  token: string,
  oldPin: string,
  newPin: string,
): Promise<SyncResult<null>> {
  const result = await callApi<unknown>({
    method: 'POST',
    path: '/api/account?action=change-pin',
    token,
    body: { oldPin, newPin },
  });
  return result.ok ? { ok: true, data: null } : result;
}

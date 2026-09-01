import { Platform } from 'react-native';

import { APP_VERSION, compareVersions } from '../constants/version';

/**
 * Kiểm tra xem có bản cập nhật mới hay không.
 *
 * Nguồn dữ liệu, theo thứ tự ưu tiên:
 *  1. `EXPO_PUBLIC_UPDATE_SERVER_URL` — một endpoint trả JSON
 *  2. `EXPO_PUBLIC_PROGRESS_API_URL` + `/api/check-version` — đọc GitHub Releases
 *  3. Bản web: `/api/check-version` cùng origin
 *
 * JSON chấp nhận cả snake_case lẫn camelCase, và cả hai cách gọi tên link tải:
 * `{ version, apk_url | apkUrl | downloadUrl, force_update, release_notes }`
 */

export interface UpdateInfo {
  version: string;
  apkUrl: string;
  forceUpdate: boolean;
  releaseNotes: string;
}

export type UpdateStatus =
  /** Đang dùng bản mới nhất */
  | 'up-to-date'
  /** Có bản mới hơn */
  | 'update-available'
  /** Chưa cấu hình nguồn cập nhật */
  | 'not-configured'
  /** Không hỏi được máy chủ (mất mạng, lỗi...) */
  | 'error';

export interface UpdateCheckResult {
  status: UpdateStatus;
  /** Phiên bản đang chạy */
  current: string;
  /** Thông tin bản mới, chỉ có khi status là 'update-available' */
  latest?: UpdateInfo;
  error?: string;
}

const TIMEOUT_MS = 12_000;

function endpoint(): string | null {
  const direct = process.env.EXPO_PUBLIC_UPDATE_SERVER_URL?.trim();
  if (direct) return direct;

  // Mặc định hỏi /api/check-version: nó đọc thẳng GitHub Releases nên workflow
  // build xong là thông tin tự đúng. Còn /api/version đọc bảng app_version trên
  // Turso, phải cập nhật tay sau mỗi lần phát hành nên dễ bị bỏ quên.
  const apiBase = process.env.EXPO_PUBLIC_PROGRESS_API_URL?.trim();
  if (apiBase) return `${apiBase.replace(/\/+$/, '')}/api/check-version`;

  // Bản web nằm cùng origin với serverless function
  if (Platform.OS === 'web') return '/api/check-version';
  return null;
}

export const isUpdateCheckConfigured = endpoint() !== null;

function parseInfo(raw: unknown): UpdateInfo | null {
  if (typeof raw !== 'object' || raw === null) return null;
  const data = raw as Record<string, unknown>;

  const version = typeof data.version === 'string' ? data.version.trim() : '';
  if (!/^\d+(\.\d+)*$/.test(version.replace(/^v/i, ''))) return null;

  // Chấp nhận cả ba cách đặt tên: api/version.ts trả `apk_url`, còn
  // api/check-version.ts (đọc từ GitHub Releases) trả `downloadUrl`.
  const apkUrl =
    typeof data.apk_url === 'string'
      ? data.apk_url
      : typeof data.apkUrl === 'string'
        ? data.apkUrl
        : typeof data.downloadUrl === 'string'
          ? data.downloadUrl
          : typeof data.download_url === 'string'
            ? data.download_url
            : '';

  const notes =
    typeof data.release_notes === 'string'
      ? data.release_notes
      : typeof data.releaseNotes === 'string'
        ? data.releaseNotes
        : '';

  const force = data.force_update ?? data.forceUpdate;

  return {
    version: version.replace(/^v/i, ''),
    apkUrl: apkUrl.trim(),
    forceUpdate: force === true || force === 1 || force === '1' || force === 'true',
    releaseNotes: notes.trim(),
  };
}

/** Hỏi máy chủ xem có bản mới không. Hàm này không bao giờ ném lỗi. */
export async function checkAppUpdate(): Promise<UpdateCheckResult> {
  const url = endpoint();
  if (!url) {
    return {
      status: 'not-configured',
      current: APP_VERSION,
      error: 'Chưa cấu hình EXPO_PUBLIC_UPDATE_SERVER_URL.',
    };
  }

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), TIMEOUT_MS);

  try {
    const response = await fetch(url, {
      headers: { Accept: 'application/json' },
      signal: controller.signal,
    });
    if (!response.ok) {
      return {
        status: 'error',
        current: APP_VERSION,
        error: `Máy chủ trả về lỗi ${response.status}.`,
      };
    }

    const info = parseInfo(await response.json().catch(() => null));
    if (!info) {
      return {
        status: 'error',
        current: APP_VERSION,
        error: 'Máy chủ trả về dữ liệu phiên bản không hợp lệ.',
      };
    }

    // Chỉ báo cập nhật khi thực sự MỚI HƠN, tránh làm phiền khi server
    // vô tình khai phiên bản cũ hơn.
    const isNewer = compareVersions(info.version, APP_VERSION) > 0;
    return isNewer
      ? { status: 'update-available', current: APP_VERSION, latest: info }
      : { status: 'up-to-date', current: APP_VERSION };
  } catch (error) {
    const message =
      error instanceof Error && error.name === 'AbortError'
        ? 'Máy chủ phản hồi quá lâu.'
        : 'Không kết nối được tới máy chủ cập nhật.';
    return { status: 'error', current: APP_VERSION, error: message };
  } finally {
    clearTimeout(timer);
  }
}

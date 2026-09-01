/**
 * Máy chủ cập nhật ngầm (OTA) — cài đặt giao thức Expo Updates phiên bản 1.
 *
 * App đã cài gọi tới đây mỗi lần mở. Nếu có bản JavaScript mới hợp với phần
 * native của máy đó thì trả về manifest; app tải bundle rồi chạy bản mới mà
 * KHÔNG phải cài lại APK.
 *
 * Cách chia việc:
 *  - GitHub Actions chạy `expo export`, tự băm từng tệp rồi ghi sẵn manifest
 *    hoàn chỉnh vào nhánh `ota` của repo (một tệp cho mỗi runtimeVersion).
 *  - Hàm này chỉ việc tải manifest đó về, bọc đúng định dạng multipart và trả
 *    kèm các header mà giao thức đòi hỏi.
 *
 * Đặt phần băm tệp ở CI chứ không ở đây vì CI có sẵn tệp trong tay; hàm
 * serverless thì không, và nếu phải tải hàng chục tệp về để băm thì vừa chậm
 * vừa dễ vượt giới hạn thời gian chạy.
 */
export const config = { runtime: 'edge' };

const REPO = 'bamin7718/Min';
/** Nhánh chứa bundle đã xuất và các tệp manifest */
const OTA_BRANCH = 'ota';
const OTA_BASE = `https://raw.githubusercontent.com/${REPO}/${OTA_BRANCH}`;
const TIMEOUT_MS = 8_000;

/** Chỉ nhận runtimeVersion trông hợp lệ, tránh bị ghép đường dẫn tuỳ ý */
const RUNTIME_VERSION_RE = /^[A-Za-z0-9][A-Za-z0-9._-]{0,63}$/;
const PLATFORMS = new Set(['android', 'ios']);

/**
 * Lý do không có bản mới, dùng cho header chẩn đoán.
 *
 * PHẢI là chuỗi ASCII: giá trị header HTTP chỉ nhận ký tự ISO-8859-1, đặt tiếng
 * Việt có dấu vào đây thì `new Response` ném lỗi ngay và phản hồi "không có bản
 * mới" bình thường sẽ biến thành lỗi 500.
 */
type NoUpdateReason =
  /** Chưa từng đẩy bản OTA nào cho runtimeVersion này */
  | 'no-manifest-for-runtime'
  /** Kho manifest trả về mã lỗi */
  | 'manifest-store-error'
  /** Manifest có runtimeVersion khác với máy đang hỏi */
  | 'runtime-mismatch'
  /** Manifest thiếu trường bắt buộc */
  | 'manifest-invalid'
  /** Kho manifest phản hồi quá lâu */
  | 'manifest-store-timeout'
  /** Không đọc được kho manifest */
  | 'manifest-store-unreachable';

function noUpdate(reason: NoUpdateReason): Response {
  // 204 là cách giao thức báo "không có bản nào mới cho máy này"
  return new Response(null, {
    status: 204,
    headers: {
      'expo-protocol-version': '1',
      'expo-sfv-version': '0',
      'cache-control': 'private, max-age=0',
      'x-no-update-reason': reason,
    },
  });
}

function errorResponse(message: string, status: number): Response {
  return new Response(JSON.stringify({ error: message }), {
    status,
    headers: {
      'content-type': 'application/json; charset=utf-8',
      'cache-control': 'private, max-age=0',
    },
  });
}

export default async function handler(request: Request): Promise<Response> {
  const platform =
    request.headers.get('expo-platform') ??
    new URL(request.url).searchParams.get('platform') ??
    '';
  const runtimeVersion =
    request.headers.get('expo-runtime-version') ??
    new URL(request.url).searchParams.get('runtime-version') ??
    '';

  if (!PLATFORMS.has(platform)) {
    return errorResponse(`Thiếu hoặc sai expo-platform: "${platform}".`, 400);
  }
  if (!RUNTIME_VERSION_RE.test(runtimeVersion)) {
    return errorResponse(`Thiếu hoặc sai expo-runtime-version.`, 400);
  }

  // Tên tệp do CI sinh ra: manifest-<platform>-<runtimeVersion>.json
  const manifestUrl = `${OTA_BASE}/manifests/manifest-${platform}-${runtimeVersion}.json`;

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), TIMEOUT_MS);
  try {
    const response = await fetch(manifestUrl, {
      headers: { Accept: 'application/json' },
      signal: controller.signal,
    });

    // Chưa từng đẩy bản OTA nào cho runtimeVersion này — bình thường, không phải lỗi
    if (response.status === 404) return noUpdate('no-manifest-for-runtime');
    if (!response.ok) return noUpdate('manifest-store-error');

    const manifest = (await response.json()) as Record<string, unknown>;

    // Chốt chặn cuối: manifest phải đúng runtimeVersion đang hỏi, nếu không thì
    // máy sẽ tải một bản JavaScript không hợp với phần native của nó rồi crash.
    if (manifest.runtimeVersion !== runtimeVersion) {
      return noUpdate('runtime-mismatch');
    }
    if (typeof manifest.id !== 'string' || typeof manifest.launchAsset !== 'object') {
      return noUpdate('manifest-invalid');
    }

    // Giao thức cho phép trả thẳng JSON, nhưng multipart là dạng chuẩn và cũng là
    // dạng để dành chỗ cho phần chữ ký sau này.
    const boundary = 'expo-updates-boundary';
    const body =
      `--${boundary}\r\n` +
      'content-disposition: form-data; name="manifest"\r\n' +
      'content-type: application/json; charset=utf-8\r\n\r\n' +
      `${JSON.stringify(manifest)}\r\n` +
      `--${boundary}--\r\n`;

    return new Response(body, {
      status: 200,
      headers: {
        'content-type': `multipart/mixed; boundary=${boundary}`,
        'expo-protocol-version': '1',
        'expo-sfv-version': '0',
        // Máy phải hỏi lại mỗi lần mở app, không được dùng bản đã nhớ
        'cache-control': 'private, max-age=0',
      },
    });
  } catch (error) {
    const aborted = error instanceof Error && error.name === 'AbortError';
    return noUpdate(aborted ? 'manifest-store-timeout' : 'manifest-store-unreachable');
  } finally {
    clearTimeout(timer);
  }
}

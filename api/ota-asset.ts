/**
 * Phục vụ từng tệp của bản cập nhật ngầm (bundle JavaScript và hình ảnh).
 *
 * Tệp thật nằm ở nhánh `ota` của repo; hàm này chỉ lấy về rồi trả lại. Vì sao
 * không cho app tải thẳng từ GitHub:
 *  - Mọi đường dẫn trong manifest đều cùng một tên miền, dễ theo dõi và dễ đổi
 *    nguồn lưu trữ sau này mà không phải phát hành APK mới.
 *  - Mạng ở một số nơi chặn raw.githubusercontent.com.
 *  - Tên tệp có sẵn mã băm nên nội dung không bao giờ đổi; nhờ đó CDN của Vercel
 *    cache được vĩnh viễn, chỉ máy đầu tiên là thực sự đi lấy từ GitHub.
 */
export const config = { runtime: 'edge' };

const REPO = 'bamin7718/Min';
const OTA_BRANCH = 'ota';
const OTA_BASE = `https://raw.githubusercontent.com/${REPO}/${OTA_BRANCH}`;
const TIMEOUT_MS = 20_000;

/** Chỉ nhận đúng dạng đường dẫn do `expo export` sinh ra */
const SAFE_PATH_RE = /^[A-Za-z0-9][A-Za-z0-9._/-]{0,199}$/;
const RUNTIME_VERSION_RE = /^[A-Za-z0-9][A-Za-z0-9._-]{0,63}$/;

function bad(message: string): Response {
  return new Response(JSON.stringify({ error: message }), {
    status: 400,
    headers: { 'content-type': 'application/json; charset=utf-8' },
  });
}

export default async function handler(request: Request): Promise<Response> {
  const params = new URL(request.url).searchParams;
  const runtimeVersion = params.get('rv') ?? '';
  const filePath = params.get('p') ?? '';

  if (!RUNTIME_VERSION_RE.test(runtimeVersion)) return bad('Thiếu hoặc sai tham số rv.');
  // Chặn đi ngược thư mục: nếu không, ai đó có thể lấy tệp bất kỳ trên nhánh ota
  if (!SAFE_PATH_RE.test(filePath) || filePath.includes('..')) {
    return bad('Thiếu hoặc sai tham số p.');
  }

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), TIMEOUT_MS);
  try {
    const upstream = await fetch(`${OTA_BASE}/${runtimeVersion}/${filePath}`, {
      signal: controller.signal,
    });

    if (!upstream.ok || !upstream.body) {
      return new Response(null, { status: upstream.status === 404 ? 404 : 502 });
    }

    return new Response(upstream.body, {
      status: 200,
      headers: {
        // Tên tệp có mã băm nên nội dung là bất biến — cache thoải mái
        'cache-control': 'public, max-age=31536000, s-maxage=31536000, immutable',
        'content-type': 'application/octet-stream',
      },
    });
  } catch (error) {
    const aborted = error instanceof Error && error.name === 'AbortError';
    return new Response(null, { status: aborted ? 504 : 502 });
  } finally {
    clearTimeout(timer);
  }
}

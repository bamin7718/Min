/**
 * Phiên bản mới nhất, đọc trực tiếp từ GitHub Releases.
 *
 * Khác `api/version.ts` ở chỗ: file đó đọc bảng `app_version` trên Turso (phải
 * cập nhật tay sau mỗi lần phát hành), còn file này lấy thẳng từ GitHub nên
 * workflow build xong là thông tin tự đúng, không cần thao tác gì thêm.
 *
 * Trả về cả `version`/`downloadUrl`/`releaseNotes` (đúng tên trong yêu cầu) và
 * `apk_url`/`release_notes`/`force_update` để `lib/updateChecker.ts` đọc được
 * mà không cần biết nó đang hỏi endpoint nào.
 */
export const config = { runtime: 'edge' };

const REPO = 'bamin7718/Min';
const RELEASES_API = `https://api.github.com/repos/${REPO}/releases/latest`;
/** Link tải cố định — đi qua /api/download-apk để sau này đổi nguồn được */
const DOWNLOAD_URL = 'https://min-silk-iota.vercel.app/api/download-apk';
const APK_NAME = 'app-release.apk';
const TIMEOUT_MS = 8_000;

function json(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: {
      'Content-Type': 'application/json; charset=utf-8',
      // GitHub API giới hạn 60 lượt/giờ cho request không token, nên phải cache.
      'Cache-Control': 'public, max-age=300, s-maxage=300',
    },
  });
}

interface GithubAsset {
  name?: unknown;
  browser_download_url?: unknown;
}

interface GithubRelease {
  tag_name?: unknown;
  name?: unknown;
  body?: unknown;
  draft?: unknown;
  prerelease?: unknown;
  published_at?: unknown;
  assets?: unknown;
}

export default async function handler(): Promise<Response> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), TIMEOUT_MS);

  try {
    const response = await fetch(RELEASES_API, {
      headers: {
        Accept: 'application/vnd.github+json',
        // GitHub từ chối request không có User-Agent
        'User-Agent': 'lop3-study-game-version-check',
      },
      signal: controller.signal,
    });

    if (response.status === 404) {
      return json({ error: 'Repo chưa có bản phát hành nào.' }, 404);
    }
    if (!response.ok) {
      return json({ error: `GitHub trả về lỗi ${response.status}.` }, 502);
    }

    const release = (await response.json()) as GithubRelease;

    const tag = typeof release.tag_name === 'string' ? release.tag_name : '';
    const version = tag.replace(/^v/i, '').trim();
    if (!/^\d+(\.\d+)*$/.test(version)) {
      return json({ error: `Tag "${tag}" không phải dạng phiên bản.` }, 502);
    }

    // Ưu tiên đúng file app-release.apk; không có thì lấy file .apk đầu tiên
    const assets = Array.isArray(release.assets) ? (release.assets as GithubAsset[]) : [];
    const apkAsset =
      assets.find((a) => a.name === APK_NAME) ??
      assets.find((a) => typeof a.name === 'string' && a.name.endsWith('.apk'));
    const assetUrl =
      apkAsset && typeof apkAsset.browser_download_url === 'string'
        ? apkAsset.browser_download_url
        : null;

    const notes = typeof release.body === 'string' ? release.body.trim() : '';

    return json({
      // Tên theo yêu cầu
      version,
      downloadUrl: DOWNLOAD_URL,
      releaseNotes: notes,
      // Tên mà lib/updateChecker.ts đọc
      apk_url: DOWNLOAD_URL,
      release_notes: notes,
      // Không bắt buộc cập nhật: chỉ bật khi thật sự cần chặn bản cũ, và bật
      // bằng bảng app_version trên Turso (api/version.ts) chứ không bằng GitHub.
      force_update: false,
      // Thông tin phụ để soi khi cần
      tag,
      assetUrl,
      publishedAt: typeof release.published_at === 'string' ? release.published_at : null,
      hasApk: assetUrl !== null,
    });
  } catch (error) {
    const aborted = error instanceof Error && error.name === 'AbortError';
    return json(
      { error: aborted ? 'GitHub phản hồi quá lâu.' : 'Không hỏi được GitHub.' },
      504,
    );
  } finally {
    clearTimeout(timer);
  }
}

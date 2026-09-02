/**
 * Đường dẫn tải APK CỐ ĐỊNH.
 *
 * `https://<domain>/api/download-apk` chuyển hướng 302 sang file APK của bản
 * phát hành mới nhất trên GitHub Release.
 *
 * Vì sao cần một lớp chuyển hướng thay vì cho app trỏ thẳng vào GitHub:
 *  - Đường dẫn trong APK đã cài KHÔNG sửa được nữa. Nếu sau này chuyển sang
 *    nguồn tải khác (S3, R2, server riêng), chỉ cần đổi ở đây là những máy cũ
 *    vẫn tải được bản mới.
 *  - Nếu đổi tên repo hoặc tên file APK, app cũ cũng không bị đứt link.
 */
export const config = { runtime: 'edge' };

/**
 * Nguồn tải thật. Đổi nguồn thì chỉ sửa đúng hằng số này.
 *
 * Tên file đổi từ `app-release.apk` sang `min-eg-app.apk` ở bản 1.0.8, phải khớp
 * với `files:` trong `.github/workflows/build-apk.yml` — lệch là nút tải trong
 * app trả 404 mà KHÔNG có gì báo.
 *
 * Các release cũ (v1.0.1) vẫn mang tên file cũ, nên link này chỉ hoạt động sau
 * khi có một release mới dùng tên mới.
 */
const LATEST_APK_URL =
  'https://github.com/bamin7718/Min/releases/latest/download/min-eg-app.apk';

export default function handler(): Response {
  return new Response(null, {
    status: 302,
    headers: {
      Location: LATEST_APK_URL,
      // Không cache lâu: bản phát hành mới phải có hiệu lực ngay. 5 phút đủ để
      // chặn việc nhiều máy bấm cùng lúc dội hết vào GitHub.
      'Cache-Control': 'public, max-age=300',
    },
  });
}

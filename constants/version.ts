/**
 * Phiên bản ứng dụng.
 *
 * Phải khớp với `version` trong `app.json` và `package.json`. Bộ kiểm tra cập
 * nhật so hằng số này với phiên bản mới nhất mà máy chủ báo về.
 */
export const APP_VERSION = '1.0.7';

/**
 * So sánh hai chuỗi phiên bản dạng "1.0.1".
 * Trả về số âm nếu a < b, 0 nếu bằng, số dương nếu a > b.
 *
 * So từng phần theo SỐ chứ không so chuỗi — nếu so chuỗi thì "1.0.10" lại bị
 * coi là nhỏ hơn "1.0.9".
 */
export function compareVersions(a: string, b: string): number {
  const toParts = (value: string): number[] =>
    value
      .trim()
      .replace(/^v/i, '')
      .split('.')
      .map((part) => {
        const n = Number.parseInt(part, 10);
        return Number.isFinite(n) ? n : 0;
      });

  const left = toParts(a);
  const right = toParts(b);
  const length = Math.max(left.length, right.length);

  for (let i = 0; i < length; i += 1) {
    const diff = (left[i] ?? 0) - (right[i] ?? 0);
    if (diff !== 0) return diff;
  }
  return 0;
}

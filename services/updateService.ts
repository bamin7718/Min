import {
  applyOta,
  checkOta,
  downloadOta,
  isOtaSupported,
  runningUpdateLabel,
} from '../lib/otaUpdates';

/**
 * Lớp dịch vụ cập nhật trong app (OTA) mà các màn hình gọi tới.
 *
 * Phần nói chuyện với `expo-updates` nằm ở `lib/otaUpdates.ts`; file này chỉ đặt
 * tên theo nghiệp vụ và thêm phần giả lập cho môi trường phát triển. Cố ý KHÔNG
 * chép lại logic sang đây: hai bản sao sẽ lệch nhau ngay lần sửa đầu tiên.
 */

export type UpdateOutcome =
  /** Có bản mới, chờ người dùng đồng ý tải */
  | 'available'
  /** Đang dùng bản mới nhất */
  | 'up-to-date'
  /** Môi trường này không cập nhật ngầm được (bản web, Expo Go, chế độ dev) */
  | 'unavailable'
  /** Bản giả lập để thử giao diện trong lúc phát triển */
  | 'demo'
  /** Hỏi máy chủ không được */
  | 'error';

export interface UpdateCheck {
  outcome: UpdateOutcome;
  error?: string;
}

/**
 * Bật giả lập để xem thử hộp thoại cập nhật trong lúc phát triển.
 *
 * Mặc định TẮT. Nếu bật mặc định thì mỗi lần Metro nạp lại mã là hộp thoại lại
 * nhảy ra, đúng cái làm đứt đoạn việc lập trình mà ta muốn tránh. Muốn xem thì
 * đặt `EXPO_PUBLIC_OTA_DEMO=1` trong .env rồi chạy `npx expo start -c`.
 */
const DEMO_MODE = process.env.EXPO_PUBLIC_OTA_DEMO === '1';

/** Có đang ở chế độ phát triển (Metro) hay không */
function isDev(): boolean {
  return typeof __DEV__ !== 'undefined' && __DEV__ === true;
}

/**
 * Kiểm tra xem có bản cập nhật trong app nào mới không.
 *
 * Gọi ngay sau khi đăng nhập thành công. Không bao giờ ném lỗi.
 */
export async function checkForInAppUpdate(): Promise<UpdateCheck> {
  if (isDev() || !isOtaSupported()) {
    // Trong lúc phát triển, Metro đã lo việc nạp lại mã nên không có gì để cập nhật
    return { outcome: DEMO_MODE ? 'demo' : 'unavailable' };
  }

  const result = await checkOta();
  if (result.status === 'available') return { outcome: 'available' };
  if (result.status === 'up-to-date') return { outcome: 'up-to-date' };
  if (result.status === 'unsupported') return { outcome: 'unavailable' };
  return { outcome: 'error', error: result.error };
}

export interface ApplyResult {
  ok: boolean;
  /** Câu báo cho người dùng khi không thành công */
  error?: string;
}

/**
 * Tải gói cập nhật rồi mở lại app để chạy bản mới.
 *
 * Thành công thì app khởi động lại nên phần gọi sau đó không chạy tới.
 */
export async function downloadAndApplyUpdate(): Promise<ApplyResult> {
  if (isDev() || !isOtaSupported()) {
    // Giả lập một nhịp tải để thấy được trạng thái "Đang tải bản mới..."
    await new Promise((resolve) => setTimeout(resolve, 1200));
    return {
      ok: false,
      error: 'Đây là bản giả lập trong lúc phát triển — chưa có gói cập nhật thật để tải.',
    };
  }

  const downloaded = await downloadOta();
  if (downloaded.status === 'error') {
    return { ok: false, error: downloaded.error ?? 'Tải bản cập nhật thất bại.' };
  }
  if (downloaded.status !== 'downloaded') {
    // Máy chủ hết bản mới giữa lúc tải: coi như đã ở bản mới nhất
    return { ok: true };
  }

  const reloaded = await applyOta();
  return reloaded
    ? { ok: true }
    : {
        ok: false,
        error: 'Đã tải xong nhưng chưa mở lại được. Em đóng rồi mở lại app nhé!',
      };
}

/** Nhãn bản đang chạy, hiện ở màn hình Cài đặt */
export { runningUpdateLabel };

/** Có đang ở chế độ giả lập không — dùng để hiện nhãn "bản thử" trên hộp thoại */
export function isDemoUpdate(): boolean {
  return DEMO_MODE && isDev();
}

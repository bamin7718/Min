import * as Updates from 'expo-updates';

/**
 * Cập nhật ngầm (OTA) — tải bản mới mà KHÔNG phải cài lại APK.
 *
 * Chỉ đẩy được phần JavaScript và hình ảnh: đề bài mới, sửa giao diện, sửa luật
 * chơi. Thay đổi chạm vào phần native (thêm thư viện mới) thì vẫn phải tải APK,
 * và `runtimeVersion` theo chính sách fingerprint sẽ tự chặn: máy cũ không nhận
 * bản OTA không hợp thay vì nhận rồi crash.
 *
 * Mọi hàm ở đây KHÔNG BAO GIỜ ném lỗi. Cập nhật là tính năng phụ — hỏng thì app
 * vẫn phải chạy bằng bản đang có.
 */

export type OtaStatus =
  /** Không chạy được ở môi trường này (bản web, Expo Go, chế độ dev) */
  | 'unsupported'
  /** Đang dùng bản mới nhất */
  | 'up-to-date'
  /** Có bản mới, chưa tải */
  | 'available'
  /** Đã tải xong, chờ khởi động lại để áp dụng */
  | 'downloaded'
  /** Hỏi máy chủ không được */
  | 'error';

export interface OtaCheckResult {
  status: OtaStatus;
  error?: string;
}

/**
 * OTA chỉ hoạt động trên bản đã build (APK/IPA).
 *
 * `Updates.isEnabled` là `false` khi chạy `npx expo start` hoặc trên bản web —
 * lúc đó Metro đã lo việc nạp lại mã, không có gì để cập nhật.
 */
export function isOtaSupported(): boolean {
  try {
    return Updates.isEnabled === true;
  } catch {
    return false;
  }
}

/** Mã định danh ngắn của bản đang chạy, để hiện trong màn hình Cài đặt */
export function runningUpdateLabel(): string {
  try {
    if (!Updates.isEnabled) return 'Bản gốc trong APK';
    if (Updates.isEmbeddedLaunch) return 'Bản gốc trong APK';
    const id = Updates.updateId;
    return id ? `Bản cập nhật ${id.slice(0, 8)}` : 'Bản cập nhật đã tải';
  } catch {
    return 'Bản gốc trong APK';
  }
}

/** Hỏi máy chủ xem có bản cập nhật ngầm nào mới không */
export async function checkOta(): Promise<OtaCheckResult> {
  if (!isOtaSupported()) return { status: 'unsupported' };

  try {
    const result = await Updates.checkForUpdateAsync();
    return { status: result.isAvailable ? 'available' : 'up-to-date' };
  } catch (error) {
    return {
      status: 'error',
      error: error instanceof Error ? error.message : 'Không hỏi được máy chủ.',
    };
  }
}

/**
 * Tải bản cập nhật về máy. Chưa áp dụng ngay — người dùng bấm nút mới khởi động
 * lại, để không cắt ngang lúc học sinh đang làm dở bài.
 */
export async function downloadOta(): Promise<OtaCheckResult> {
  if (!isOtaSupported()) return { status: 'unsupported' };

  try {
    const result = await Updates.fetchUpdateAsync();
    return { status: result.isNew ? 'downloaded' : 'up-to-date' };
  } catch (error) {
    return {
      status: 'error',
      error: error instanceof Error ? error.message : 'Tải bản cập nhật thất bại.',
    };
  }
}

/**
 * Khởi động lại để chạy bản vừa tải.
 *
 * Trả về `false` nếu không khởi động lại được; nơi gọi nên bảo người dùng tự
 * đóng mở lại app thay vì đứng im không phản hồi.
 */
export async function applyOta(): Promise<boolean> {
  if (!isOtaSupported()) return false;
  try {
    await Updates.reloadAsync();
    return true;
  } catch {
    return false;
  }
}

/** Tải rồi áp dụng luôn — dùng cho nút "Cập nhật ngay" */
export async function downloadAndApplyOta(): Promise<OtaCheckResult> {
  const downloaded = await downloadOta();
  if (downloaded.status !== 'downloaded') return downloaded;

  const ok = await applyOta();
  return ok
    ? { status: 'downloaded' }
    : {
        status: 'error',
        error: 'Đã tải xong nhưng chưa khởi động lại được. Em đóng rồi mở lại app nhé!',
      };
}

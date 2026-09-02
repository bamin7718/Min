import AsyncStorage from '@react-native-async-storage/async-storage';
import { Platform, Vibration } from 'react-native';

import { isGameSoundSupported, setGameSoundEnabled } from './gameSound';

/**
 * Cài đặt âm thanh và rung của THIẾT BỊ.
 *
 * Cố ý không nằm trong `StoredProgress`: đây là sở thích gắn với cái máy đang
 * dùng, không phải tiến độ học. Con dùng tablet ở nhà mở tiếng, dùng điện thoại
 * ngoài đường tắt tiếng — đồng bộ ba công tắc này giữa các máy chỉ gây khó chịu.
 */

const KEY = '@lop3-study-game/av-prefs-v1';

export interface AvPrefs {
  /** Nhạc nền. Xem `isBgmSupported()` — hiện chưa nền tảng nào phát được. */
  bgm: boolean;
  /** Hiệu ứng âm thanh trong game */
  sfx: boolean;
  /** Rung khi trả lời sai / khi trúng đạn */
  haptics: boolean;
}

export const DEFAULT_AV_PREFS: AvPrefs = { bgm: false, sfx: true, haptics: true };

/**
 * Nhạc nền có phát được không — hiện luôn là `false`.
 *
 * Dự án không có tệp nhạc nào và cũng không có thư viện phát nhạc. `gameSound.ts`
 * sinh tiếng ngắn bằng Web Audio API, cách đó không dùng lại được cho một bản
 * nhạc dài. Muốn có nhạc nền thật thì phải thêm `expo-audio` — là native module,
 * nên `runtimeVersion` đổi và mọi máy đang cài mất đường cập nhật ngầm cho tới
 * khi cài lại APK.
 *
 * Trả về `false` chứ không xoá công tắc khỏi màn hình Cài đặt: để phụ huynh thấy
 * rõ "có mục này nhưng bản này chưa chạy được", hơn là tưởng app thiếu tính năng.
 */
export function isBgmSupported(): boolean {
  return false;
}

/** Hiệu ứng âm thanh có phát được trên nền tảng này không */
export function isSfxSupported(): boolean {
  return isGameSoundSupported();
}

/**
 * Máy có rung được không.
 *
 * `Vibration` nằm trong React Native core nên không phải thêm thư viện nào —
 * khác `expo-haptics`. Bù lại chỉ rung được kiểu đơn giản (bật/tắt theo thời
 * lượng), không có các mẫu rung tinh tế như `expo-haptics`.
 */
export function isHapticsSupported(): boolean {
  return Platform.OS === 'ios' || Platform.OS === 'android';
}

let current: AvPrefs = { ...DEFAULT_AV_PREFS };

export function currentAvPrefs(): AvPrefs {
  return current;
}

function apply(prefs: AvPrefs): void {
  current = prefs;
  // `gameSound` giữ cờ bật/tắt riêng của nó; đồng bộ lại mỗi lần đổi
  setGameSoundEnabled(prefs.sfx);
}

function sanitize(raw: unknown): AvPrefs {
  const source = (raw ?? {}) as Partial<AvPrefs>;
  return {
    bgm: typeof source.bgm === 'boolean' ? source.bgm : DEFAULT_AV_PREFS.bgm,
    sfx: typeof source.sfx === 'boolean' ? source.sfx : DEFAULT_AV_PREFS.sfx,
    haptics:
      typeof source.haptics === 'boolean' ? source.haptics : DEFAULT_AV_PREFS.haptics,
  };
}

/** Đọc cài đặt đã lưu và áp dụng ngay. Gọi một lần khi mở app. */
export async function loadAvPrefs(): Promise<AvPrefs> {
  try {
    const raw = await AsyncStorage.getItem(KEY);
    const prefs = sanitize(raw ? JSON.parse(raw) : null);
    apply(prefs);
    return prefs;
  } catch {
    apply({ ...DEFAULT_AV_PREFS });
    return { ...DEFAULT_AV_PREFS };
  }
}

export async function saveAvPrefs(prefs: AvPrefs): Promise<void> {
  apply(prefs);
  try {
    await AsyncStorage.setItem(KEY, JSON.stringify(prefs));
  } catch (error) {
    console.warn('[prefs] Không lưu được cài đặt âm thanh:', error);
  }
}

/**
 * Rung một nhịp ngắn. Không bao giờ ném lỗi — rung chỉ là phần phụ.
 *
 * @param ms Thời lượng, mặc định 30ms (đủ để cảm nhận mà không giật mình).
 */
export function vibrate(ms = 30): void {
  if (!current.haptics || !isHapticsSupported()) return;
  try {
    Vibration.vibrate(ms);
  } catch {
    // Máy không có motor rung, hoặc bị hệ thống chặn
  }
}

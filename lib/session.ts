import AsyncStorage from '@react-native-async-storage/async-storage';

import type { AuthSession, UserRole } from '../types';

const STORAGE_KEY = '@lop3-study-game/session-v1';

/** Đọc phiên đã lưu. `null` nếu chưa đăng nhập. */
export async function loadSession(): Promise<AuthSession | null> {
  try {
    const raw = await AsyncStorage.getItem(STORAGE_KEY);
    if (!raw) return null;

    const parsed = JSON.parse(raw) as Partial<AuthSession>;
    if (
      typeof parsed.userId !== 'string' ||
      typeof parsed.username !== 'string' ||
      typeof parsed.token !== 'string' ||
      (parsed.role !== 'student' && parsed.role !== 'parent')
    ) {
      return null;
    }
    return {
      userId: parsed.userId,
      username: parsed.username,
      role: parsed.role as UserRole,
      token: parsed.token,
    };
  } catch (error) {
    console.warn('[session] Không đọc được phiên đã lưu:', error);
    return null;
  }
}

export async function saveSession(session: AuthSession): Promise<void> {
  try {
    await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(session));
  } catch (error) {
    console.warn('[session] Không lưu được phiên:', error);
  }
}

export async function clearSession(): Promise<void> {
  try {
    await AsyncStorage.removeItem(STORAGE_KEY);
  } catch (error) {
    console.warn('[session] Không xoá được phiên:', error);
  }
}


const APP_LOCK_KEY = '@lop3-study-game/app-lock-v1';

/** Có bắt nhập PIN khi mở ứng dụng hay không */
export async function loadAppLock(): Promise<boolean> {
  try {
    return (await AsyncStorage.getItem(APP_LOCK_KEY)) === '1';
  } catch {
    return false;
  }
}

export async function saveAppLock(enabled: boolean): Promise<void> {
  try {
    await AsyncStorage.setItem(APP_LOCK_KEY, enabled ? '1' : '0');
  } catch (error) {
    console.warn('[session] Không lưu được cài đặt khoá ứng dụng:', error);
  }
}
